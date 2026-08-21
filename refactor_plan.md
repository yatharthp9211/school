# Democrate Refactor Plan — From "Working" to "Good" Code

**Audience:** the maintainer (you).
**Goal:** turn the current shipped, tested, *working* Democrate platform into *good* code —
readable, maintainable, tested, low-technical-debt — without changing user-visible behavior
or breaking the 53/53 e2e + 11/11 smoke tests that already pass.

Every item below is classified:

- **BUG** — it is wrong today (produces incorrect output or a latent failure). Fix these first.
- **QUALITY** — it works but is hard to read / maintain / reuse.
- **TEST** — add an automated check so a regression can't ship silently.
- **DOC** — comment / documentation improvement.

Severity: 🔴 high · 🟠 medium · 🟢 low.

---

## 0. Ground rules for this refactor

1. **Behavior-preserving.** Do not change endpoints, payloads, or routes. e2e + smoke must stay green.
2. **One concern per change.** Land BUGs first (with a test), then QUALITY.
3. **Reuse before you write.** `esc()`, `Navbar`, `Avatar`, `Empty` already exist in
   `js/components.js` — views must import them, not copy them.
4. **No new dependencies** unless a QUALITY item explicitly calls for one and it's worth it.
5. **Run the guards after every batch:**
   ```bash
   cd democrate_backend && python _reset_test_data.py && python _verify_e2e.py
   # expect: 53 passed, 0 failed
   # smoke:
   python _smoke_test.py
   # expect: ALL PASS
   ```

---

## 1. Backend BUGs (fix first)

### 1.1 🔴 Developer dashboard stats are wrong (`routes/developer.py` + `views/developer_dashboard.js`)
**File:** `democrate_backend/routes/developer.py` (`/stats`), `democrate_frontend/views/developer_dashboard.js:38-46`

The dashboard reads `stats.false_reports`, but `/stats` never returns that key. It returns
`users.total`, `complaints.total`, `votes`, `ratings`, `audit_logs`. So the "False Reports"
stat is **always 0** — a silent wrong number shown to a developer.

**Fix (backend):** add `false_reports` to `/stats`:
```python
"false_reports": db.query(models.Complaint).filter(models.Complaint.is_false.is_(True)).count(),
```
**Fix (frontend):** the dashboard already uses `stats.complaints?.total` and `stats.users?.total`
correctly; just confirm `stats.false_reports || 0` now shows a real number.

**TEST:** add an e2e assertion in `_verify_e2e.py` — create a complaint, admin marks it false,
then `GET /developer/stats` and assert `false_reports >= 1`.

### 1.2 🔴 Temp-developer token isn't rejected on normal endpoints
**File:** `routes/auth.py:164` (dev login issues `temp: True` token); `dependencies.get_current_user` does not check it.

A `temp` token (5-min, issued by `/developer/login`) carries `role=developer` and could be
replayed against any developer endpoint (e.g. `/developer/query`) **before** the file unlock
step. The file-upload step is supposed to be the second factor — but nothing enforces "temp
token ⇒ not yet fully authenticated."

**Fix:** in `dependencies.get_current_user` (or a dedicated `get_current_active_developer`),
reject tokens with `payload.get("temp") is True` with `401 "Complete the unlock step."`.
This closes the 2FA bypass cleanly and is behavior-preserving for the happy path.

**TEST:** e2e — call `/developer/stats` with a fresh `temp` token; expect 401.

### 1.3 🟠 `me` endpoint leaks `details` (PII / base64 photo) to the client
**File:** `routes/auth.py:116-121`, `schemas.UserResponse` (`details: Optional[str]`)

`/auth/me` returns the full `UserResponse`, which includes `details`. For teachers `details`
is JSON containing `subject`, `classes`, and `photo` (a base64 image). Students' `details`
holds class/section. The profile page already reads `details` and parses it client-side, so
this isn't a *secret* leak — but `UserResponse` is also the login payload and is passed
around more widely than needed. The frontend already re-fetches `/me` for the profile, so
returning `details` in the **login** response is unnecessary surface area.

**Fix:** split the schema — `LoginUser` (id, name, role only) returned by login; `UserResponse`
(with `details`, `is_banned`, `false_count`, `has_image`) returned by `/me` and `/profile`.
Login returns `LoginUser`. Low risk; keeps the login payload minimal.

