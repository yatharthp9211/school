from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime
from models import Role, ComplaintStatus, VoteType

# ---------------------------------------------------------------------------
# Auth Schemas
# ---------------------------------------------------------------------------


class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict


class _PasswordMixin:
    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if not any(c.isalpha() for c in v):
            raise ValueError("Password must contain at least one letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one number")
        return v


class RegisterStudent(BaseModel, _PasswordMixin):
    id: str = Field(min_length=3, max_length=32, pattern=r"^[A-Za-z0-9_-]+$")
    name: str = Field(min_length=1, max_length=80)
    password: str
    details: Optional[str] = None  # e.g. "Class 9A - A (Roll: 52)"


class RegisterTeacher(BaseModel, _PasswordMixin):
    id: str = Field(min_length=3, max_length=32, pattern=r"^[A-Za-z0-9_-]+$")
    name: str = Field(min_length=1, max_length=80)
    password: str
    subject: Optional[str] = None
    classes: Optional[str] = None
    photo: Optional[str] = None  # data URL
    registration_key: str = Field(min_length=1)


class UserLogin(BaseModel):
    username: str
    password: str
    role: Role


class UserResponse(BaseModel):
    id: str
    name: str
    role: Role
    is_active: bool = True
    is_banned: bool = False
    false_count: int = 0
    details: Optional[str] = None
    has_image: bool = False

    class Config:
        from_attributes = True


class ProfileUpdate(BaseModel):
    image: Optional[str] = None  # base64 data URL, max ~1MB
    name: Optional[str] = Field(None, min_length=1, max_length=80)

    @field_validator("image")
    @classmethod
    def validate_image_size(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return v
        # Enforce max ~1MB base64. base64 is ~33% larger than bytes.
        # 1MB = 1048576 bytes ≈ 1.4MB base64 string max.
        if len(v) > 1_400_000:
            raise ValueError("Image too large. Maximum file size is 1 MB.")
        # Must be a valid data URL starting with data:image/
        if not v.startswith("data:image/"):
            raise ValueError("Image must be a valid image data URL (data:image/...).")
        return v


# ---------------------------------------------------------------------------
# Complaint Schemas
# ---------------------------------------------------------------------------

COMPLAINT_CATEGORIES = [
    "Harassment",
    "Teacher Misconduct",
    "Infrastructure",
    "Bullying",
    "Academic",
    "Safety",
    "Mental Health",
    "Other",
]


class ComplaintCreate(BaseModel):
    text: str = Field(min_length=20, max_length=5000)
    category: str
    # Teacher the complaint is ABOUT (optional subject).
    target_teacher: Optional[str] = None
    # Teacher assigned to verify. Required for public complaints.
    verifier_teacher: Optional[str] = None
    is_private: bool = False

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        if v not in COMPLAINT_CATEGORIES:
            raise ValueError(f"category must be one of: {', '.join(COMPLAINT_CATEGORIES)}")
        return v

    @field_validator("text")
    @classmethod
    def strip_text(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 20:
            raise ValueError("Complaint text must be at least 20 characters")
        return v


class ComplaintResponse(BaseModel):
    id: str
    anonymous_id: Optional[str]
    text: str
    category: Optional[str] = None
    target_teacher: Optional[str] = None
    verifier_teacher: Optional[str] = None
    status: ComplaintStatus
    created_at: datetime
    is_private: bool = False
    student_up: int = 0
    student_down: int = 0
    teacher_up: int = 0
    teacher_down: int = 0
    is_false: bool = False
    score: int = 0

    model_config = {"from_attributes": True, "populate_by_name": True}


# Voting Schemas
class VoteCreate(BaseModel):
    type: VoteType


# Verification Schema
class VerifyRequest(BaseModel):
    action: str  # "approve" or "reject"


# Moderation decision for FLAGGED complaints
class ModerationDecision(BaseModel):
    action: str  # "legitimate" | "false" | "insufficient"


# ---------------------------------------------------------------------------
# Rating Schema
# ---------------------------------------------------------------------------

ALLOWED_RATING_TAGS = [
    "Helpful", "Clear", "Fair", "Punctual", "Passionate", "Empathetic",
]


class RatingCreate(BaseModel):
    teacher_id: str
    rating: int = Field(ge=1, le=5)
    tags: Optional[str] = None

    @field_validator("tags")
    @classmethod
    def sanitize_tags(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        # Keep only allowlisted tags, comma-separated, deduplicated, order preserved.
        selected = [t.strip() for t in v.split(",") if t.strip() in ALLOWED_RATING_TAGS]
        seen, out = set(), []
        for t in selected:
            if t not in seen:
                seen.add(t)
                out.append(t)
        return ",".join(out) or None


class RatingResponse(BaseModel):
    id: int
    teacher_id: str
    student_id: str
    rating: int
    tags: Optional[str]
    timestamp: datetime

    class Config:
        from_attributes = True
