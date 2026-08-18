@echo off
REM Start Democrate backend server on 0.0.0.0:5000 for LAN/mobile access
REM Usage: start_server.bat

REM Load environment variables from .env if present
if exist .env (
    for /f "tokens=1,* delims==" %%a in (.env) do (
        if not "%%a"=="" if not "%%a"=="#*" set %%a=%%b
    )
)

REM Allow dev secret for local development
set DEMOCRATE_ALLOW_DEV_SECRET=1

REM Start server on all interfaces (0.0.0.0) for mobile/LAN access
uvicorn main:app --host 0.0.0.0 --port 5000