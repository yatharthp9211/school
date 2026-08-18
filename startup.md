# Democrate Server Startup Guide (Termux / Mobile Testing)

This guide provides the commands needed to run the Democrate application from the `mk2` testing branch on Termux, as well as the rollback instructions if you need to revert to the stable `main` branch.

## 1. Test the New Version (`mk2` branch)

Run these commands in your project root folder in Termux to fetch the latest changes, switch branches, and spin up both servers in the background.

```bash
# Fetch latest changes and switch to the mk2 branch
git fetch origin
git checkout mk2
git pull origin mk2

# Start the Backend Server (Termux uses Linux commands)
cd democrate_backend
python -m uvicorn main:app --host 0.0.0.0 --port 5000 &

# Start the Frontend Server in the background
cd ../democrate_frontend
python -m http.server 8080 &
```

*(You can then open your mobile browser and navigate to `http://localhost:8080` or your computer's local network IP).*

---

## 2. Rollback to Stable Version (`main` branch)

If the new scripts fail before deployment and you need to immediately revert to the stable production code, run these commands to kill the running servers, switch back to `main`, and restart the old version.

```bash
# Kill the running python servers
pkill -f uvicorn
pkill -f http.server

# Switch back to your stable main branch
git checkout main
git pull origin main

# Restart the old stable servers
cd democrate_backend
python -m uvicorn main:app --host 0.0.0.0 --port 5000 &

cd ../democrate_frontend
python -m http.server 8080 &
```
