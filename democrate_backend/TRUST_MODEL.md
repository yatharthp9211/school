# Democrate — Trust Model

*Last updated: 2026-08-08 · Version 2.0 (post-hardening)*

This document defines how Democrate handles anonymity, accountability, and
moderation. It is the contract between the school, the students, the teachers,
and the administration. **Read it before adopting the platform.**

---

## 1. The core promise

Students may raise concerns **without fear**. Every report is:

1. **Submitted anonymously** — identity is never attached to the public record.
2. **Verified by a teacher** — the assigned verifier, who can never be the
   teacher the report is about.
3. **Weighed by the community** — votes are a *signal*, never a verdict.
4. **Decided by an administrator** — only an admin applies consequences.

## 2. Anonymity vs. accountability

Democrate is **anonymous to students and teachers**, and **accountable to the
administration** in a defined review flow. This is *accountability*, not
*absolute anonymity* — the two cannot coexist in a system that must stop
malicious reports.

| Party | Can see who submitted? | When? |
|-------|------------------------|-------|
| Peers (students) | Never | — |
| Teachers | Never | — |
| Administrators | Yes, in the moderation review only | A complaint is flagged for review, or the admin is resolving a case |

### 2.1 What makes it anonymous

- **`author_id` is stored server-side but never serialized.** No public API
  response contains it. The `ComplaintResponse` schema exposes only `id`,
  `anonymous_id`, `text`, `category`, `status`, timestamps, and vote counts.
- **Per-complaint random IDs.** Every complaint gets a fresh `ANON-XXXXXXXX`
  identifier. They are never reused, so two reports by the same student cannot
  be linked through a pseudonym.
- **No identity in login responses.** `/auth/login` and `/auth/me` return only
  `id`, `name`, and `role` (plus account status fields). The `details` column —
  which may hold a class/section string or a teacher photo — is only returned
  to the account's owner.

### 2.2 The accountability path

The **only** legitimate identity-reveal path is the admin moderation review:

- `GET /admin/flagged` — complaints awaiting a moderation decision, with the
  complainant's identity.
- `GET /admin/false` — complaints already determined false, with identities.

These endpoints require an active ADMIN token. Identities are **not** exposed
by votes alone.

## 3. The moderation flow (votes are a signal, not a verdict)

The old design punished a complaint the moment its score collapsed. That lets a
coordinated downvote mob "prove" someone wrong without a human judgment. The
new design separates **signal** from **consequence**:

1. A verified complaint is published and the community votes
   (students ×1, teachers ×10).
2. When the weighted score ≤ **-50**, the complaint becomes **`FLAGGED`**.
   - No identity is exposed. No penalty is applied. It just enters the
     moderation queue.
3. An administrator reviews it and chooses one of three outcomes:
   - **Legitimate** → status returns to `PUBLISHED`.
   - **False / malicious** → status `ARCHIVED`, `is_false = True`, and *now*
     consequences apply:
     - the author's `false_count` increases;
     - at `false_count ≥ 5` the author is **banned from submitting** (they can
       still log in and view history);
     - the verifier teacher's leaderboard penalty count increases;
     - an audit entry is written.
   - **Insufficient evidence** → status `ARCHIVED`, **no penalty**.

### 3.1 Why this matters

- A vote swing never "proves" a report false — it only *raises it* for review.
- Consequences always follow a **human decision**, so a targeted downvote mob
  cannot manufacture a ban.
- The author is protected from mobs; the accused teacher is protected by
  review; the platform is protected from abuse by the ban ladder.

## 4. Conflict of interest

Every public complaint names a **verifier teacher**. The student may also name
a **target teacher** (the subject of the complaint). These are distinct:

- `verifier_teacher` — the teacher assigned to review the report.
- `target_teacher` — who the report is *about* (optional).

**The verifier can never be the target.** Enforced at submission (client and
server) and at verification (only the assigned verifier may act; a teacher
cannot verify a complaint about themselves). This keeps the first review
independent.

## 5. The state machine

Status transitions are enforced server-side; anything else returns `400`.

```
                 ┌─────────── approve ───────────┐
PENDING ────────┤            → PUBLISHED         ├──► vote collapses to ≤ -50
   │            └── reject ──→ ARCHIVED          │         ─────────────────┐
   │                                             │                          ▼
   └── private ──→ MODERATED                     │                   FLAGGED
                     │ (admin)                   │                        │
                     ▼                           │                 admin decision
                  ARCHIVED  ◄──────── admin ─────┤             ┌────────────┴────────────┐
                                                │      legitimate ──► PUBLISHED          │
                          PUBLISHED/VOTING ─────┴──► RESOLVED │   false / insufficient   │
                                                          │   ──► ARCHIVED             │
                                                          └─────────────────────────────┘
```

- Voting is allowed **only** on `PUBLISHED` / `VOTING`.
- A student cannot vote on their own complaint.
- One vote per user per complaint (DB `UNIQUE(complaint_id, user_id)`).

## 6. Who can register

| Role     | Registration                                     |
|----------|--------------------------------------------------|
| Student  | Public self-registration                          |
| Teacher  | Gated by `DEMOCRATE_TEACHER_KEY` (issued by admin) |
| Admin    | **No public registration.** Provisioned out-of-band via `seed.py` with env credentials. |

There is no `/register/admin`. The historical public admin-registration hole
was closed and the account created through it was removed.

## 7. Account discipline

- An admin can **disable** any account (`/admin/users/{id}/disable`). Disabled
  accounts cannot log in or act. The action is audited.
- Reaching `false_count ≥ 5` auto-bans an author from submitting. This is the
  original spec's ban algorithm, now triggered only by admin decisions.

## 8. Audit trail

Every consequential action is written to `audit_logs`:

`LOGIN_SUCCESS`, `LOGIN_FAILURE`, `REGISTER_SUCCESS`, `COMPLAINT_CREATED`,
`COMPLAINT_VERIFIED`, `COMPLAINT_REJECTED`, `COMPLAINT_FLAGGED`,
`COMPLAINT_RESOLVED`, `COMPLAINT_ARCHIVED`, `COMPLAINT_FALSE`, `VOTE_CAST`,
`RATING_SUBMITTED`, `ACCOUNT_DISABLED`, `ACCOUNT_ENABLED`, `USER_BANNED`.

**Never logged:** complaint text, passwords, tokens. The audit log is
admin-only and immutable in practice (no public delete endpoint).

## 9. Data retention

- Complaint text and identity linkage (`author_id`) are retained for the
  lifetime of the database — this is what makes accountability possible.
- Votes record *who* voted to prevent duplicates; they are visible to admins
  through the audit trail as `VOTE_CAST` events (without vote text).
- The school should adopt a retention policy (e.g. archive + purge after N
  years) and document it for parents. See `ROADMAP.md`.

## 10. Residual risks & boundaries

- **Anonymity is server-side.** The operator (school admin) holds the keys.
  This is inherent to accountability and must be communicated to students.
- **In-memory rate limiting** is single-process — adequate for the pilot on
  one Termux host. Production should lean on Cloudflare edge limits.
- **No evidence uploads** yet: files would carry metadata and need a handling
  policy. Deferred to `ROADMAP.md`.
- **No email verification**: accounts are school-internal; roadmapped.
