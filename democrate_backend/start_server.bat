@echo off
REM Start Democrate backend on 0.0.0.0 for LAN/mobile access (Termux, phone testing)
REM Usage: start_server.bat

cd /d "%~dp0"

REM Activate venv if it exists
if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
)

REM Ensure .env exists
if not exist ".env" (
    echo ERROR: .env not found. Copy .env.example to .env and configure.
    exit /b 1
)

REM Run seed first (idempotent) to ensure admin/teacher/developer accounts exist
python seed.py

REM Start uvicorn on all interfaces for mobile/LAN access
echo Starting server on 0.0.0.0:5000 (accessible from phone on same WiFi)...
python -m uvicorn main:app --host 0.0.0.0 --port 5000