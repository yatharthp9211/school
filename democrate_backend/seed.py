"""Provision admin + teacher accounts out-of-band.

Never hardcode credentials. Reads from env (or .env):
  DEMOCRATE_ADMIN_USER / DEMOCRATE_ADMIN_PASSWORD  — admin account
  DEMOCRATE_SEED_PASSWORD                          — password for seeded teachers
If DEMOCRATE_SEED_PASSWORD is unset, random passwords are generated and printed.

Idempotent: existing users are left untouched.
"""
import os
import secrets

from dotenv import load_dotenv

from database import SessionLocal
from models import User, Role
from security import get_password_hash

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

db = SessionLocal()

TEACHERS = [
    {"id": "T-101", "name": "Mrs. Sharma", "subject": "Mathematics"},
    {"id": "T-102", "name": "Mr. Verma", "subject": "Science"},
    {"id": "T-103", "name": "Ms. Gupta", "subject": "English"},
]

# Known weak/default values seed.py refuses to assign to the admin account.
_WEAK_PASSWORDS = {
    "democrate", "democrate@2026", "democrate2026", "admin", "admin123",
    "password", "password123", "12345678", "teacher", "school", "abc12345",
}


def _upsert_user(user_id, name, role, password, details=None) -> bool:
    existing = db.query(User).filter(User.id == user_id).first()
    if existing:
        return False
    db.add(
        User(
            id=user_id,
            name=name,
            role=role,
            hashed_password=get_password_hash(password),
            details=details,
        )
    )
    return True


def seed_admin():
    user = os.getenv("DEMOCRATE_ADMIN_USER")
    password = os.getenv("DEMOCRATE_ADMIN_PASSWORD")
    if not (user and password):
        print("SKIP admin: set DEMOCRATE_ADMIN_USER / DEMOCRATE_ADMIN_PASSWORD to provision an admin.")
        return
    if len(password) < 8:
        print("SKIP admin: DEMOCRATE_ADMIN_PASSWORD must be at least 8 characters.")
        return
    if password.lower() in _WEAK_PASSWORDS:
        print("SKIP admin: DEMOCRATE_ADMIN_PASSWORD is a known weak/default value. Choose a strong password.")
        return
    created = _upsert_user(user, "System Administrator", Role.ADMIN, password, "System Administrator")
    print(f"Admin '{user}': {'created' if created else 'already exists'}")


def seed_teachers():
    password = os.getenv("DEMOCRATE_SEED_PASSWORD")
    if password:
        # A shared password means all seeded teachers share one credential —
        # convenient for the pilot, but the audit trail can't distinguish who
        # acted. Fine for a demo; change to per-teacher passwords before launch.
        print("NOTE: DEMOCRATE_SEED_PASSWORD is set — all seeded teachers share this password.")
    for t in TEACHERS:
        pw = password or secrets.token_urlsafe(12)
        created = _upsert_user(
            t["id"],
            t["name"],
            Role.TEACHER,
            pw,
            '{"subject": "%s"}' % t["subject"],
        )
        print(f"Teacher '{t['name']}' ({t['id']}): {'created' if created else 'already exists'}"
              f"{'' if password else f'  password={pw}'}")


def seed_developer():
    user = os.getenv("DEMOCRATE_DEVELOPER_USER")
    password = os.getenv("DEMOCRATE_DEVELOPER_PASSWORD")
    if not (user and password):
        print("SKIP developer: set DEMOCRATE_DEVELOPER_USER / DEMOCRATE_DEVELOPER_PASSWORD to provision a developer.")
        return
    if len(password) < 8:
        print("SKIP developer: DEMOCRATE_DEVELOPER_PASSWORD must be at least 8 characters.")
        return
    if password.lower() in _WEAK_PASSWORDS:
        print("SKIP developer: DEMOCRATE_DEVELOPER_PASSWORD is a known weak/default value. Choose a strong password.")
        return
    created = _upsert_user(user, "System Developer", Role.DEVELOPER, password, "System Developer")
    print(f"Developer '{user}': {'created' if created else 'already exists'}")


if __name__ == "__main__":
    seed_admin()
    seed_teachers()
    seed_developer()
    db.commit()
    print("Seed complete.")
