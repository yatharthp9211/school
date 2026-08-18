from fastapi import APIRouter, Depends, HTTPException, Request, status, UploadFile, File
from sqlalchemy.orm import Session
from datetime import timedelta
import models
import schemas
import crud
import security
import audit
from database import get_db
from config import settings
from dependencies import get_current_user, client_ip, get_current_active_developer

router = APIRouter()

# Precomputed once at import so a login attempt for a non-existent user still
# pays one bcrypt verify (~200 ms). Otherwise response timing reveals which user
# IDs are registered (user-enumeration oracle).
# Keep password <= 72 bytes (bcrypt limit). Shorter = faster too.
_DUMMY_HASH = security.get_password_hash("dummy")


def _public_user(user: models.User) -> dict:
    """Minimal user object for the client. Never includes internal details/PII
    (details can hold a base64 photo and class info)."""
    return {"id": user.id, "name": user.name, "role": user.role.value}


@router.post("/register", response_model=schemas.UserResponse)
def register_student(
    user_in: schemas.RegisterStudent,
    request: Request,
    db: Session = Depends(get_db),
):
    # Public registration is for STUDENTS only. Teachers require a key;
    # admins are provisioned out-of-band (see seed.py / admin tooling).
    user = crud.get_user(db, user_id=user_in.id)
    if user:
        raise HTTPException(status_code=400, detail="User ID already registered")
    created = crud.create_student(db=db, data=user_in)
    audit.log_action(db, created.id, audit.REGISTER_SUCCESS, target=created.id, ip=client_ip(request))
    return created


@router.post("/register/teacher", response_model=schemas.UserResponse)
def register_teacher(
    user_in: schemas.RegisterTeacher,
    request: Request,
    db: Session = Depends(get_db),
):
    if not settings.TEACHER_KEY:
        raise HTTPException(status_code=403, detail="Teacher registration is currently disabled.")
    if user_in.registration_key != settings.TEACHER_KEY:
        raise HTTPException(status_code=403, detail="Invalid teacher registration key.")

    user = crud.get_user(db, user_id=user_in.id)
    if user:
        raise HTTPException(status_code=400, detail="User ID already registered")
    created = crud.create_teacher(db=db, data=user_in)
    audit.log_action(db, created.id, audit.REGISTER_SUCCESS, target=created.id, ip=client_ip(request))
    return created


@router.post("/check-id")
def check_id(user_id: str, db: Session = Depends(get_db)):
    user = crud.get_user(db, user_id=user_id)
    return {"available": user is None}


