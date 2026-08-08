from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from database import get_db
import models
import security
from config import settings
from ratelimit import SlidingWindowLimiter

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")

# ---------------------------------------------------------------------------
# Rate limiting (in-memory; single-process pilot. Edge (Cloudflare) is the
# production enforcement layer; shared store only if multi-worker traffic demands it.)
# ---------------------------------------------------------------------------
auth_limiter = SlidingWindowLimiter(settings.AUTH_RATE_LIMIT, settings.RATE_WINDOW_SECONDS)
general_limiter = SlidingWindowLimiter(settings.GENERAL_RATE_LIMIT, settings.RATE_WINDOW_SECONDS)


def client_ip(request: Request) -> str:
    # Behind a trusted proxy (Cloudflare), X-Forwarded-For carries the real client.
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None:
        raise credentials_exception

    # Disabled accounts cannot authenticate.
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled. Contact an administrator.")

    return user


def _require_role(current_user: models.User, role: models.Role):
    if current_user.role != role:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return current_user


def get_current_active_student(current_user: models.User = Depends(get_current_user)):
    return _require_role(current_user, models.Role.STUDENT)


def get_current_active_teacher(current_user: models.User = Depends(get_current_user)):
    return _require_role(current_user, models.Role.TEACHER)


def get_current_active_admin(current_user: models.User = Depends(get_current_user)):
    return _require_role(current_user, models.Role.ADMIN)
