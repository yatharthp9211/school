from fastapi import APIRouter, Depends
from sqlalchemy import func
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
    ids = [t.id for t in teachers]

    # Aggregate all per-teacher stats in 3 queries total (GROUP BY) instead of
    # 3 queries per teacher (N+1 — was 1 + 3×teacher_count round-trips).
    ratings_agg, verified_agg, penalty_agg = {}, {}, {}
    if ids:
        ratings_agg = {
            row[0]: (row[1], row[2])
            for row in (
                db.query(
                    models.TeacherRating.teacher_id,
                    func.count(models.TeacherRating.id),
                    func.avg(models.TeacherRating.rating),
                )
                .filter(models.TeacherRating.teacher_id.in_(ids))
                .group_by(models.TeacherRating.teacher_id)
                .all()
            )
        }
        verified_agg = dict(
            db.query(
                models.Complaint.verifier_teacher,
                func.count(models.Complaint.id),
            )
            .filter(
                models.Complaint.verifier_teacher.in_(ids),
                models.Complaint.status.in_(
                    [models.ComplaintStatus.PUBLISHED, models.ComplaintStatus.VOTING,
                     models.ComplaintStatus.RESOLVED]
                ),
                models.Complaint.is_false.is_(False),
            )
            .group_by(models.Complaint.verifier_teacher)
            .all()
        )
        penalty_agg = dict(
            db.query(
                models.Complaint.verifier_teacher,
                func.count(models.Complaint.id),
            )
            .filter(
                models.Complaint.verifier_teacher.in_(ids),
                models.Complaint.is_false.is_(True),
            )
            .group_by(models.Complaint.verifier_teacher)
            .all()
        )

    leaderboard = []
    for t in teachers:
        total_ratings, avg = ratings_agg.get(t.id, (0, 0.0))
        avg_rating = round(float(avg), 1) if total_ratings else 0.0
        verified = verified_agg.get(t.id, 0)
        penalty = penalty_agg.get(t.id, 0)

        subject = t.subject or "Teacher"
        photo = t.image

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
