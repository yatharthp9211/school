from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
import json
import logging

from pywebpush import webpush, WebPushException
from database import get_db, SessionLocal
from config import VAPID, VAPID_PUBLIC_KEY
import models
from dependencies import get_current_user

router = APIRouter()
log = logging.getLogger(__name__)


class SubscriptionIn(BaseModel):
    endpoint: str
    p256dh: str
    auth: str


@router.get("/vapid-key")
def vapid_key():
    return {"public_key": VAPID_PUBLIC_KEY}


@router.post("/subscribe")
def subscribe(
    sub: SubscriptionIn,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # Upsert: remove any existing subscription with same endpoint, then insert
    existing = db.query(models.PushSubscription).filter(
        models.PushSubscription.endpoint == sub.endpoint
    ).first()
    if existing:
        db.delete(existing)
        db.flush()

    db.add(models.PushSubscription(
        user_id=current_user.id,
        endpoint=sub.endpoint,
        p256dh=sub.p256dh,
        auth=sub.auth,
    ))
    db.commit()
    return {"success": True}


# ── Push helper (used by complaints.py via BackgroundTasks) ──────────────

def send_push(user_id: str, title: str, body: str, *, type: str = "notification"):
    """Fire-and-forget push to all of a user's subscriptions. Stale ones are
    silently pruned (404/410 from push service = subscription expired).

    Opens its own session: this runs in a BackgroundTask, after the request's
    scoped session may already be closed."""
    db = SessionLocal()
    try:
        subs = db.query(models.PushSubscription).filter(
            models.PushSubscription.user_id == user_id
        ).all()
        if not subs:
            return

        payload = json.dumps({"title": title, "body": body, "type": type})
        vapid_claims = {"sub": "mailto:noreply@democrate.local"}

        for sub in subs:
            try:
                webpush(
                    subscription_info={
                        "endpoint": sub.endpoint,
                        "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                    },
                    data=payload,
                    vapid_private_key=VAPID,
                    vapid_claims=vapid_claims,
                )
            except WebPushException as ex:
                status = getattr(ex, "response", None)
                code = getattr(status, "status_code", 0) if status else 0
                if code in (404, 410):
                    db.delete(sub)
                log.warning("Push failed for %s: %s", user_id, ex)
        db.commit()
    finally:
        db.close()
