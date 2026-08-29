from datetime import datetime, timezone
import json
import secrets

from sqlalchemy import or_
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

import models
import schemas
from config import settings
from security import get_password_hash


class DuplicateVoteError(Exception):
    pass


def generate_anonymous_id() -> str:
    """Random, per-complaint public identifier. Unique per row so it cannot be
    used to correlate complaints back to a single author."""
    return f"ANON-{secrets.token_hex(4).upper()}"


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------


def get_user(db: Session, user_id: str):
    return db.query(models.User).filter(models.User.id == user_id).first()


def get_class_teacher(db: Session, class_name: str, section_name: str):
    return db.query(models.User).filter(
        models.User.role == models.Role.TEACHER,
        models.User.is_class_teacher == True,
        models.User.class_name == class_name,
        models.User.section_name == section_name
    ).first()


def create_student(db: Session, data: schemas.RegisterStudent) -> models.User:
    return _create_user(
        db=db, 
        user_id=data.id, 
        name=data.name, 
        password=data.password, 
        role=models.Role.STUDENT,
        class_name=data.class_name,
        section_name=data.section_name,
        subject="NA",
        is_class_teacher=False
    )


def create_teacher(db: Session, data: schemas.RegisterTeacher) -> models.User:
    user = _create_user(
        db=db, 
        user_id=data.id, 
        name=data.name, 
        password=data.password, 
        role=models.Role.TEACHER,
        class_name=data.class_name if data.is_class_teacher else "NA",
        section_name=data.section_name if data.is_class_teacher else "NA",
        subject=data.subject,
        is_class_teacher=data.is_class_teacher
    )
    if data.photo:
        user.image = data.photo
        db.commit()
    return user


