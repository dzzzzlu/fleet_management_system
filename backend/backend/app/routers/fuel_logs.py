import uuid
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_org_id, get_current_user_id, get_current_user, require_permission, driver_record_for_user, driver_assigned_vehicle_ids
from app.models.fuel_log import FuelLog
from app.models.vehicle import Vehicle

router = APIRouter(prefix="/api/fuel-logs", tags=["fuel_logs"])


class FuelLogCreate(BaseModel):
    vehicle_id: uuid.UUID
    driver_id: uuid.UUID | None = None
    fuel_date: date
    liters: Decimal
    cost: Decimal | None = None
    price_per_liter: Decimal | None = None
    odometer: Decimal | None = None
    station: str | None = None


class FuelLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    vehicle_id: uuid.UUID
    driver_id: uuid.UUID | None = None
    fuel_date: date
    liters: Decimal
    cost: Decimal


def _to_out(db: Session, f: FuelLog) -> dict:
    v = db.query(Vehicle).filter(Vehicle.id == f.vehicle_id, Vehicle.deleted_at.is_(None)).first()
    return {
        "id": str(f.id),
        "vehicle_id": str(f.vehicle_id),
        "driver_id": str(f.driver_id) if f.driver_id else None,
        "fuel_date": f.fuel_date.isoformat(),
        "liters": float(f.liters),
        "cost": float(f.cost),
        "price_per_liter": round(float(f.cost) / float(f.liters), 2) if f.liters else None,
        "odometer": float(f.odometer) if f.odometer is not None else None,
        "station": f.station,
        "vehicle_plate": v.plate_number if v else None,
    }


@router.get("")
def list_fuel_logs(
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
    user=Depends(get_current_user),
    _perm: object = Depends(require_permission("fleet.maintenance.view")),
):
    q = db.query(FuelLog).filter(FuelLog.organization_id == org_id, FuelLog.deleted_at.is_(None))
    # --- role='driver' sees ONLY fuel logs for vehicles assigned to them ---
    driver = driver_record_for_user(db, user)
    if user.role == "driver":
        if driver is None:
            return []
        ids = driver_assigned_vehicle_ids(db, driver.id)
        if not ids:
            return []
        q = q.filter(FuelLog.vehicle_id.in_(ids))
    rows = q.order_by(FuelLog.fuel_date.desc()).all()
    return [_to_out(db, r) for r in rows]


@router.post("", response_model=FuelLogOut, status_code=201)
def log_fuel(
    payload: FuelLogCreate,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
    user_id: uuid.UUID = Depends(get_current_user_id),
    _perm: object = Depends(require_permission("fleet.maintenance.create")),
):
    if payload.cost is None:
        if payload.price_per_liter is None:
            raise HTTPException(400, "Provide cost or price_per_liter so the fuel cost can be computed")
        payload.cost = (payload.liters * payload.price_per_liter).quantize(Decimal("0.01"))
    if payload.liters <= 0:
        raise HTTPException(400, "Liters must be greater than zero")

    data = payload.model_dump(exclude={"price_per_liter"})
    record = FuelLog(
        organization_id=org_id, created_by=user_id, updated_by=user_id, logged_by=user_id, **data
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return _to_out(db, record)