from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
import models
import schemas
import crud
import audit
from database import get_db
from dependencies import get_current_active_student, client_ip

router = APIRouter()


@router.post("", response_model=schemas.RatingResponse)
def create_rating(
    rating_in: schemas.RatingCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_student),
):
    if current_user.is_banned:
        raise HTTPException(status_code=403, detail="Your account has been restricted from submitting ratings.")

    teacher = crud.get_user(db, rating_in.teacher_id)
    if not teacher or teacher.role != models.Role.TEACHER:
        raise HTTPException(status_code=404, detail="Teacher not found")
    if not teacher.is_active:
        raise HTTPException(status_code=400, detail="Teacher is not active.")

    rating = crud.create_or_update_rating(db, rating_in, student_id=current_user.id)
    audit.log_action(db, current_user.id, audit.RATING_SUBMITTED, target=rating_in.teacher_id,
                     details=f"rating={rating_in.rating} tags={rating.tags or 'none'}",
                     ip=client_ip(request))
    return rating