@router.post("/login")
def login(user_in: schemas.UserLogin, request: Request, db: Session = Depends(get_db)):
    user = crud.get_user(db, user_id=user_in.username)
    ip = client_ip(request)

    # Verify against the stored hash — or the dummy hash when the user doesn't
    # exist — so both paths take the same time.
    if not user or not security.verify_password(user_in.password, user.hashed_password if user else _DUMMY_HASH):
        audit.log_action(db, user.id if user else None, audit.LOGIN_FAILURE,
                         details=f"role={user_in.role.value}", ip=ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        audit.log_action(db, user.id, audit.LOGIN_FAILURE, details="disabled account", ip=ip)
        raise HTTPException(status_code=403, detail="Account disabled. Contact an administrator.")

    if user.role != user_in.role:
        audit.log_action(db, user.id, audit.LOGIN_FAILURE,
                         details=f"role mismatch requested={user_in.role.value}", ip=ip)
        raise HTTPException(status_code=400, detail=f"User is not a {user_in.role.value}")

    if user.role == models.Role.DEVELOPER:
        audit.log_action(db, user.id, audit.LOGIN_FAILURE,
                         details="developer attempted normal login", ip=ip)
        raise HTTPException(status_code=403, detail="Developers must use the specialized developer login flow.")

    # Upgrade legacy sha256_crypt hashes to bcrypt on successful login.
    if security.needs_password_rehash(user.hashed_password):
        user.hashed_password = security.get_password_hash(user_in.password)
        db.commit()

    access_token = security.create_access_token(
        data={"sub": user.id, "role": user.role.value},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    audit.log_action(db, user.id, audit.LOGIN_SUCCESS, ip=ip)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": _public_user(user),
    }


@router.get("/me", response_model=schemas.UserResponse)
def me(current_user: models.User = Depends(get_current_user)):
    # Add has_image flag
    resp = schemas.UserResponse.model_validate(current_user)
    resp.has_image = bool(current_user.image)
    return resp


@router.put("/profile", response_model=schemas.UserResponse)
def update_profile(
    update: schemas.ProfileUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Update user profile - all persons can upload a profile image (max 1MB, base64)."""
    if update.name is not None:
        current_user.name = update.name

    if update.image is not None:
        if update.image == "":
            # Allow clearing the image
            current_user.image = None
        else:
            current_user.image = update.image
        audit.log_action(db, current_user.id, audit.PROFILE_UPDATED, target=current_user.id,
                         details="image_updated" if update.image else "image_cleared",
                         ip=client_ip(request))

    db.commit()
    db.refresh(current_user)

    resp = schemas.UserResponse.model_validate(current_user)
    resp.has_image = bool(current_user.image)
    return resp


@router.get("/users/{user_id}/image")
def get_user_image(user_id: str, db: Session = Depends(get_db)):
    """Get the user's profile image (base64 data URL)."""
    user = crud.get_user(db, user_id=user_id)
    if not user or not user.image:
        raise HTTPException(status_code=404, detail="Image not found")
    return {"image": user.image}



# Developer-only endpoints
@router.post("/developer/login")
def developer_login(user_in: schemas.UserLogin, request: Request, db: Session = Depends(get_db)):
    """Developer login with specific credentials - first factor (password)."""
    user = crud.get_user(db, user_id=user_in.username)
    ip = client_ip(request)

    if not user or not security.verify_password(user_in.password, user.hashed_password if user else _DUMMY_HASH):
        audit.log_action(db, user.id if user else None, audit.LOGIN_FAILURE,
                         details=f"role={user_in.role.value} (dev)", ip=ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect developer credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        audit.log_action(db, user.id, audit.LOGIN_FAILURE, details="disabled account (dev)", ip=ip)
        raise HTTPException(status_code=403, detail="Account disabled. Contact an administrator.")

    if user.role != models.Role.DEVELOPER:
        audit.log_action(db, user.id, audit.LOGIN_FAILURE,
                         details=f"role mismatch requested={user_in.role.value} (dev)", ip=ip)
        raise HTTPException(status_code=400, detail="Not a developer account")

    if security.needs_password_rehash(user.hashed_password):
        user.hashed_password = security.get_password_hash(user_in.password)
        db.commit()

    # Return a temporary token for the second factor (file upload)
    temp_token = security.create_access_token(
        data={"sub": user.id, "role": user.role.value, "temp": True, "step": "file_upload"},
        expires_delta=timedelta(minutes=5),  # Short expiry for temp token
    )
    audit.log_action(db, user.id, audit.LOGIN_SUCCESS, details="dev_step1", ip=ip)
    return {
        "temp_token": temp_token,
        "token_type": "bearer",
        "step": "file_upload",
        "message": "Password verified. Please upload the unlock file to complete authentication."
    }


@router.post("/developer/unlock")
def developer_unlock(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_developer),
):
    """Developer second factor: upload unlock file."""
    # Read the uploaded file with size limit (1 MB max)
    try:
        raw_bytes = file.file.read()
        if len(raw_bytes) > 1_048_576:  # 1 MB
            audit.log_action(db, current_user.id, audit.LOGIN_FAILURE, details="dev_unlock_file_too_large", ip=client_ip(request))
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Unlock file too large (max 1 MB)",
            )
        try:
            content = raw_bytes.decode('utf-8').strip()
        except UnicodeDecodeError:
            content = raw_bytes.decode('utf-16').strip()
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error reading file: {e}")
        audit.log_action(db, current_user.id, audit.LOGIN_FAILURE, details="dev_unlock_read_error", ip=client_ip(request))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to read unlock file",
        )

    print(f"Expected: {settings.DEVELOPER_SECRET_FILE_CONTENT}")
    print(f"Received: {content}")
    print(f"Match: {content == settings.DEVELOPER_SECRET_FILE_CONTENT}")

    if not settings.DEVELOPER_SECRET_FILE_CONTENT or content != settings.DEVELOPER_SECRET_FILE_CONTENT:
        audit.log_action(db, current_user.id, audit.LOGIN_FAILURE, details="dev_unlock_failed", ip=client_ip(request))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid unlock file",
        )

    access_token = security.create_access_token(
        data={"sub": current_user.id, "role": current_user.role.value},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    audit.log_action(db, current_user.id, audit.LOGIN_SUCCESS, details="dev_complete", ip=client_ip(request))
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": _public_user(current_user),
    }