**TEST:** e2e — login as student, assert response `user` has no `details` key.

### 1.4 🟠 `developer_unlock` prints secrets to stdout
**File:** `routes/auth.py:237-239`
```python
print(f"Expected: {settings.DEVELOPER_SECRET_FILE_CONTENT}")
print(f"Received: {content}")
print(f"Match: {content == settings.DEVELOPER_SECRET_FILE_CONTENT}")
```
Prints the expected unlock secret and the uploaded content to server logs. On a shared Termux
device or any multi-user host this is a credential-disclosure bug.

**Fix:** delete the three `print` lines. The match result is already captured in the audit log
as `dev_unlock_failed` / `dev_complete` (without the secret value).

**TEST:** manual/automated — after a failed unlock, assert the secret string does **not**
appear in server stderr/stdout. (Add a smoke assertion that greps a captured subprocess log.)

---

## 2. Backend QUALITY

### 2.1 🟠 De-duplicate the `score` property vs `weighted_score`
**File:** `models.py:82-94`
```python
def weighted_score(self) -> int: ...
@property
def score(self) -> int:
    return self.weighted_score()
```
`score` is a pure alias of `weighted_score`. Pick one name. Recommendation: keep `weighted_score()`
as the method, delete the `score` property, and let `ComplaintResponse.score` use
`weighted_score` (via a small `field_serializer` or `Computed` field). This removes the
"why are there two?" confusion the current docstring admits.

### 2.2 🟠 Magic numbers → named constants for vote weights
**File:** `routes/complaints.py:114`, `crud.py:218`
`weight = 10 if ... TEACHER else 1` and the `if weight == 10` branch. The `10` is the teacher
vote multiplier and is duplicated.

**Fix:** add `TEACHER_VOTE_WEIGHT = 10` to `config.py` (or `models.py`), reference it in both
places. One source of truth.

### 2.3 🟢 Centralize status lists
**File:** `views/*` (frontend) and `crud.py` repeat status tuples like
`['published','voting']`, `['pending','moderated']`.

**Fix (frontend):** add a `STATUS_GROUPS` map in `js/config.js`:
```js
export const STATUS = {
  LIVE: ['published','voting'],
  PENDING: ['pending','moderated'],
  RESOLVED: ['resolved'],
};
```
Use in `student_dashboard.js`, `teacher_dashboard.js`, `complaints_list.js`, `admin_dashboard.js`.
Removes 6+ copy-pasted `(c.status||'').toLowerCase()` groupings.

### 2.4 🟢 Type the `user` dicts instead of `dict`
**File:** `schemas.py:15` (`class Token: user: dict`), `auth.py:_public_user` returns `dict`.

**Fix:** return `schemas.LoginUser` from `_public_user` and type `Token.user` as `LoginUser`.
Gives the OpenAPI docs and mypy (if enabled later) real shape instead of `dict`.

### 2.5 🟢 `crud.create_or_update_rating` retry block is duplicated
**File:** `crud.py:253-286` — the "existing row update" logic appears twice (pre-check and
post-`IntegrityError` retry).

**Fix:** extract `_apply_rating(existing, rating)` helper used by both branches. The race
window is already covered by the DB unique constraint; the duplication is just readability debt.

### 2.6 🟢 `datetime.utcnow()` is deprecated in 3.12+
**File:** `models.py:67,113,130`, `crud.py:256`, `security.py:37,38`.

`datetime.utcnow()` raises a deprecation warning and will break on 3.13+. Switch to
`datetime.now(timezone.utc)` (SQLAlchemy 2.0 handles tz-aware datetimes fine). Best done in one
sweep with a `make`/sed since it's mechanical. Add a `TEST` that imports all models under 3.12+
and asserts no `DeprecationWarning` is emitted.

---

## 3. Frontend BUGs

### 3.1 🔴 `esc()` is redefined in 8 view files instead of imported
**File:** `views/{profile,admin_complaints,leaderboard,admin_audit,admin_dashboard,ratings,complaints_list}.js`
each define a local `function esc(s)`. `js/components.js:10` already exports `esc`.

