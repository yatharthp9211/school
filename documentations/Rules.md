# Core Rules & Logic

## Security & Anonymity
- Passwords MUST be stored as hashes (bcrypt).
- Unique IDs are used instead of names.
- Student names are hidden from ALL users (including teachers).
- Only administrators can unmask identity, and ONLY after a complaint is deemed malicious (score <= -50).

## Voting & Weighting
- **Student Vote Weight:** +1 or -1
- **Teacher Vote Weight:** +10 or -10
- **Total Score:** `Student Votes + (10 * Teacher Votes)`

## False Allegation Protocol
- Triggered if an issue reaches a score of `-50`.
- The complaint is removed from public dashboards and moved to Admin 'Fake Allegations'.
- The student author receives a strike (+1 Fake_Count).
- If a student hits 5 strikes, they are banned from submitting new complaints.
- The teacher who wrongly verified the complaint receives a -50 point penalty on the leaderboard.
