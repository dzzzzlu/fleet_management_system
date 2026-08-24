"""
Real auth dependencies (replaces the old FAKE_ORG_ID/FAKE_USER_ID stub).

Standalone mode: tokens are issued by this module's own /api/auth/login.
Platform mode (future): only decode_token's key source changes; everything
below (get_current_user, org scoping, require_permission) stays the same,
since it already treats organization_id as coming *only* from the token,
never from the client - per the module's threat model (cross-tenant/IDOR).
"""
import uuid
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.local_stub import User
from app.models.driver import Driver
from app.security import decode_token

bearer_scheme = HTTPBearer()

# doc's permission matrix: role -> set of allowed fleet.* permissions.
# "driver" is scoped separately (own trips/maintenance/incidents only),
# enforced in each router, not just by this table.
ROLE_PERMISSIONS: dict[str, set[str]] = {
    "viewer": {
        "fleet.vehicle.view", "fleet.driver.view", "fleet.trip.view",
        "fleet.maintenance.view", "fleet.report.view",
    },
    "staff": {
        "fleet.vehicle.view", "fleet.vehicle.create", "fleet.vehicle.update",
        "fleet.driver.view", "fleet.driver.create", "fleet.driver.update",
        "fleet.trip.view", "fleet.trip.create", "fleet.trip.update",
        "fleet.maintenance.view", "fleet.maintenance.create", "fleet.maintenance.update",
        "fleet.report.view",
    },
    "manager": {
        "fleet.vehicle.view", "fleet.vehicle.create", "fleet.vehicle.update",
        "fleet.driver.view", "fleet.driver.create", "fleet.driver.update",
        "fleet.trip.view", "fleet.trip.create", "fleet.trip.update", "fleet.trip.approve",
        "fleet.maintenance.view", "fleet.maintenance.create", "fleet.maintenance.update", "fleet.maintenance.complete",
        "fleet.report.view",
    },
    "administrator": {
        "fleet.vehicle.view", "fleet.vehicle.create", "fleet.vehicle.update", "fleet.vehicle.delete",
        "fleet.driver.view", "fleet.driver.create", "fleet.driver.update", "fleet.driver.delete",
        "fleet.trip.view", "fleet.trip.create", "fleet.trip.update", "fleet.trip.approve",
        "fleet.maintenance.view", "fleet.maintenance.create", "fleet.maintenance.update", "fleet.maintenance.complete",
        "fleet.report.view",
    },
    "driver": {
        "fleet.trip.view", "fleet.maintenance.view", "fleet.report.view",
    },
}


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    try:
        payload = decode_token(creds.credentials)
        user_id = uuid.UUID(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    return user


def get_current_org_id(current_user: User = Depends(get_current_user)) -> uuid.UUID:
    # organization_id ALWAYS comes from the authenticated user's own record,
    # never from a client-supplied param/body field (blocks IDOR/cross-tenant access)
    return current_user.organization_id


def get_current_user_id(current_user: User = Depends(get_current_user)) -> uuid.UUID:
    return current_user.id


def require_permission(permission: str):
    def checker(current_user: User = Depends(get_current_user)) -> User:
        allowed = ROLE_PERMISSIONS.get(current_user.role, set())
        if permission not in allowed:
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"Missing permission: {permission}")
        return current_user
    return checker


def driver_record_for_user(db: Session, user: User) -> Driver | None:
    """
    Resolve the fleet_drivers row belonging to a role='driver' account,
    via the loose (non-FK) Driver.user_id reference. Returns None when the
    user has no linked driver record — callers must then return no rows.
    """
    if user.role != "driver":
        return None
    return (
        db.query(Driver)
        .filter(Driver.user_id == user.id, Driver.deleted_at.is_(None))
        .first()
    )
