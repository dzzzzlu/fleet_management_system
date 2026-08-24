import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_org_id, get_current_user_id, require_permission
from app.models.driver import Driver
from app.schemas.driver import DriverCreate, DriverUpdate, DriverOut

router = APIRouter(prefix="/api/drivers", tags=["drivers"])


@router.get("", response_model=list[DriverOut])
def list_drivers(db: Session = Depends(get_db), org_id: uuid.UUID = Depends(get_current_org_id),
    _perm: object = Depends(require_permission("fleet.driver.view"))):
    return (
        db.query(Driver)
        .filter(Driver.organization_id == org_id, Driver.deleted_at.is_(None))
        .order_by(Driver.created_at.desc())
        .all()
    )


@router.post("", response_model=DriverOut, status_code=201)
def create_driver(
    payload: DriverCreate,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
    user_id: uuid.UUID = Depends(get_current_user_id),
    _perm: object = Depends(require_permission("fleet.driver.create")),
):
    driver = Driver(organization_id=org_id, created_by=user_id, updated_by=user_id, **payload.model_dump())
    db.add(driver)
    db.commit()
    db.refresh(driver)
    return driver


@router.patch("/{driver_id}", response_model=DriverOut)
def update_driver(
    driver_id: uuid.UUID,
    payload: DriverUpdate,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
    user_id: uuid.UUID = Depends(get_current_user_id),
    _perm: object = Depends(require_permission("fleet.driver.update")),
):
    driver = (
        db.query(Driver)
        .filter(Driver.id == driver_id, Driver.organization_id == org_id, Driver.deleted_at.is_(None))
        .first()
    )
    if not driver:
        raise HTTPException(404, "Driver not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(driver, field, value)
    driver.updated_by = user_id
    db.commit()
    db.refresh(driver)
    return driver


@router.delete("/{driver_id}", status_code=204)
def archive_driver(
    driver_id: uuid.UUID,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
    user_id: uuid.UUID = Depends(get_current_user_id),
    _perm: object = Depends(require_permission("fleet.driver.delete")),
):
    driver = (
        db.query(Driver)
        .filter(Driver.id == driver_id, Driver.organization_id == org_id, Driver.deleted_at.is_(None))
        .first()
    )
    if not driver:
        raise HTTPException(404, "Driver not found")
    driver.deleted_at = datetime.utcnow()
    driver.updated_by = user_id
    db.commit()
