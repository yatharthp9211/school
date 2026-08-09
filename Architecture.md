# System Architecture

## High-Level Flow
```text
                User
                  │
                  ▼
           Login Selection
                  │
     ┌────────────┼────────────┐
     │            │            │
Student      Teacher     Administrator
     │            │            │
     └────────────┼────────────┘
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
      Local AI Zero-Shot Classifier
                  │
                  ▼
           Administrative Dashboard
```

## Local AI Pipeline
Whenever a complaint is submitted, it is processed via a Zero-Shot Classification model into the following categories:
- Harassment
- Teacher Misconduct
- Infrastructure
- Bullying
- Academic
- Safety
- Mental Health
- Other
