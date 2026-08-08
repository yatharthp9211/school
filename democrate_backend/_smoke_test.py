"""Isolated smoke test: boots uvicorn on a temp DB + temp secret, exercises the
login/complaint/score chain via stdlib HTTP. Deletes its temp DB on exit."""
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
TMPDB = os.path.join(ROOT, "_smoke_test.db")
PORT = "8010"
BASE = f"http://127.0.0.1:{PORT}/api/v1"

if os.path.exists(TMPDB):
    os.remove(TMPDB)

env = dict(os.environ)
env.update({
    "DEMOCRATE_DATABASE_URL": f"sqlite:///{TMPDB}",
    "DEMOCRATE_SECRET_KEY": "smoke-test-secret-0123456789-abcdefghijklmnopqrstuvwxyz",
    "DEMOCRATE_TEACHER_KEY": "test-key-123",
    "DEMOCRATE_ADMIN_PASSWORD": "",
    "DEMOCRATE_TOKEN_TTL_MINUTES": "60",
})

# Create schema in the temp DB using a fresh subprocess with the temp env.
schema = subprocess.run(
    [sys.executable, "-c",
     "import models; from database import engine; models.Base.metadata.create_all(engine)"],
    env=env, capture_output=True, cwd=ROOT, text=True,
)
if schema.returncode != 0:
    print("schema setup failed:\n", schema.stderr)
    sys.exit(1)

proc = subprocess.Popen(
    [sys.executable, "-m", "uvicorn", "main:app", "--port", PORT, "--log-level", "warning"],
    env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, cwd=ROOT,
)

failures = []


def call(method, path, body=None, token=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            raw = r.read()
            return r.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw) if raw else {}
        except Exception:
            return e.code, {}


def check(label, cond, extra=""):
    print(("PASS" if cond else "FAIL"), "-", label, ("| " + str(extra)) if extra else "")
    if not cond:
        failures.append(label)


try:
    # Wait for readiness.
    ready = False
    for _ in range(80):
        if proc.poll() is not None:
            print("uvicorn exited early:\n", proc.stdout.read())
            sys.exit(1)
        try:
            # A protected endpoint returning 401 proves the server is up and
            # the auth chain is wired (there is no bare /api/v1/ route).
            st, _ = call("GET", "/complaints")
            if st in (401, 200):
                ready = True
                break
        except Exception:
            time.sleep(0.5)
    check("server boots", ready)

    # Register student + teacher, login.
    st, r = call("POST", "/auth/register", {"id": "S-TEST1", "name": "Test Student", "password": "Student@123", "details": "Class 9A"})
    check("register student", st == 200, r)
    st, r = call("POST", "/auth/register/teacher", {"id": "T-TEST1", "name": "Test Teacher", "password": "Teacher@123", "subject": "Maths", "registration_key": "test-key-123"})
    check("register teacher", st == 200, r)

    st, bad = call("POST", "/auth/login", {"username": "S-TEST1", "password": "wrongpass", "role": "student"})
    check("wrong password -> 401 (no session nuke)", st == 401 and "Incorrect" in str(bad.get("detail", "")), bad)

    st, login = call("POST", "/auth/login", {"username": "S-TEST1", "password": "Student@123", "role": "student"})
    token = login.get("access_token", "")
    check("login ok", st == 200 and bool(token) and login.get("user", {}).get("role") == "student", login)

    st, me = call("GET", "/auth/me", token=token)
    check("auth/me ok", st == 200 and me.get("id") == "S-TEST1", me)

    # Submit a private complaint -> MODERATED; response must carry a real score.
    st, c = call("POST", "/complaints", {"text": "This is a test complaint body that is long enough.", "category": "Academic", "is_private": True}, token=token)
    check("submit complaint", st == 200 and c.get("status") == "moderated", c)
    check("score serialized as int (fix verified)", isinstance(c.get("score"), int) and c.get("score") == 0, c.get("score"))

    st, mine = call("GET", "/complaints/mine", token=token)
    check("my complaints ok", st == 200 and len(mine) == 1 and isinstance(mine[0].get("score"), int), mine)

    # Bad token is rejected cleanly (401, not 500).
    st, _ = call("GET", "/auth/me", token="garbage.token.value")
    check("bad token -> 401", st == 401)
finally:
    proc.terminate()
    try:
        proc.wait(timeout=5)
    except Exception:
        proc.kill()
    # SQLite may still hold a handle briefly after the process exits — retry.
    for _ in range(5):
        try:
            if os.path.exists(TMPDB):
                os.remove(TMPDB)
            break
        except PermissionError:
            time.sleep(0.3)

print("\n" + ("ALL PASS" if not failures else f"{len(failures)} FAILURES: {failures}"))
sys.exit(1 if failures else 0)
