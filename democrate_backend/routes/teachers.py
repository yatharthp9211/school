from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

import models
import schemas
import crud
import audit
from database import get_db
from dependencies import get_current_user

router = APIRouter()

def get_class_teacher_user(current_user: models.User = Depends(get_current_user)):
    if current_user.role != models.Role.TEACHER or not current_user.is_class_teacher:
        raise HTTPException(status_code=403, detail="Only class teachers can access this.")
    return current_user

@router.get("/my-students", response_model=List[schemas.UserResponse])
def get_my_students(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_class_teacher_user),
):
    """Get all students in the teacher's class."""
    students = db.query(models.User).filter(
        models.User.role == models.Role.STUDENT,
        models.User.class_name == current_user.class_name,
        models.User.section_name == current_user.section_name,
        models.User.is_active == True # Exclude deleted/deactivated students
    ).all()
    
    # We only return the names and IDs as per requirements, but UserResponse includes a few other fields.
    # The frontend will only display the name.
    return students

@router.delete("/remove-student/{student_id}")
def remove_student(
    student_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_class_teacher_user),
):
    """Class teacher removes a fake/unauthorized student from their class."""
    student = crud.get_user(db, student_id)
    if not student or student.role != models.Role.STUDENT:
        raise HTTPException(status_code=404, detail="Student not found")
        
    if student.class_name != current_user.class_name or student.section_name != current_user.section_name:
        raise HTTPException(status_code=403, detail="Student is not in your class")

    # Deactivate the student so they can't login or use the platform anymore
    student.is_active = False
    
    audit.log_action(db, current_user.id, audit.ACCOUNT_DISABLED, target=student_id, details="class_teacher_removed_student")
    db.commit()
    
    return {"message": "Student removed successfully"}
