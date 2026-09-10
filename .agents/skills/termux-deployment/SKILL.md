---
name: termux-deployment
description: Stops existing servers, pulls the latest code from GitHub, and restarts Nginx, Uvicorn, and Cloudflared for the Democrate application on Termux.
---
# Democrate Termux Deployment Skill

This skill is used to deploy or restart the Democrate production environment on Termux.

## Trigger
Use this skill when the user asks to "deploy", "restart the server", "pull the latest code", or "update the site" on the mobile Termux agent.

## Steps

### 1. Stop Existing Servers
Before starting new instances, you must forcefully stop the old ones. Execute these commands sequentially via `run_command`:
```bash
pkill -f uvicorn
pkill -f cloudflared
nginx -s stop
```
*(Ignore errors if the processes were not running).*

### 2. Pull Latest Code
Navigate to the root of the project (`school/`) and pull the latest `master` branch.
```bash
git fetch origin
git checkout master
git pull origin master
```

### 3. Deploy Frontend (Nginx)
Copy the updated frontend files to the Nginx HTML directory and start Nginx:
```bash
cd democrate_frontend
cp -r * $PREFIX/share/nginx/html/
nginx
cd ..
```

### 4. Start Backend (FastAPI / Uvicorn)
Start the backend server in the background:
```bash
cd democrate_backend
source venv/bin/activate
nohup uvicorn main:app --host 127.0.0.1 --port 8000 --proxy-headers --forwarded-allow-ips="*" > uvicorn.log 2>&1 &
cd ..
```

### 5. Start Cloudflare Tunnel
Expose the local Nginx instance to the internet securely in the background:
```bash
nohup cloudflared tunnel --url http://127.0.0.1:8080 run --token eyJhIjoiOTE2MDFiZGRlNzZiMDYwMTZlNDI1NGRiZTczZWYwOGIiLCJzIjoiRnd0T1FSRzR6N2FFTFZTRi8xczJmenhpODJtdllqdVpSYnIwd054YVRCST0iLCJ0IjoiNmEzN2VhYjEtMzFmZC00ZjhhLWI4ZjYtNTQ1MjQ1MjU5MGNiIn0= > cloudflared.log 2>&1 &
```

## Completion
Once all commands have been successfully executed, inform the user that the site has been successfully updated and is live at `https://yatharthpandey.dpdns.org`.
