import uuid
from datetime import date, datetime
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_org_id, get_current_user_id, require_permission, driver_record_for_user
from app.models.maintenance import Maintenance
from app.models.vehicle import Vehicle
from app.models.vehicle_assignment import VehicleAssignment

router = APIRouter(prefix="/api/maintenance", tags=["maintenance"])


class MaintenanceCreate(BaseModel):
    vehicle_id: uuid.UUID
    maintenance_type: str
    scheduled_date: date


class MaintenanceStatusUpdate(BaseModel):
    maintenance_status: str  # pending | in_progress | completed | cancelled
    completed_date: date | None = None
    cost: Decimal | None = None
    remarks: str | None = None


class MaintenanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    vehicle_id: uuid.UUID
    maintenance_type: str
    scheduled_date: date
    completed_date: date | None
    cost: Decimal | None
    maintenance_status: str


@router.get("", response_model=list[MaintenanceOut])
def list_maintenance(db: Session = Depends(get_db), org_id: uuid.UUID = Depends(get_current_org_id),
    user=Depends(require_permission("fleet.maintenance.view"))):
    q = (
        db.query(Maintenance)
        .filter(Maintenance.organization_id == org_id, Maintenance.deleted_at.is_(None))
    )
    # role='driver' sees ONLY maintenance on vehicles assigned to them
    driver = driver_record_for_user(db, user)
    if user.role == "driver":
        if driver is None:
            return []
        assigned_vehicle_ids = [
            row[0]
            for row in db.query(VehicleAssignment.vehicle_id)
            .filter(
                VehicleAssignment.driver_id == driver.id,
                VehicleAssignment.assignment_status == "active",
                VehicleAssignment.deleted_at.is_(None),
            )
            .all()
        ]
        q = q.filter(Maintenance.vehicle_id.in_(assigned_vehicle_ids))
    return q.order_by(Maintenance.scheduled_date.desc()).all()


@router.post("", response_model=MaintenanceOut, status_code=201)
def schedule_maintenance(
    payload: MaintenanceCreate,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
    user_id: uuid.UUID = Depends(get_current_user_id),
    _perm: object = Depends(require_permission("fleet.maintenance.create")),
):
    vehicle = (
        db.query(Vehicle)
        .filter(Vehicle.id == payload.vehicle_id, Vehicle.organization_id == org_id)
        .with_for_update()
        .first()
    )
    if not vehicle:
        raise HTTPException(404, "Vehicle not found")

    record = Maintenance(
        organization_id=org_id,
        created_by=user_id,
        updated_by=user_id,
        requested_by=user_id,
        maintenance_status="pending",
        **payload.model_dump(),
    )
    db.add(record)
    vehicle.status = "maintenance"
    vehicle.updated_by = user_id
    db.commit()
    db.refresh(record)
    return record


@router.patch("/{maintenance_id}/status", response_model=MaintenanceOut)
def update_maintenance_status(
    maintenance_id: uuid.UUID,
    payload: MaintenanceStatusUpdate,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
    user_id: uuid.UUID = Depends(get_current_user_id),
    _perm: object = Depends(require_permission("fleet.maintenance.update")),
):
    record = (
        db.query(Maintenance)
        .filter(Maintenance.id == maintenance_id, Maintenance.organization_id == org_id, Maintenance.deleted_at.is_(None))
        .first()
    )
    if not record:
        raise HTTPException(404, "Maintenance record not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(record, field, value)
    record.updated_by = user_id

    if payload.maintenance_status in ("completed", "cancelled"):
        vehicle = db.query(Vehicle).filter(Vehicle.id == record.vehicle_id).with_for_update().first()
        if vehicle:
            vehicle.status = "available"
            vehicle.updated_by = user_id

    db.commit()
    db.refresh(record)
    return record