**Why it's a (latent) bug:** the local copies are identical *today*, but a future XSS-guard fix
to `components.js` won't propagate — a real maintenance trap for security-sensitive code.
All 8 must import `esc` from `../js/components.js` and delete the local copy. This is the single
highest-leverage cleanup in the frontend.

**TEST:** a lint rule / grep CI step: "no `function esc(` definition outside `js/components.js`."

### 3.2 🔴 `developer_dashboard.js` uses `?v=16` cache-buster while `app.js` is `?v=17`
**File:** `views/developer_dashboard.js:1-4` (imports `?v=16`).

`index.html` loads `js/app.js?v=17`; `app.js` lazy-imports views with `?v=17`. This view is the
odd one out at `?v=16`, so it runs against a **stale** `config.js`/`api.js` if a browser cached
the old `?v=16` bundle. Symptom: the wrong `API_BASE` or missing `api` method after a deploy.

**Fix:** bump all `?v=16` imports in this file to `?v=17` (matching `app.js`). Then adopt the
process fix in §4.1 so this can't drift again.

### 3.3 🟠 `profile.js` upload uses `window.location.reload()`
**File:** `views/profile.js:146,167`

After saving/removing a picture the whole SPA reloads. That destroys any in-flight state and
re-fetches everything. The avatar can be updated in place: `Auth`/state already holds the user;
just re-render the avatar element or call `router.refresh()` (which the global dispatcher already
uses for votes/admin actions). Replace both `window.location.reload()` with `router.refresh()`.

Behavior is preserved (avatar updates), but without a full page bounce.

### 3.4 🟠 Inconsistent unauthorized-state rendering
**File:** every view's `render()` returns a hand-rolled
`<main id="app-main"><div class="empty" ...>Unauthorized.</div></main>` when the role check fails.

11 copies of the same string. Extract `Unauthorized()` into `components.js` (next to `Empty`)
and use `return Unauthorized()`. Small, but it's the same DRY principle as `esc`.

---

## 4. Frontend QUALITY + process

### 4.1 🔴 Cache-buster drift (`?v=N`) is manual and error-prone
**File:** every `views/*.js` hardcodes `?v=16`/`?v=17` on each import line; `app.js:14` has `const V = 17`.

Today one file is already out of sync (§3.2). The pattern "edit N places by hand" *will* drift
again after the next change.

