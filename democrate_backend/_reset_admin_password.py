"""Reset the admin account's password.

Usage (on the deployment, from the backend dir):
    python _reset_admin_password.py "NewStrongPassword@123"

or set DEMOCRATE_ADMIN_PASSWORD in .env and run:
    python _reset_admin_password.py

The current admin account was provisioned with a known test password
(Democrate@2026) — run this before launch.
"""
import os
import sys

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

from database import SessionLocal
from models import User, Role
from security import get_password_hash

_WEAK = {"democrate@2026", "democrate", "admin", "admin123", "password", "password123", "12345678"}

pw = os.getenv("DEMOCRATE_ADMIN_PASSWORD") or (sys.argv[1] if len(sys.argv) > 1 else "")
if len(pw) < 12:
    print("SKIP: password must be at least 12 characters.")
    sys.exit(1)
if not any(c.isupper() for c in pw) or not any(c.isdigit() for c in pw) or pw.lower() in _WEAK:
    print("SKIP: password needs an uppercase letter, a digit, and must not be a known weak value.")
    sys.exit(1)

db = SessionLocal()
admin = db.query(User).filter(User.role == Role.ADMIN).first()
if not admin:
    print("No admin account found — provision one with seed.py first.")
    sys.exit(1)

admin.hashed_password = get_password_hash(pw)
db.commit()
print(f"Admin '{admin.id}' password updated.")
