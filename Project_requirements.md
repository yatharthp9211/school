# Project Requirements

## Primary Objective
Create an anonymous complaint platform where students can safely report problems without fear of discrimination while ensuring that false allegations are also handled through a reputation system.

## Key Features
1. **Role-Based Access**: Students, Teachers, Administrators, and Developers.
2. **Anonymous Reporting**: Students submit complaints completely anonymously.
3. **Verification**: Teachers verify complaints before they become public.
4. **Voting System**: Students (+1/-1) and Teachers (+10/-10) can vote on complaints.
5. **AI Classification**: Local zero-shot AI classifier categorizes complaints automatically (e.g., Harassment, Infrastructure, Bullying).
6. **Reputation System**: False complaints (score <= -50) are penalized. 
    - Students are banned after 5 false complaints.
    - Verifying teachers lose 50 leaderboard points for verifying a false complaint.
7. **Leaderboard**: Teachers are ranked based on their positive resolutions and penalties.
8. **Developer Accountability System**: A 2FA-secured portal explicitly for system developers providing raw database querying capabilities and complete system audit logs. (Audit logs are restricted from general administrators to preserve maximum anonymity and data segregation).
