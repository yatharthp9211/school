#!/bin/bash
# Start Democrate backend server on 0.0.0.0:5000 for LAN/mobile access
# Usage: ./start_server.sh

# Load environment variables from .env if present
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Allow dev secret for local development
export DEMOCRATE_ALLOW_DEV_SECRET=1

# Start server on all interfaces (0.0.0.0) for mobile/LAN access
uvicorn main:app --host 0.0.0.0 --port 5000