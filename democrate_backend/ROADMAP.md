# Democrate — Roadmap (post-adoption)

*Last updated: 2026-08-08*

Items below are **deliberately deferred** until the platform has school
approval, real usage data, or a defined policy. Implementing them now would
add cost or surface area without a mandate. Each item records *why* it waits
and *what* must be true to start it.

---

## 1. Email authentication & verification

- **Why it waits:** accounts are school-internal today; there is no student
  email directory, and password recovery needs an operator policy.
- **To start:** school provides a directory or SSO; decide whether email is
  the primary identity or an optional recovery path.

## 2. Password recovery

- Depends on #1 (needs a trusted out-of-band channel). Until then, admins can
  reset accounts via the provision tooling / direct DB by an operator.

## 3. Security notifications

- Alert admins on: new admin login, disable/enable events, a `COMPLAINT_FALSE`
  determination, a user reaching the ban threshold, and unusual rate-limit
  bursts. Notifications can be an admin inbox now and email later.

## 4. Evidence uploads

- **Why it waits:** files carry metadata (EXIF, authorship), need storage,
  access control, retention, and a data-handling policy the school must
  approve. The plan-review explicitly deprioritized it.
- **To start:** draft a data-handling policy; then add strict upload rules
  (size/type allowlist, strip EXIF, encrypted storage, per-case admin access
  only, expiry).

## 5. Formal backups

- Today the SQLite file can be copied directly, but there is no scheduled,
  tested backup. Add a cron/hook that snapshots `democrate.db` to a safe
  location and verifies restores.

## 6. Monitoring & alerting

- Lightweight health endpoint + uptime check (Cloudflare availability already
  covers basic reachability). Add server-side logging aggregation only if the
  pilot grows beyond one host.

## 7. Notifications (in-app)

- Let students follow a complaint and see status changes; let teachers get a
  badge when a report is assigned to them. Deferred to keep the surface
  small; the data model already supports it.

## 8. Production hosting & scaling

- The pilot runs on a single Termux host behind Cloudflare. When moving to
  real hosting: shared rate limiting (Redis or Cloudflare rate rules), a real
  process manager, HTTPS with a proper certificate, and a managed SQLite or
  Postgres migration path.

## 9. Load testing

- Run realistic concurrent voting/rating load before a school-wide launch to
  validate the in-memory limiter and SQLite write throughput.

## 10. Formal data-retention policy

- Adopt and publish a retention schedule (archive + purge cadence) and a
  documented process for law-enforcement / parental identity-access requests.
  Aligns with `TRUST_MODEL.md` §9.

---

*Anything on this list is a candidate for the *next* milestone — not
implemented in the current hardening release by explicit decision.*
