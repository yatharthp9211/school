from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Enum, Boolean, UniqueConstraint, CheckConstraint
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum
from database import Base


def _utcnow():
    """Timezone-aware UTC timestamp. SQLAlchemy calls this per-insert; we avoid
    the deprecated datetime.utcnow() (removed in 3.13+) and return aware datetimes
    so lexical ordering and isoformat parsing stay correct across SQLite/py."""
    return datetime.now(timezone.utc)


class Role(str, enum.Enum):
    STUDENT = "student"
    TEACHER = "teacher"
    ADMIN = "admin"
    DEVELOPER = "developer"


class ComplaintStatus(str, enum.Enum):
    PENDING = "pending"        # awaiting teacher verification
    MODERATED = "moderated"    # admin-managed (e.g. private complaints)
    PUBLISHED = "published"    # verified, public, open to voting
    VOTING = "voting"          # legacy synonym for published; kept for compatibility
    FLAGGED = "flagged"        # score dropped to threshold; awaiting admin review
    RESOLVED = "resolved"      # closed by admin
    ARCHIVED = "archived"      # rejected / insufficient / false


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    role = Column(Enum(Role), nullable=False)
    hashed_password = Column(String, nullable=False)

    # Extra details (JSON or split columns)
    details = Column(String, nullable=True)  # e.g. "Class 9A", "Mathematics"

    # Accountability / moderation
    is_active = Column(Boolean, default=True, nullable=False)   # admin can disable login
    is_banned = Column(Boolean, default=False, nullable=False)  # cannot submit, can still log in
    false_count = Column(Integer, default=0, nullable=False)    # admin-confirmed false complaints
    
    # Security: Revoke tokens issued before this timestamp
    tokens_valid_after = Column(DateTime, nullable=True)

    # Profile image — base64 data URL (max ~1 MB, enforced at the API layer).
    image = Column(Text, nullable=True)


class Complaint(Base):
    __tablename__ = "complaints"

    id = Column(String, primary_key=True, index=True)

    # Author is stored but NEVER serialized in any public/API response.
    author_id = Column(String, ForeignKey("users.id"), index=True, nullable=True)

    # Public display identifier — random per complaint, unlinkable.
    anonymous_id = Column(String, index=True, nullable=True)

    text = Column(Text, nullable=False)

    # Teacher this complaint is ABOUT (subject) — optional.
    target_teacher = Column(String, ForeignKey("users.id"), nullable=True)
    # Teacher assigned to VERIFY this complaint.
    verifier_teacher = Column(String, ForeignKey("users.id"), nullable=True)

    # Category chosen by the student at submission.
    category = Column(String, nullable=True)

    status = Column(Enum(ComplaintStatus), default=ComplaintStatus.PENDING)
    created_at = Column(DateTime, default=_utcnow)
    is_private = Column(Boolean, default=False, nullable=False)  # private = only admin sees it

    # Admin-confirmed false allegation (set only after admin review, never automatically).
    is_false = Column(Boolean, default=False, nullable=False)

    # Aggregate vote counters (updated on each vote for fast reads)
    student_up = Column(Integer, default=0, nullable=False)
    student_down = Column(Integer, default=0, nullable=False)
    teacher_up = Column(Integer, default=0, nullable=False)
    teacher_down = Column(Integer, default=0, nullable=False)

    # Relationships
    votes = relationship("Vote", back_populates="complaint")

    @property
    def score(self) -> int:
        """Weighted community score: student votes ×1, teacher votes ×10. Read by
        the API's `score` field (Pydantic from_attributes reads properties)."""
        return (
            (self.student_up or 0) - (self.student_down or 0)
            + 10 * (self.teacher_up or 0) - 10 * (self.teacher_down or 0)
        )


class VoteType(str, enum.Enum):
    UPVOTE = "upvote"
    DOWNVOTE = "downvote"


class Vote(Base):
    __tablename__ = "votes"
    __table_args__ = (
        UniqueConstraint("complaint_id", "user_id", name="uq_vote_complaint_user"),
    )

    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(String, ForeignKey("complaints.id"))
    user_id = Column(String, ForeignKey("users.id"))
    vote_type = Column(Enum(VoteType))
    weight = Column(Integer, default=1)
    timestamp = Column(DateTime, default=_utcnow)

    complaint = relationship("Complaint", back_populates="votes")


class TeacherRating(Base):
    __tablename__ = "teacher_ratings"
    __table_args__ = (
        UniqueConstraint("teacher_id", "student_id", name="uq_rating_teacher_student"),
        CheckConstraint("rating BETWEEN 1 AND 5", name="ck_rating_range"),
    )

    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(String, ForeignKey("users.id"), index=True)
    student_id = Column(String, ForeignKey("users.id"))
    rating = Column(Integer)  # 1 to 5
    tags = Column(String, nullable=True)  # Comma separated allowlisted tags
    timestamp = Column(DateTime, default=_utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    action = Column(String, nullable=False)
    target = Column(String, nullable=True)
    details = Column(String, nullable=True)
    timestamp = Column(DateTime, default=_utcnow)
    ip_address = Column(String, nullable=True)
