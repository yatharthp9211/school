"""Audit trail helpers.

Record security-relevant events. Never log complaint text, passwords, or tokens.
"""
from sqlalchemy.orm import Session
import models

# Canonical action names
LOGIN_SUCCESS = "LOGIN_SUCCESS"
LOGIN_FAILURE = "LOGIN_FAILURE"
REGISTER_SUCCESS = "REGISTER_SUCCESS"
COMPLAINT_CREATED = "COMPLAINT_CREATED"
COMPLAINT_VERIFIED = "COMPLAINT_VERIFIED"
COMPLAINT_REJECTED = "COMPLAINT_REJECTED"
COMPLAINT_FLAGGED = "COMPLAINT_FLAGGED"
COMPLAINT_RESOLVED = "COMPLAINT_RESOLVED"
COMPLAINT_ARCHIVED = "COMPLAINT_ARCHIVED"
COMPLAINT_FALSE = "COMPLAINT_FALSE"
VOTE_CAST = "VOTE_CAST"
RATING_SUBMITTED = "RATING_SUBMITTED"
ACCOUNT_DISABLED = "ACCOUNT_DISABLED"
ACCOUNT_ENABLED = "ACCOUNT_ENABLED"
USER_BANNED = "USER_BANNED"

# Developer actions
DEVELOPER_QUERY = "DEVELOPER_QUERY"
DEVELOPER_QUERY_FAILED = "DEVELOPER_QUERY_FAILED"
DEVELOPER_EXECUTE = "DEVELOPER_EXECUTE"
DEVELOPER_EXECUTE_FAILED = "DEVELOPER_EXECUTE_FAILED"

# Profile
PROFILE_UPDATED = "PROFILE_UPDATED"


def log_action(
    db: Session,
    user_id: str | None,
    action: str,
    target: str | None = None,
    details: str | None = None,
    ip: str | None = None,
) -> models.AuditLog:
    """Append an audit entry. Commits only this entry (callers flush their own work first)."""
    entry = models.AuditLog(
        user_id=user_id,
        action=action,
        target=target,
        details=details,
        ip_address=ip,
    )
    db.add(entry)
    db.commit()
    return entry
