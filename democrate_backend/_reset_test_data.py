"""Delete all e2e test data from the DB (test users + their rows).

Run before and after the verification suite so the DB returns to its
seeded/legit state. Safe: only touches ids matching the e2e prefixes.
"""
from sqlalchemy import or_
from database import SessionLocal
from models import User, Complaint, Vote, TeacherRating, AuditLog

PREFIXES = ("e2e_", "dvote_", "should_be_student")


def _is_test(user_id: str) -> bool:
    return bool(user_id) and any(user_id.startswith(p) for p in PREFIXES)


db = SessionLocal()

test_user_ids = [u.id for u in db.query(User).all() if _is_test(u.id)]
print("test users:", test_user_ids)

if test_user_ids:
    # First, reset discipline flags on test users so they aren't stuck as banned
    # for subsequent test runs (the test creates fresh users but old banned flags persist).
    db.query(User).filter(User.id.in_(test_user_ids)).update(
        {"is_banned": False, "false_count": 0, "is_active": True},
        synchronize_session=False,
    )
    db.commit()

    # Child rows first.
    db.query(Vote).filter(Vote.user_id.in_(test_user_ids)).delete(synchronize_session=False)
    db.query(TeacherRating).filter(
        or_(TeacherRating.student_id.in_(test_user_ids), TeacherRating.teacher_id.in_(test_user_ids))
    ).delete(synchronize_session=False)
    db.query(Complaint).filter(
        or_(
            Complaint.author_id.in_(test_user_ids),
            Complaint.verifier_teacher.in_(test_user_ids),
            Complaint.target_teacher.in_(test_user_ids),
        )
    ).delete(synchronize_session=False)
    db.query(AuditLog).filter(
        or_(AuditLog.user_id.in_(test_user_ids), AuditLog.target.in_(test_user_ids))
    ).delete(synchronize_session=False)
    db.query(User).filter(User.id.in_(test_user_ids)).delete(synchronize_session=False)
    db.commit()
    print("cleaned.")
else:
    print("nothing to clean.")

# Reset the author discipline counters on the legit accounts (test ran before).
for uid in ("e2e_student",):
    pass
db.close()
