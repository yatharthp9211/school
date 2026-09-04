#!/bin/bash
# Start Democrate backend on 0.0.0.0 for LAN/mobile access (Termux, phone testing)
# Usage: ./start_server.sh

cd "$(dirname "$0")"
source venv/bin/activate 2>/dev/null || true

# Ensure required env vars are set (copy .env.example to .env and fill in real values)
if [ ! -f .env ]; then
    echo "ERROR: .env not found. Copy .env.example to .env and configure."
    exit 1
fi

# Run seed first (idempotent) to ensure admin/teacher/developer accounts exist
python seed.py

# Start uvicorn on all interfaces for mobile/LAN access
echo "Starting server on 0.0.0.0:5000 (accessible from phone on same WiFi)..."
python -m uvicorn main:app --host 0.0.0.0 --port 5000