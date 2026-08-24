import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.local_stub import User, Organization
from app.schemas.auth import (
    SignupRequest, LoginRequest, TokenResponse, UserOut, SignupSuccessResponse,
    AdminCreateUserRequest,
)
from app.security import hash_password, verify_password, create_access_token
from app.deps import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _require_admin(current_user: User) -> None:
    if current_user.role != "administrator":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Administrator role required")


@router.get("/users", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin-only: list every account in the requesting admin's organization."""
    _require_admin(current_user)
    return (
        db.query(User)
        .filter(User.organization_id == current_user.organization_id)
        .order_by(User.created_at)
        .all()
    )


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    body: AdminCreateUserRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Admin-only: create a user with a specific role directly, under the same
    organization as the requesting administrator.
    """
    _require_admin(current_user)

    if db.query(User).filter(User.email == body.email.lower()).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")

    user = User(
        id=uuid.uuid4(),
        organization_id=current_user.organization_id,
        email=body.email.lower(),
        full_name=body.full_name,
        phone=body.phone,
        password_hash=hash_password(body.password),
        role=body.role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/signup", response_model=SignupSuccessResponse, status_code=status.HTTP_201_CREATED)
def signup(body: SignupRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == body.email.lower()).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")

    if body.organization_id:
        org = db.query(Organization).filter(Organization.id == body.organization_id).first()
        if not org:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "organization_id not found")
        role = body.role
    else:
        if not body.organization_name:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "Provide organization_id to join an org, or organization_name to create one",
            )
        org = Organization(
            id=uuid.uuid4(),
            name=body.organization_name,
            phone=body.phone,
            tax_id=body.tax_id,
        )
        db.add(org)
        db.flush()
        role = "administrator"  # first user of a newly created org is its admin

    user = User(
        id=uuid.uuid4(),
        organization_id=org.id,
        email=body.email.lower(),
        full_name=body.full_name,
        phone=body.phone,
        password_hash=hash_password(body.password),
        role=role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return SignupSuccessResponse(
        message="Account created successfully. Please log in.",
        organization_id=org.id,
        organization_name=org.name,
    )


@router.get("/organization/{org_id}")
def get_organization(org_id: uuid.UUID, db: Session = Depends(get_db)):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Organization not found")
    return {"id": org.id, "name": org.name}


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email.lower()).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is deactivated")

    token = create_access_token(user.id, user.organization_id, user.role)
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user
