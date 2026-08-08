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
    created = _upsert_user(user, "System Administrator", Role.ADMIN, password, "System Administrator")
    print(f"Admin '{user}': {'created' if created else 'already exists'}")


def seed_teachers():
    password = os.getenv("DEMOCRATE_SEED_PASSWORD")
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


if __name__ == "__main__":
    seed_admin()
    seed_teachers()
    db.commit()
    print("Seed complete.")
