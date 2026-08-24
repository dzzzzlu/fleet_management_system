import uuid
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_org_id, get_current_user_id, require_permission
from app.models.fuel_log import FuelLog

router = APIRouter(prefix="/api/fuel-logs", tags=["fuel_logs"])


class FuelLogCreate(BaseModel):
    vehicle_id: uuid.UUID
    driver_id: uuid.UUID | None = None
    fuel_date: date
    liters: Decimal
    cost: Decimal
    odometer: Decimal | None = None
    station: str | None = None


class FuelLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    vehicle_id: uuid.UUID
    fuel_date: date
    liters: Decimal
    cost: Decimal


@router.get("", response_model=list[FuelLogOut])
def list_fuel_logs(db: Session = Depends(get_db), org_id: uuid.UUID = Depends(get_current_org_id),
    _perm: object = Depends(require_permission("fleet.maintenance.view"))):
    return (
        db.query(FuelLog)
        .filter(FuelLog.organization_id == org_id, FuelLog.deleted_at.is_(None))
        .order_by(FuelLog.fuel_date.desc())
        .all()
    )


@router.post("", response_model=FuelLogOut, status_code=201)
def log_fuel(
    payload: FuelLogCreate,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
    user_id: uuid.UUID = Depends(get_current_user_id),
    _perm: object = Depends(require_permission("fleet.maintenance.create")),
):
    record = FuelLog(
        organization_id=org_id, created_by=user_id, updated_by=user_id, logged_by=user_id, **payload.model_dump()
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record
