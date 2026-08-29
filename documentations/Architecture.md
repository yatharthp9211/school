# System Architecture

## High-Level Flow
```text
                User
                  │
                  ▼
           Login Selection
                  │
     ┌────────────┼────────────┬─────────────┐
     │            │            │             │
Student      Teacher     Administrator   Developer (2FA)
     │            │            │             │
     └────────────┼────────────┴─────────────┘
                  ▼
            Authentication
                  │
                  ▼
             SQL Database
                  │
        ┌─────────┼─────────┐
        │         │         │
 Identity Table  Issues   Leaderboard
                  │
                  ▼
       Administrative Dashboard
```

## Complaint Categories
Students select from predefined standard categories when submitting a report:
- Harassment
- Teacher Misconduct
- Infrastructure
- Bullying
- Academic
- Safety
- Mental Health
- Other

## Deployment Architecture
- **Environment**: Termux on Android device.
- **Frontend Server**: Nginx serving static HTML, CSS, and vanilla ES Modules (with synchronized `?v=18` cache-busting and single-instance state management).
- **Backend Server**: Uvicorn running FastAPI on localhost (bridged via Nginx reverse proxy).
- **Network Tunnel**: Cloudflare Tunnel (`cloudflared`) exposing the local Nginx proxy port to `https://yatharthpandey.dpdns.org` securely over HTTPS.