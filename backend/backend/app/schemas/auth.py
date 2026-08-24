import re
import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, field_validator

ROLES = ("viewer", "staff", "manager", "administrator", "driver")

# Pragmatic syntax-only email check. Deliberately NOT pydantic EmailStr:
# email_validator rejects special-use/reserved TLDs such as `.test`,
# which the fictional demo accounts (@demofleet.test) rely on.
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _check_email(v: str) -> str:
    v = v.strip().lower()
    if not _EMAIL_RE.match(v):
        raise ValueError("invalid email address")
    return v


class SignupRequest(BaseModel):
    email: str
    password: str
    full_name: str
    phone: str | None = None
    role: str = "viewer"
    organization_id: uuid.UUID | None = None  # provide to join an existing org
    organization_name: str | None = None  # provide (without organization_id) to create a new org
    tax_id: str | None = None  # business registration / tax ID (org-level, stored on the org)

    @field_validator("email")
    @classmethod
    def email_valid(cls, v: str) -> str:
        return _check_email(v)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("password must be at least 8 characters")
        return v

    @field_validator("role")
    @classmethod
    def role_valid(cls, v: str) -> str:
        if v not in ROLES:
            raise ValueError(f"role must be one of {ROLES}")
        return v


class LoginRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def email_valid(cls, v: str) -> str:
        return _check_email(v)


class AdminCreateUserRequest(BaseModel):
    """Administrator-created account — always lands in the admin's own organization."""
    email: str
    full_name: str
    password: str
    role: str
    phone: str | None = None

    @field_validator("email")
    @classmethod
    def email_valid(cls, v: str) -> str:
        return _check_email(v)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("password must be at least 8 characters")
        return v

    @field_validator("role")
    @classmethod
    def role_valid(cls, v: str) -> str:
        if v not in ROLES:
            raise ValueError(f"role must be one of {ROLES}")
        return v


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    organization_id: uuid.UUID
    email: str
    full_name: str
    phone: str | None = None
    role: str
    is_active: bool
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class SignupSuccessResponse(BaseModel):
    message: str
    organization_id: uuid.UUID
    organization_name: str