def _create_user(db, user_id, name, password, role, class_name, section_name, subject, is_class_teacher) -> models.User:
    user = models.User(
        id=user_id,
        name=name,
        role=role,
        hashed_password=get_password_hash(password),
        class_name=class_name,
        section_name=section_name,
        subject=subject,
        is_class_teacher=is_class_teacher,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# ---------------------------------------------------------------------------
# Complaints
# ---------------------------------------------------------------------------


def get_class_group(class_name: str) -> str:
    if class_name in ["nursery", "LKG", "UKG"]:
        return "pre-primary"
    if class_name in ["1", "2", "3", "4", "5"]:
        return "primary"
    if class_name in ["6", "7", "8"]:
        return "upper-primary"
    if class_name in ["9", "10", "11", "12"]:
        return "secondary"
    return "other"

def create_complaint(db: Session, complaint: schemas.ComplaintCreate, author: models.User) -> models.Complaint:
    is_private = bool(complaint.is_private)
    db_complaint = models.Complaint(
        id=f"CMP-{secrets.token_hex(3).upper()}",
        author_id=author.id,
        anonymous_id=generate_anonymous_id(),
        text=complaint.text,
        target_teacher=complaint.target_teacher,
        verifier_teacher=complaint.verifier_teacher if not is_private else None,
        category=complaint.category,
        class_group=get_class_group(author.class_name),
        is_private=is_private,
        # Public complaints await teacher verification; private go straight to admin.
        status=models.ComplaintStatus.MODERATED if is_private else models.ComplaintStatus.PENDING,
    )
    db.add(db_complaint)
    db.commit()
    db.refresh(db_complaint)
    return db_complaint


def get_complaint(db: Session, complaint_id: str):
    return db.query(models.Complaint).filter(models.Complaint.id == complaint_id).first()


def get_my_complaints(db: Session, author_id: str, skip: int = 0, limit: int = 100):
    return (
        db.query(models.Complaint)
        .filter(models.Complaint.author_id == author_id)
        .order_by(models.Complaint.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_public_feed(db: Session, skip: int = 0, limit: int = 100, class_group: str | None = None):
    """Verified, non-private complaints (students / general feed)."""
    q = db.query(models.Complaint).filter(
        models.Complaint.is_private.is_(False),
        models.Complaint.status.in_(
            [models.ComplaintStatus.PUBLISHED, models.ComplaintStatus.VOTING,
             models.ComplaintStatus.RESOLVED]
        ),
    )
    if class_group:
        q = q.filter(models.Complaint.class_group == class_group)
    return q.order_by(models.Complaint.created_at.desc()).offset(skip).limit(limit).all()


def get_teacher_feed(db: Session, teacher_id: str, skip: int = 0, limit: int = 100, class_group: str | None = None):
    """Teacher sees: their OWN assigned pending verification queue + the public feed.

    Pending complaints are private to their assigned verifier. Without this the
    `teacher_id` argument was ignored and every teacher saw the whole pending
    queue (a leak of unreviewed complaints across teachers).
    """
    q = db.query(models.Complaint).filter(
        models.Complaint.is_private.is_(False),
        models.Complaint.status.in_(
            [models.ComplaintStatus.PENDING, models.ComplaintStatus.PUBLISHED,
             models.ComplaintStatus.VOTING, models.ComplaintStatus.RESOLVED]
        ),
        # Live complaints are shared; PENDING ones only with their verifier.
        or_(
            models.Complaint.status != models.ComplaintStatus.PENDING,
            models.Complaint.verifier_teacher == teacher_id,
        ),
    )
    if class_group:
        q = q.filter(models.Complaint.class_group == class_group)
    return q.order_by(models.Complaint.created_at.desc()).offset(skip).limit(limit).all()


def get_all_complaints(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    status: str | None = None,
    category: str | None = None,
    class_group: str | None = None,
):
    """Admin view: everything, including private and flagged."""
    q = db.query(models.Complaint).order_by(models.Complaint.created_at.desc())
    if status:
        q = q.filter(models.Complaint.status == status.lower())
    if category:
        q = q.filter(models.Complaint.category == category)
    if class_group:
        q = q.filter(models.Complaint.class_group == class_group)
    return q.offset(skip).limit(limit).all()


def get_flagged_complaints(db: Session):
    return (
        db.query(models.Complaint)
        .filter(models.Complaint.status == models.ComplaintStatus.FLAGGED)
        .order_by(models.Complaint.created_at.desc())
        .all()
    )


def get_false_complaints(db: Session):
    return (
        db.query(models.Complaint)
        .filter(models.Complaint.is_false.is_(True))
        .order_by(models.Complaint.created_at.desc())
        .all()
    )


# ---------------------------------------------------------------------------
# Voting
# ---------------------------------------------------------------------------


def create_vote(
    db: Session,
    complaint: models.Complaint,
    user: models.User,
    vote_type: models.VoteType,
    weight: int = 1,
) -> models.Vote:
    """Insert a vote atomically. The UNIQUE(complaint_id, user_id) constraint is
    the final authority against duplicate votes (race-safe)."""
    existing = (
        db.query(models.Vote)
        .filter(
            models.Vote.complaint_id == complaint.id,
            models.Vote.user_id == user.id,
        )
        .first()
    )
    if existing:
        raise DuplicateVoteError()

    db_vote = models.Vote(
        complaint_id=complaint.id,
        user_id=user.id,
        vote_type=vote_type,
        weight=weight,
    )
    db.add(db_vote)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise DuplicateVoteError()

    # Update the aggregate counters on the Complaint row.
    if weight == settings.TEACHER_VOTE_WEIGHT:  # Teacher vote (×10)
        if vote_type == models.VoteType.UPVOTE:
            complaint.teacher_up = (complaint.teacher_up or 0) + 1
        else:
            complaint.teacher_down = (complaint.teacher_down or 0) + 1
    else:  # Student vote (×1)
        if vote_type == models.VoteType.UPVOTE:
            complaint.student_up = (complaint.student_up or 0) + 1
        else:
            complaint.student_down = (complaint.student_down or 0) + 1

    db.commit()
    db.refresh(db_vote)
    return db_vote


# ---------------------------------------------------------------------------
# Ratings
# ---------------------------------------------------------------------------


def _apply_rating(existing: models.TeacherRating, rating: schemas.RatingCreate) -> None:
    """Write the submitted rating fields onto a row and stamp it. Shared by the
    pre-check and the post-IntegrityError retry so the two update paths can't drift."""
    existing.rating = rating.rating
    existing.tags = rating.tags
    existing.timestamp = datetime.now(timezone.utc)


def create_or_update_rating(
    db: Session,
    rating: schemas.RatingCreate,
    student_id: str,
) -> models.TeacherRating:
    """One rating per (teacher, student). Submitting again updates it."""
    existing = (
        db.query(models.TeacherRating)
        .filter(
            models.TeacherRating.teacher_id == rating.teacher_id,
            models.TeacherRating.student_id == student_id,
        )
        .first()
    )
    if existing:
        _apply_rating(existing, rating)
        db.commit()
        db.refresh(existing)
        return existing

    db_rating = models.TeacherRating(
        teacher_id=rating.teacher_id,
        student_id=student_id,
        rating=rating.rating,
        tags=rating.tags,
    )
    db.add(db_rating)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = (
            db.query(models.TeacherRating)
            .filter(
                models.TeacherRating.teacher_id == rating.teacher_id,
                models.TeacherRating.student_id == student_id,
            )
            .first()
        )
        if existing:
            _apply_rating(existing, rating)
            db.commit()
            db.refresh(existing)
            return existing
        raise
    db.refresh(db_rating)
    return db_rating
