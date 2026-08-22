from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List
import models
import schemas
import crud
import audit
from database import get_db
from config import settings
from dependencies import (
    get_current_user,
    get_current_active_student,
    get_current_active_teacher,
    client_ip,
)

router = APIRouter()

MAX_PAGE = 100


def _page(skip: int, limit: int) -> tuple[int, int]:
    return max(skip, 0), min(max(limit, 1), MAX_PAGE)


def _serialize_complaint(complaint: models.Complaint, user_id: str) -> schemas.ComplaintResponse:
    resp = schemas.ComplaintResponse.model_validate(complaint)
    resp.is_author = (complaint.author_id == user_id)
    return resp

def _serialize_complaints(complaints: List[models.Complaint], user_id: str) -> List[schemas.ComplaintResponse]:
    return [_serialize_complaint(c, user_id) for c in complaints]


@router.post("", response_model=schemas.ComplaintResponse)
def create_complaint(
    complaint_in: schemas.ComplaintCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_student),
):
    if current_user.is_banned:
        raise HTTPException(status_code=403, detail="Your account has been restricted from submitting complaints.")

    # Conflict-of-interest: a teacher cannot be asked to verify a complaint about themselves.
    if complaint_in.target_teacher and complaint_in.verifier_teacher:
        if complaint_in.target_teacher == complaint_in.verifier_teacher:
            raise HTTPException(
                status_code=400,
                detail="The selected verifier teacher cannot verify a complaint about themselves.",
            )
    if complaint_in.verifier_teacher:
        verifier = crud.get_user(db, complaint_in.verifier_teacher)
        if not verifier or verifier.role != models.Role.TEACHER:
            raise HTTPException(status_code=400, detail="Verifier must be an existing teacher.")
    if complaint_in.target_teacher:
        target = crud.get_user(db, complaint_in.target_teacher)
        if not target or target.role != models.Role.TEACHER:
            raise HTTPException(status_code=400, detail="Target teacher must be an existing teacher.")

    complaint = crud.create_complaint(db=db, complaint=complaint_in, author=current_user)
    audit.log_action(db, current_user.id, audit.COMPLAINT_CREATED, target=complaint.id,
                     details=f"category={complaint.category} private={complaint.is_private}",
                     ip=client_ip(request))
    return _serialize_complaint(complaint, current_user.id)


@router.get("", response_model=List[schemas.ComplaintResponse])
def read_complaints(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Role-aware feed. Never leaks private or unverified complaints beyond scope."""
    skip, limit = _page(skip, limit)
    if current_user.role == models.Role.ADMIN:
        complaints = crud.get_all_complaints(db, skip=skip, limit=limit)
    elif current_user.role == models.Role.TEACHER:
        complaints = crud.get_teacher_feed(db, current_user.id, skip=skip, limit=limit)
    else:
        complaints = crud.get_public_feed(db, skip=skip, limit=limit)
    return _serialize_complaints(complaints, current_user.id)


@router.get("/mine", response_model=List[schemas.ComplaintResponse])
def my_complaints(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """The current user's own complaints, resolved via author_id (server-side)."""
    skip, limit = _page(skip, limit)
    complaints = crud.get_my_complaints(db, current_user.id, skip=skip, limit=limit)
    return _serialize_complaints(complaints, current_user.id)


@router.post("/{complaint_id}/vote")
def vote_complaint(
    complaint_id: str,
    vote_in: schemas.VoteCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    complaint = crud.get_complaint(db, complaint_id)
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    # Banned accounts cannot vote; admins moderate instead of voting (their vote
    # would pollute the student/teacher moderation signals).
    if current_user.is_banned:
        raise HTTPException(status_code=403, detail="Your account has been restricted from voting.")
    if current_user.role == models.Role.ADMIN:
        raise HTTPException(status_code=400, detail="Administrators cannot vote.")

    # State machine: only verified, public complaints accept votes.
    if complaint.status not in (models.ComplaintStatus.PUBLISHED, models.ComplaintStatus.VOTING):
        raise HTTPException(status_code=400, detail=f"Voting is not allowed on {complaint.status.value} complaints.")

    # Self-vote prevention.
    if complaint.author_id and complaint.author_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot vote on your own complaint.")

    weight = settings.TEACHER_VOTE_WEIGHT if current_user.role == models.Role.TEACHER else 1
    try:
        crud.create_vote(db, complaint, current_user, vote_in.type, weight)
    except crud.DuplicateVoteError:
        raise HTTPException(status_code=400, detail="Already voted on this complaint.")

    audit.log_action(db, current_user.id, audit.VOTE_CAST, target=complaint.id,
                     details=f"type={vote_in.type.value}", ip=client_ip(request))

    # Votes are a moderation *signal*, not a verdict: crossing the threshold only
    # flags the complaint for admin review. No identity exposure, no automatic penalty.
    if (
        complaint.status in (models.ComplaintStatus.PUBLISHED, models.ComplaintStatus.VOTING)
        and complaint.score <= settings.FALSE_SCORE_THRESHOLD
    ):
        complaint.status = models.ComplaintStatus.FLAGGED
        db.commit()
        audit.log_action(db, None, audit.COMPLAINT_FLAGGED, target=complaint.id,
                         details=f"score={complaint.score}", ip=client_ip(request))

    return {"success": True, "message": "Vote recorded"}


@router.post("/verify/{complaint_id}")
def verify_complaint(
    complaint_id: str,
    verify_in: schemas.VerifyRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_teacher),
):
    complaint = crud.get_complaint(db, complaint_id)
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    # Only the assigned verifier may approve/reject; they can never review a
    # complaint about themselves (enforced again at the DB-author level).
    if complaint.verifier_teacher != current_user.id:
        raise HTTPException(status_code=403, detail="You are not the assigned verifier for this complaint.")

    if complaint.status != models.ComplaintStatus.PENDING:
        raise HTTPException(status_code=400, detail=f"Cannot verify a {complaint.status.value} complaint.")

    if verify_in.action == "approve":
        complaint.status = models.ComplaintStatus.PUBLISHED
        audit.log_action(db, current_user.id, audit.COMPLAINT_VERIFIED, target=complaint.id,
                         ip=client_ip(request))
    elif verify_in.action == "reject":
        complaint.status = models.ComplaintStatus.ARCHIVED
        audit.log_action(db, current_user.id, audit.COMPLAINT_REJECTED, target=complaint.id,
                         ip=client_ip(request))
    else:
        raise HTTPException(status_code=400, detail="action must be 'approve' or 'reject'")

    db.commit()
    return {"success": True, "status": complaint.status.value}
