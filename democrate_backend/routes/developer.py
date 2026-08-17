"""Developer-only routes for direct database access and system diagnostics."""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import text, inspect
from typing import List, Optional
import json

import models
import audit
from database import get_db
from dependencies import get_current_active_developer, client_ip

router = APIRouter()


@router.get("/tables")
def list_tables(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_developer),
):
    """List all database tables."""
    inspector = inspect(db.bind)
    tables = inspector.get_table_names()
    return {"tables": tables}


@router.get("/tables/{table_name}/schema")
def get_table_schema(
    table_name: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_developer),
):
    """Get schema information for a specific table."""
    inspector = inspect(db.bind)
    if table_name not in inspector.get_table_names():
        raise HTTPException(status_code=404, detail="Table not found")

    columns = inspector.get_columns(table_name)
    pk = inspector.get_pk_constraint(table_name)
    fks = inspector.get_foreign_keys(table_name)
    indexes = inspector.get_indexes(table_name)

    return {
        "table": table_name,
        "columns": columns,
        "primary_key": pk,
        "foreign_keys": fks,
        "indexes": indexes,
    }


@router.post("/query")
def execute_query(
    query_request: dict,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_developer),
):
    """Execute a raw SQL query (SELECT only for safety)."""
    sql = query_request.get("sql", "").strip()
    if not sql:
        raise HTTPException(status_code=400, detail="SQL query required")

    # Only allow SELECT statements for safety
    if not sql.lower().startswith("select"):
        raise HTTPException(status_code=403, detail="Only SELECT queries are allowed")

    try:
        result = db.execute(text(sql))
        rows = result.mappings().all()
        columns = list(result.keys()) if rows else []

        audit.log_action(
            db, current_user.id, audit.DEVELOPER_QUERY,
            target="database", details=f"query={sql[:200]}", ip=client_ip(request)
        )

        return {
            "columns": columns,
            "rows": [dict(row) for row in rows],
            "row_count": len(rows),
        }
    except Exception as e:
        audit.log_action(
            db, current_user.id, audit.DEVELOPER_QUERY_FAILED,
            target="database", details=f"query={sql[:200]} error={str(e)}", ip=client_ip(request)
        )
        raise HTTPException(status_code=400, detail=f"Query execution failed: {str(e)}")


@router.post("/execute")
def execute_statement(
    query_request: dict,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_developer),
):
    """Execute a raw SQL statement (INSERT, UPDATE, DELETE, etc.)."""
    sql = query_request.get("sql", "").strip()
    if not sql:
        raise HTTPException(status_code=400, detail="SQL statement required")

    try:
        result = db.execute(text(sql))
        db.commit()

        audit.log_action(
            db, current_user.id, audit.DEVELOPER_EXECUTE,
            target="database", details=f"statement={sql[:200]}", ip=client_ip(request)
        )

        return {
            "success": True,
            "rowcount": result.rowcount,
            "message": f"Statement executed successfully. Rows affected: {result.rowcount}",
        }
    except Exception as e:
        db.rollback()
        audit.log_action(
            db, current_user.id, audit.DEVELOPER_EXECUTE_FAILED,
            target="database", details=f"statement={sql[:200]} error={str(e)}", ip=client_ip(request)
        )
        raise HTTPException(status_code=400, detail=f"Statement execution failed: {str(e)}")


@router.get("/audit")
def developer_audit_log(
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_developer),
):
    """Developer audit log access - full audit trail including developer actions."""
    skip, limit = max(skip, 0), min(max(limit, 1), 500)
    entries = (
        db.query(models.AuditLog)
        .order_by(models.AuditLog.timestamp.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [
        {
            "id": e.id,
            "user_id": e.user_id,
            "action": e.action,
            "target": e.target,
            "details": e.details,
            "ip_address": e.ip_address,
            "timestamp": e.timestamp.isoformat() if e.timestamp else None,
        }
        for e in entries
    ]


@router.get("/users")
def list_all_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_developer),
):
    """List all users with full details (developer only)."""
    users = db.query(models.User).offset(skip).limit(limit).all()
    return [
        {
            "id": u.id,
            "name": u.name,
            "role": u.role.value,
            "is_active": u.is_active,
            "is_banned": u.is_banned,
            "false_count": u.false_count,
            "details": u.details,
            "has_image": bool(u.image),
        }
        for u in users
    ]


@router.get("/stats")
def system_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_developer),
):
    """Get system statistics."""
    stats = {
        "users": {
            "total": db.query(models.User).count(),
            "students": db.query(models.User).filter(models.User.role == models.Role.STUDENT).count(),
            "teachers": db.query(models.User).filter(models.User.role == models.Role.TEACHER).count(),
            "admins": db.query(models.User).filter(models.User.role == models.Role.ADMIN).count(),
            "developers": db.query(models.User).filter(models.User.role == models.Role.DEVELOPER).count(),
        },
        "complaints": {
            "total": db.query(models.Complaint).count(),
            "by_status": {},
        },
        "votes": db.query(models.Vote).count(),
        "ratings": db.query(models.TeacherRating).count(),
        "audit_logs": db.query(models.AuditLog).count(),
    }

    # Complaint counts by status
    for status in models.ComplaintStatus:
        count = db.query(models.Complaint).filter(models.Complaint.status == status).count()
        stats["complaints"]["by_status"][status.value] = count

    return stats