"""End-to-end verification for the Democrate hardening (Phase 4).

Server must run with DEMOCRATE_TEACHER_KEY=school-test-key-2026.
Admin password must already be reset to Democrate@2026.

    python _verify_e2e.py
Exit code 0 = all checks passed.
"""
import json
import sys
import time
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:5000/api/v1"
ADMIN_PW = "Democrate@2026"
TEACHER_KEY = "school-test-key-2026"

passed, failed = [], []


def req(method, path, body=None, token=None):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, json.loads(resp.read() or b"{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or b"{}")
        except Exception:
            return e.code, {}


def check(name, cond, detail=""):
    (passed if cond else failed).append(name)
    print(("PASS  " if cond else "FAIL  ") + name + (f"  — {detail}" if detail and not cond else ""))
    sys.stdout.flush()


def login(uid, pw, role):
    st, r = req("POST", "/auth/login", {"username": uid, "password": pw, "role": role})
    return (r.get("access_token"), st) if st == 200 else (None, st)


def register(uid, name, pw, role, **extra):
    path = "/auth/register" if role == "student" else "/auth/register/teacher"
    body = {"id": uid, "name": name, "password": pw}
    body.update(extra)
    return req("POST", path, body)


# ---------------------------------------------------------------------------
# 0. Prepare accounts (idempotent)
# ---------------------------------------------------------------------------
print("=== 0. Accounts ===")
st, _ = register("e2e_student", "E2E Student", "Student123", "student", details="9A")
check("register student", st in (200, 400), f"st={st}")
st, _ = register("e2e_teacher", "E2E Teacher", "Teacher123", "teacher", subject="Physics", registration_key=TEACHER_KEY)
check("register teacher w/ key", st in (200, 400), f"st={st}")
for i in range(1, 6):
    register(f"dvote_{i}", f"Voter {i}", "Teacher123", "teacher", subject="Voting", registration_key=TEACHER_KEY)

STU, st = login("e2e_student", "Student123", "student")
check("student login", st == 200, f"st={st}")
TEACH, st = login("e2e_teacher", "Teacher123", "teacher")
check("teacher login", st == 200, f"st={st}")
ADMIN, st = login("admin", ADMIN_PW, "admin")
check("admin login (legacy hash)", st == 200, f"st={st}")
VOTERS = []
for i in range(1, 6):
    t, st = login(f"dvote_{i}", "Teacher123", "teacher")
    if st == 200:
        VOTERS.append(t)
check("5 voter teachers logged in", len(VOTERS) == 5, f"{len(VOTERS)}")
OTH = VOTERS[0]

# ---------------------------------------------------------------------------
# 1. Auth hardening
# ---------------------------------------------------------------------------
print("\n=== 1. Auth ===")
st, _ = req("POST", "/auth/login", {"username": "admin", "password": "wrongpass1", "role": "admin"})
check("bad password -> 401", st == 401, f"st={st}")
st, _ = req("POST", "/auth/login", {"username": "admin", "password": ADMIN_PW, "role": "student"})
check("role mismatch -> 400", st == 400, f"st={st}")

uid = "e2e_should_be_student"
st, r = req("POST", "/auth/register", {"id": uid, "name": "Should Be Student", "password": "Student123", "role": "ADMIN"})
check("role:ADMIN ignored (student created)", st in (200, 400) and r.get("role") != "ADMIN", f"st={st} {r}")

# ---------------------------------------------------------------------------
# 2. Conflict of interest + complaint creation
# ---------------------------------------------------------------------------
print("\n=== 2. Complaint creation ===")
st, r = req("POST", "/complaints/", {
    "text": "A sufficiently long report to pass the twenty character minimum test.",
    "category": "Harassment", "target_teacher": "T-101", "verifier_teacher": "T-101",
}, token=STU)
check("verifier == target rejected", st == 400, f"st={st}")

st, r = req("POST", "/complaints/", {
    "text": "Verifier must be a real teacher account that exists.",
    "category": "Harassment", "verifier_teacher": "ghost_teacher",
}, token=STU)
check("nonexistent verifier rejected", st == 400, f"st={st}")

st, priv = req("POST", "/complaints/", {
    "text": "A private report that goes straight to the administration desk.",
    "category": "Safety", "is_private": True,
}, token=STU)
check("private complaint created", st == 200 and priv.get("id"), f"st={st}")
st, fc = req("GET", "/complaints/", token=STU)
check("private absent from public feed", priv.get("id") not in [c["id"] for c in fc], f"{fc[:1]}")

# ---------------------------------------------------------------------------
# 3. State machine + voting integrity
# ---------------------------------------------------------------------------
print("\n=== 3. Voting / state machine ===")
CID = None
st, comp = req("POST", "/complaints/", {
    "text": "The corridor lighting is out and students are navigating in the dark.",
    "category": "Infrastructure", "target_teacher": "T-101", "verifier_teacher": "e2e_teacher",
}, token=STU)
check("public complaint created", st == 200 and comp.get("id"), f"st={st}")
if st == 200:
    CID = comp["id"]
    check("no author_id leaked", "author_id" not in comp, f"{comp}")

    st, _ = req("POST", f"/complaints/{CID}/vote", {"type": "upvote"}, token=STU)
    check("vote on PENDING blocked", st == 400, f"st={st}")

    st, _ = req("POST", f"/complaints/{CID}/vote", {"type": "upvote"}, token=OTH)
    check("vote on PENDING blocked (any user)", st == 400, f"st={st}")

    st, _ = req("POST", f"/complaints/verify/{CID}", {"action": "approve"}, token=OTH)
    check("non-assigned teacher cannot verify", st == 403, f"st={st}")

    st, _ = req("POST", f"/complaints/verify/{CID}", {"action": "approve"}, token=TEACH)
    check("assigned teacher verifies", st == 200, f"st={st}")

    st, _ = req("POST", f"/complaints/{CID}/vote", {"type": "upvote"}, token=STU)
    check("self-vote blocked", st == 400, f"st={st}")

    st, _ = req("POST", f"/complaints/{CID}/vote", {"type": "upvote"}, token=OTH)
    check("valid upvote accepted", st == 200, f"st={st}")
    st, _ = req("POST", f"/complaints/{CID}/vote", {"type": "downvote"}, token=OTH)
    check("duplicate vote blocked", st == 400, f"st={st}")

    st, fc = req("GET", "/complaints/", token=STU)
    check("published appears in public feed", CID in [c["id"] for c in fc], f"{[c['id'] for c in fc]}")

    st, mine = req("GET", "/complaints/mine", token=STU)
    mine_ids = [c["id"] for c in mine]
    check("/mine lists own complaint", CID in mine_ids, f"{mine_ids}")
    check("/mine leaks no author_id", all("author_id" not in c for c in mine), f"{mine}")

# ---------------------------------------------------------------------------
# 4. Moderation: votes are a signal, admin decides
# ---------------------------------------------------------------------------
print("\n=== 4. Moderation flow ===")

def make_flagged(label):
    st, comp = req("POST", "/complaints/", {
        "text": f"Automated moderation scenario {label} — lights out in the lab building repeatedly.",
        "category": "Infrastructure", "target_teacher": "T-102", "verifier_teacher": "e2e_teacher",
    }, token=STU)
    cid = comp.get("id") if st == 200 else None
    req("POST", f"/complaints/verify/{cid}", {"action": "approve"}, token=TEACH)
    for v in VOTERS:  # each teacher downvote = -10; 5 votes -> -50 -> FLAGGED
        req("POST", f"/complaints/{cid}/vote", {"type": "downvote"}, token=v)
    return cid

cA = make_flagged("A")
st, fc = req("GET", "/complaints/", token=STU)
check("flagged absent from public feed", cA not in [c["id"] for c in fc], f"st={st}")

st, flagged = req("GET", "/admin/flagged", token=ADMIN)
entry = next((e for e in flagged if e["complaint"]["id"] == cA), None)
check("flagged list exposes author to admin", entry and entry.get("author", {}).get("id") == "e2e_student", f"{entry}")
st, _ = req("GET", "/admin/flagged", token=STU)
check("student denied admin flagged", st == 403, f"st={st}")

st, r = req("POST", f"/admin/moderate/{cA}", {"action": "legitimate"}, token=ADMIN)
check("moderate legitimate -> published", st == 200 and r.get("status") == "published", f"st={st} {r}")
st, fc = req("GET", "/complaints/", token=STU)
check("restored complaint back in feed", cA in [c["id"] for c in fc], f"st={st}")

cids = [make_flagged("B1"), make_flagged("B2"), make_flagged("B3"), make_flagged("B4"), make_flagged("B5")]
for i, c in enumerate(cids, 1):
    st, r = req("POST", f"/admin/moderate/{c}", {"action": "false"}, token=ADMIN)
    check(f"moderate false #{i}", st == 200 and r.get("status") == "archived", f"st={st} {r}")

st, mine = req("GET", "/complaints/mine", token=STU)
check("false complaints carry is_false", all(c.get("is_false") for c in mine if c["id"] in cids), f"{mine}")
st, r = req("GET", "/auth/me", token=STU)
check("author reached false_count 5", r.get("false_count") == 5 and r.get("is_banned") is True, f"{r}")

st, r = req("POST", "/complaints/", {
    "text": "A banned author trying to file yet another new complaint report here.",
    "category": "Other", "verifier_teacher": "e2e_teacher",
}, token=STU)
check("banned author cannot submit", st == 403, f"st={st}")

st, lb = req("GET", "/leaderboard/")
row = next((t for t in lb if t["id"] == "e2e_teacher"), None)
check("verifier penalty recorded", row and row["penaltyCount"] >= 5, f"{row}")

st, log = req("GET", "/admin/audit", token=ADMIN)
acts = [e["action"] for e in log]
check("audit has COMPLAINT_FALSE", any("complaint_false" in a.lower() for a in acts), f"{acts[:5]}")

# ---------------------------------------------------------------------------
# 5. Ratings (uses the author account; happens before any ban takes effect)
# ---------------------------------------------------------------------------
print("\n=== 5. Ratings ===")
st, r = req("POST", "/ratings/", {"teacher_id": "T-101", "rating": 4, "tags": "Helpful,Clear"}, token=STU)
check("rating submitted", st == 200, f"st={st}")
st, r = req("POST", "/ratings/", {"teacher_id": "T-101", "rating": 6, "tags": "Helpful"}, token=STU)
check("rating >5 rejected", st == 422, f"st={st}")
st, r = req("POST", "/ratings/", {"teacher_id": "T-101", "rating": 2, "tags": "NotAllowed,Helpful"}, token=STU)
check("rating upsert + tag sanitize", st == 200, f"st={st} {r}")
st, lb = req("GET", "/leaderboard/")
row = next((t for t in lb if t["id"] == "T-101"), None)
check("leaderboard reflects rating", row and row["rating"] > 0 and row["totalRatings"] >= 1, f"{row}")

# ---------------------------------------------------------------------------
# 6. Account discipline (rate window reset so these logins don't trip the limiter)
# ---------------------------------------------------------------------------
print("\n=== 6. Account discipline ===")
time.sleep(61)
st, r = req("PUT", "/admin/users/dvote_5/disable", token=ADMIN)
check("admin disables user", st == 200, f"st={st} {r}")
_, st = login("dvote_5", "Teacher123", "teacher")
check("disabled user login blocked", st == 403, f"st={st}")
st, _ = req("PUT", "/admin/users/dvote_5/enable", token=ADMIN)
check("admin re-enables user", st == 200, f"st={st}")
_, st = login("dvote_5", "Teacher123", "teacher")
check("re-enabled user logs in", st == 200, f"st={st}")
st, _ = req("PUT", "/admin/users/admin/disable", token=ADMIN)
check("admin cannot disable self", st == 400, f"st={st}")

# ---------------------------------------------------------------------------
# 7. Rate limiting (dedicated burst)
# ---------------------------------------------------------------------------
print("\n=== 7. Rate limiting ===")
time.sleep(61)  # fresh auth window
throttled = 0
for _ in range(25):
    st, _ = req("POST", "/auth/login", {"username": "admin", "password": "wrongpass1", "role": "admin"})
    if st == 429:
        throttled += 1
check("burst of logins gets throttled (429)", throttled >= 1, f"{throttled}/25 throttled")

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
print("\n===== %d passed, %d failed =====" % (len(passed), len(failed)))
if failed:
    print("FAILED:", failed)
    sys.exit(1)
