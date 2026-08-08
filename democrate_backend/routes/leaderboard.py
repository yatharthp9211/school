from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
import json
import models
from database import get_db

router = APIRouter()


@router.get("")
def get_leaderboard(db: Session = Depends(get_db)):
    teachers = (
        db.query(models.User)
        .filter(models.User.role == models.Role.TEACHER, models.User.is_active.is_(True))
        .all()
    )

    leaderboard = []
    for t in teachers:
        ratings = (
            db.query(models.TeacherRating)
            .filter(models.TeacherRating.teacher_id == t.id)
            .all()
        )
        avg_rating = round(sum(r.rating for r in ratings) / len(ratings), 1) if ratings else 0.0
        total_ratings = len(ratings)

        # Complaints this teacher verified and are live (not admin-confirmed false).
        verified = (
            db.query(models.Complaint)
            .filter(
                models.Complaint.verifier_teacher == t.id,
                models.Complaint.status.in_(
                    [models.ComplaintStatus.PUBLISHED, models.ComplaintStatus.VOTING,
                     models.ComplaintStatus.RESOLVED]
                ),
                models.Complaint.is_false.is_(False),
            )
            .count()
        )

        # Penalty = complaints this teacher verified that an admin later found false.
        penalty = (
            db.query(models.Complaint)
            .filter(
                models.Complaint.verifier_teacher == t.id,
                models.Complaint.is_false.is_(True),
            )
            .count()
        )

        subject = t.details or "Teacher"
        photo = None
        try:
            parsed = json.loads(t.details)
            if isinstance(parsed, dict):
                subject = parsed.get("subject") or subject
                photo = parsed.get("photo") or None
        except (json.JSONDecodeError, TypeError):
            pass  # details is a plain string (subject)

        leaderboard.append({
            "id": t.id,
            "name": t.name,
            "subject": subject,
            "rating": avg_rating,
            "totalRatings": total_ratings,
            "verifiedComplaints": verified,
            "penaltyCount": penalty,
            "rank": 0,
            "photo": photo,
        })

    # Sort: higher rating first, fewer penalties better.
    leaderboard.sort(key=lambda x: (x["rating"], -x["penaltyCount"]), reverse=True)
    for i, t in enumerate(leaderboard):
        t["rank"] = i + 1

    return leaderboard
