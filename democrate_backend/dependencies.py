from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from database import get_db
import models
import security
from config import settings
from ratelimit import SlidingWindowLimiter

from fastapi.security import APIKeyCookie

oauth2_scheme = APIKeyCookie(name="access_token", auto_error=False)

# ---------------------------------------------------------------------------
# Rate limiting (in-memory; single-process pilot. Edge (Cloudflare) is the
# production enforcement layer; shared store only if multi-worker traffic demands it.)
# ---------------------------------------------------------------------------
auth_limiter = SlidingWindowLimiter(settings.AUTH_RATE_LIMIT, settings.RATE_WINDOW_SECONDS)
general_limiter = SlidingWindowLimiter(settings.GENERAL_RATE_LIMIT, settings.RATE_WINDOW_SECONDS)


# Immediate peers whose X-Forwarded-For we trust. nginx runs on this same host
# (loopback), so requests arriving from anywhere else may carry attacker-forged
# XFF and must be keyed on their TCP peer instead.
TRUSTED_PROXIES = {"127.0.0.1", "::1", "localhost"}


def client_ip(request: Request) -> str:
    # Cloudflare sets CF-Connecting-IP to the true client address and overwrites
    # it per request, so it cannot be spoofed by the caller. Highest authority.
    cf_ip = request.headers.get("cf-connecting-ip")
    if cf_ip and cf_ip.strip():
        return cf_ip.strip()

    # Behind our own nginx, $proxy_add_x_forwarded_for appends the real
    # $remote_addr as the LAST element. Take the final entry — never the
    # client-supplied head, which an attacker can set to any value.
    xff = request.headers.get("x-forwarded-for")
    peer = request.client.host if request.client else None
    if xff and peer in TRUSTED_PROXIES:
        parts = [p.strip() for p in xff.split(",") if p.strip()]
        if parts:
            return parts[-1]

    # Direct connection (dev / no proxy): any XFF is client-supplied — ignore it.
    return peer or "unknown"


def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None or not user.is_active:
        raise credentials_exception

    # Check if the token was issued before the user's password was reset/banned
    iat = payload.get("iat")
    if iat and user.tokens_valid_after:
        if iat < int(user.tokens_valid_after.timestamp()):
            raise credentials_exception

    # A `temp` token is the first factor of the developer 2FA flow — it is only
    # valid for the file-upload unlock step (guarded separately by
    # get_developer_temp on /auth/developer/unlock). Reject it everywhere else so
    # the second factor can't be skipped.
    if payload.get("temp") is True:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Complete the unlock step to finish signing in.",
            headers={"WWW-Authenticate": "Bearer"},
        )

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


def get_current_active_developer(current_user: models.User = Depends(get_current_user)):
    return _require_role(current_user, models.Role.DEVELOPER)

oauth2_bearer = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)

def get_developer_temp(db: Session = Depends(get_db), token: str = Depends(oauth2_bearer)):
    """The developer 2FA unlock step accepts only a *temp* token issued by
    /auth/developer/login (first factor). The token must carry temp=True and
    belong to a developer account. Full auth is granted only after the file
    upload succeeds in the route itself."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None or payload.get("temp") is not True:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None:
        raise credentials_exception
    return _require_role(user, models.Role.DEVELOPER)