**Fix options (pick one):**
- **(A, recommended, zero-build):** drop per-file `?v=N` entirely and append a single build
  hash to `index.html`'s `<script src>` only, with the SPA served with `Cache-Control: no-cache`
  in dev. Since every module is reached through `app.js`'s dynamic `import(...?v=${V})`, the
  current design already funnels through one `V` — but views hardcode their *own* `?v` on the
  *static* imports at top, which is the bug. Make `app.js` the only place `V` lives and have
  views import without `?v` (the browser cache is busted by the entry script's `?v`).
- **(B):** a one-line npm/`python` script `bump_cache.py` that rewrites all `?v=\d+` to a new
  number and is run by the deploy step. Keeps current structure, removes the manual step.

Either is fine; **(A)** is less code. Document the chosen approach in `README`.

### 4.2 🟠 `complaints_list.js` and `complaints_list.js` both hide rows with `data-hidden-row`
**File:** `views/complaints_list.js:109`, `views/admin_audit.js:29`, `views/admin_complaints.js`

The "first 20 visible, rest hidden, Load more" pattern is reimplemented 3× with slightly
different markup. Extract `paginateRows(rows, perPage)` → `{visible, hiddenCount}` helper in a
small `js/list-utils.js` (or inside `components.js`). Each view calls it.

### 4.3 🟢 Empty-state micro-duplication
`Empty('No public complaints match.', ...)` vs `Empty('No complaints match these filters.', ...)` —
fine to keep distinct copy, but `Empty` + a `Spinner`/`Skeleton` component would let dashboards
show a loading state instead of the current hardcoded
`<div class="skeleton line w-60">` string repeated in `login.js`, `landing.js`, `developer_login.js`.
Extract `Loading()` into `components.js`.

### 4.4 🟢 `student_dashboard.js` / `teacher_dashboard.js` share dashboard scaffolding
Both build a header + `Stat` grid + "your reports" section. A `DashboardShell({role, title, stats, sections})`
helper would cut ~40 duplicated lines across the two. Medium effort; do only if touching both soon.

### 4.5 🟢 Accessibility: `aria-live` regions are fine; add focus management on route change
`js/router.js` already does focus management (per the survey). No change needed — noted as
"already good," don't regress it.

---

## 5. Tests to ADD (raise confidence, lower debt)

These are cheap and prevent the bugs above from returning:

| # | Test | File | Asserts |
|---|------|------|---------|
| T1 | Dev `temp` token rejected | `_verify_e2e.py` | `GET /developer/stats` with temp token → 401 |
| T2 | `/stats` includes `false_reports` | `_verify_e2e.py` | key present, `>= 1` after a false marking |
| T3 | Login payload has no `details` | `_verify_e2e.py` | `res.user` lacks `details` |
| T4 | Unlock secret not logged | `_smoke_test.py` | subprocess stderr has no `DEVELOPER_SECRET_FILE_CONTENT` value |
| T5 | `esc` defined once | CI grep / lint | no `function esc(` outside `components.js` |
| T6 | `?v=N` consistency | CI grep | all view `?v=` equal `app.js` `V` |
| T7 | `datetime.utcnow` gone | import-time check | no `DeprecationWarning` under 3.12+ |
| T8 | Duplicate-vote is race-safe | `_verify_e2e.py` | second vote → 400 "Already voted" |

T5/T6 can be a tiny `python -m pytest` or even a `grep`-based pre-commit hook — no framework
needed (matches the "no unrequested abstractions" rule).

---

## 6. Security hardening (keep, don't regress)

Already solid — list what *not* to touch, so a refactor doesn't weaken it:

- ✅ In-memory rate limiter + `client_ip()` XFF trust logic (`dependencies.py:27`) — documented
  as dev-only; production relies on Cloudflare. Keep the doc comment.
- ✅ Dummy-hash constant-time login (`auth.py:19,76`) — user-enumeration defense. Keep.
- ✅ `author_id` never serialized (`models.py:50`); `anonymous_id` is the only public id. Keep.
- ✅ CSV-injection guard (`admin_dashboard.js:12` `csvCell`). Keep; add a **TEST** that a cell
  starting with `=` becomes `'=`.
- ✅ 1 MB file-size cap on dev unlock (`auth.py:217`) and profile image (`schemas.py:78`). Keep.

---

## 7. Suggested merge order (smallest risky-first)

1. **BUG 1.4** delete secret prints (trivial, safe). + T4.
2. **BUG 1.2** reject `temp` token. + T1.
3. **BUG 1.1** `false_reports` in `/stats`. + T2.
4. **BUG 3.1** import `esc` everywhere (delete 8 local copies). + T5.
5. **BUG 3.2** fix `?v=16`→`?v=17` in `developer_dashboard.js`. + T6.
6. **BUG 1.3** split `LoginUser` / `UserResponse`. + T3.
7. **QUALITY 2.1–2.6** model/constant/utcnow sweeps (mechanical). + T7.
8. **QUALITY 4.1** cache-buster process fix.
9. **QUALITY 3.3 / 3.4 / 4.2 / 4.3** frontend DRY cleanup.
10. Run full e2e + smoke after each batch; commit when green.

---

## 8. Definition of done

- [ ] All 🔴 BUGs fixed and covered by a test in §5.
- [ ] `python _verify_e2e.py` → **53 passed** (no new failures; the 8 new assertions are green).
- [ ] `python _smoke_test.py` → **ALL PASS**.
- [ ] `grep -rn "function esc(" democrate_frontend/views` → no matches.
- [ ] No `datetime.utcnow()` remains; app imports clean under Python 3.12+.
- [ ] `README` documents the cache-buster strategy (§4.1) and the dev-secret-logging removal.
- [ ] No new third-party dependencies.
- [ ] No behavioral change observable to a student/teacher/admin/developer user.

---

*Survey scope covered: backend `main, config, models, schemas, crud, security, dependencies,
routes/{auth,complaints,developer}`; frontend `js/{app,router,state,auth,api,config,components}`,
all 13 `views/*.js`, `index.html`, and `css/components.css`. The platform is functionally
complete and tested; this plan targets readability, de-duplication, two real stat/2FA bugs, and
a secret-logging leak — not feature work.*
