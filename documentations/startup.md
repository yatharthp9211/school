# Democrate Server Startup Guide (Termux / Mobile Testing)

This guide provides the commands needed to run the Democrate application from the `master` stable branch on Termux. 

## 1. Test the New Version

Run these commands in your project root folder in Termux to fetch the latest changes, switch branches, and spin up the servers.

```bash
# Fetch latest changes and pull from master
git fetch origin
git checkout master
git pull origin master

# Start the Frontend Server (Nginx)
cd democrate_frontend
cp -r * $PREFIX/share/nginx/html/
nginx

# Start the Backend Server (FastAPI)
cd ../democrate_backend
source venv/bin/activate
uvicorn main:app --host 127.0.0.1 --port 8000 --proxy-headers --forwarded-allow-ips="*" &

# Start Cloudflare Tunnel in background (To expose it to the internet securely)
cloudflared tunnel --url http://127.0.0.1:8080 run --token eyJhIjoiOTE2MDFiZGRlNzZiMDYwMTZlNDI1NGRiZTczZWYwOGIiLCJzIjoiRnd0T1FSRzR6N2FFTFZTRi8xczJmenhpODJtdllqdVpSYnIwd054YVRCST0iLCJ0IjoiNmEzN2VhYjEtMzFmZC00ZjhhLWI4ZjYtNTQ1MjQ1MjU5MGNiIn0= &
```

*(You can then access your site securely via your Cloudflare domain: `https://yatharthpandey.dpdns.org`)*

---

## 2. Stopping the Servers

If you need to kill the running servers to update code or rollback:

```bash
# Kill the running python backend and cloudflare tunnel
pkill -f uvicorn
pkill -f cloudflared

# Stop Nginx
nginx -s stop
```
