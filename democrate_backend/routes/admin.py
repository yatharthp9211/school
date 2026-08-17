from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List, Optional
import models
import schemas
import crud
import audit
from database import get_db
from config import settings
from dependencies import get_current_active_admin, client_ip

router = APIRouter()

MAX_PAGE = 100


def _with_author(db: Session, complaint: models.Complaint) -> dict:
    """Admin-only view of a complaint plus the complainant's identity
    (accountability model — anonymous to everyone except authorized admins
    reviewing a case)."""
    author = crud.get_user(db, complaint.author_id) if complaint.author_id else None
    return {
        "complaint": schemas.ComplaintResponse.model_validate(complaint),
        "author": {
            "id": author.id if author else None,
            "name": author.name if author else None,
        },
    }


@router.get("/complaints", response_model=List[schemas.ComplaintResponse])
def all_complaints(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_admin),
):
    skip, limit = max(skip, 0), min(max(limit, 1), MAX_PAGE)
    return crud.get_all_complaints(db, skip=skip, limit=limit, status=status, category=category)


@router.get("/flagged")
def flagged_complaints(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_admin),
):
    """Complaints awaiting moderation review (score <= threshold). Admin sees
    the complainant's identity here — this is the *only* legitimate reveal path."""
    return [_with_author(db, c) for c in crud.get_flagged_complaints(db)]


@router.get("/false")
def false_complaints(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_admin),
):
    """Complaints an admin determined to be false/malicious, with identities."""
    return [_with_author(db, c) for c in crud.get_false_complaints(db)]


@router.post("/moderate/{complaint_id}")
def moderate_complaint(
    complaint_id: str,
    decision: schemas.ModerationDecision,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_admin),
):
    """Admin decision on a FLAGGED complaint. Consequences are applied only here."""
    complaint = crud.get_complaint(db, complaint_id)
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    if complaint.status != models.ComplaintStatus.FLAGGED:
        raise HTTPException(status_code=400, detail="Only flagged complaints can be moderated.")

    action = decision.action
    if action == "legitimate":
        complaint.status = models.ComplaintStatus.PUBLISHED
        db.commit()
        return {"success": True, "status": "published", "message": "Complaint restored."}

    if action in ("false", "insufficient"):
        complaint.status = models.ComplaintStatus.ARCHIVED
        if action == "false":
            complaint.is_false = True
            # Consequences applied to the *author* and the *verifier* only after
            # an admin determination — never automatically by votes alone.
            if complaint.author_id:
                author = crud.get_user(db, complaint.author_id)
                if author:
                    author.false_count = (author.false_count or 0) + 1
                    if author.false_count >= settings.FALSE_BAN_COUNT:
                        author.is_banned = True
                        audit.log_action(db, author.id, audit.USER_BANNED,
                                         details=f"false_count={author.false_count}",
                                         ip=client_ip(request))
            audit.log_action(db, current_user.id, audit.COMPLAINT_FALSE, target=complaint.id,
                             details=f"author={complaint.author_id}", ip=client_ip(request))
        db.commit()
        return {"success": True, "status": "archived",
                "message": "Marked false — penalties applied." if action == "false" else "Archived (insufficient evidence)."}

    raise HTTPException(status_code=400, detail="action must be 'legitimate', 'false', or 'insufficient'")


@router.put("/resolve/{complaint_id}")
def mark_resolved(
    complaint_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_admin),
):
    complaint = crud.get_complaint(db, complaint_id)
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    # MODERATED (admin-flagged private) complaints also need a resolve path —
    # otherwise they could only ever be archived.
    if complaint.status not in (
        models.ComplaintStatus.PUBLISHED,
        models.ComplaintStatus.VOTING,
        models.ComplaintStatus.MODERATED,
    ):
        raise HTTPException(status_code=400, detail="Only published or admin-managed complaints can be marked as solved.")
    complaint.status = models.ComplaintStatus.RESOLVED
    db.commit()
    audit.log_action(db, current_user.id, audit.COMPLAINT_RESOLVED, target=complaint_id,
                     ip=client_ip(request))
    return {"success": True, "message": f"Complaint {complaint_id} marked as resolved"}


@router.put("/archive/{complaint_id}")
def archive_complaint(
    complaint_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_admin),
):
    complaint = crud.get_complaint(db, complaint_id)
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    if complaint.status not in (
        models.ComplaintStatus.PUBLISHED,
        models.ComplaintStatus.VOTING,
        models.ComplaintStatus.MODERATED,
    ):
        raise HTTPException(status_code=400, detail=f"Cannot archive a {complaint.status.value} complaint.")
    complaint.status = models.ComplaintStatus.ARCHIVED
    db.commit()
    audit.log_action(db, current_user.id, audit.COMPLAINT_ARCHIVED, target=complaint_id,
                     ip=client_ip(request))
    return {"success": True, "message": f"Complaint {complaint_id} archived"}


@router.put("/users/{user_id}/disable")
def disable_user(
    user_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_admin),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot disable your own account.")
    user = crud.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Admins can never be disabled through the panel — a rogue admin could
    # otherwise permanently lock out the school's other admins.
    if user.role == models.Role.ADMIN:
        raise HTTPException(status_code=400, detail="Administrator accounts cannot be disabled.")
    user.is_active = False
    db.commit()
    audit.log_action(db, current_user.id, audit.ACCOUNT_DISABLED, target=user_id,
                     ip=client_ip(request))
    return {"success": True, "message": f"User {user_id} disabled"}


@router.put("/users/{user_id}/enable")
def enable_user(
    user_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_admin),
):
    user = crud.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = True
    db.commit()
    audit.log_action(db, current_user.id, audit.ACCOUNT_ENABLED, target=user_id,
                     ip=client_ip(request))
    return {"success": True, "message": f"User {user_id} enabled"}


