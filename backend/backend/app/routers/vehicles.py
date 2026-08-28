import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_org_id, get_current_user_id, get_current_user, require_permission, driver_record_for_user, driver_assigned_vehicle_ids
from app.models.vehicle import Vehicle
from app.models.vehicle_assignment import VehicleAssignment
from app.schemas.vehicle import VehicleCreate, VehicleUpdate, VehicleOut

router = APIRouter(prefix="/api/vehicles", tags=["vehicles"])


@router.get("", response_model=list[VehicleOut])
def list_vehicles(
    status_filter: str | None = None,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
    user=Depends(get_current_user),
    _perm: object = Depends(require_permission("fleet.vehicle.view")),
):
    q = db.query(Vehicle).filter(Vehicle.organization_id == org_id, Vehicle.deleted_at.is_(None))
    # --- role='driver' sees ONLY the vehicle(s) currently assigned to them ---
    driver = driver_record_for_user(db, user)
    if user.role == "driver":
        if driver is None:
            return []
        ids = driver_assigned_vehicle_ids(db, driver.id)
        if not ids:
            return []
        q = q.filter(Vehicle.id.in_(ids))
    if status_filter:
        q = q.filter(Vehicle.status == status_filter)
    return q.order_by(Vehicle.created_at.desc()).all()


@router.post("", response_model=VehicleOut, status_code=201)
def create_vehicle(
    payload: VehicleCreate,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
    user_id: uuid.UUID = Depends(get_current_user_id),
    _perm: object = Depends(require_permission("fleet.vehicle.create")),
):
    existing = (
        db.query(Vehicle)
        .filter(Vehicle.organization_id == org_id, Vehicle.plate_number == payload.plate_number)
        .first()
    )
    if existing:
        raise HTTPException(409, "Plate number already registered for this organization")

    vehicle = Vehicle(
        organization_id=org_id,
        created_by=user_id,
        updated_by=user_id,
        **payload.model_dump(),
    )
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    return vehicle


@router.get("/{vehicle_id}", response_model=VehicleOut)
def get_vehicle(
    vehicle_id: uuid.UUID,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
    _perm: object = Depends(require_permission("fleet.vehicle.view")),
):
    vehicle = (
        db.query(Vehicle)
        .filter(Vehicle.id == vehicle_id, Vehicle.organization_id == org_id, Vehicle.deleted_at.is_(None))
        .first()
    )
    if not vehicle:
        raise HTTPException(404, "Vehicle not found")
    return vehicle


@router.patch("/{vehicle_id}", response_model=VehicleOut)
def update_vehicle(
    vehicle_id: uuid.UUID,
    payload: VehicleUpdate,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
    user_id: uuid.UUID = Depends(get_current_user_id),
    _perm: object = Depends(require_permission("fleet.vehicle.update")),
):
    vehicle = (
        db.query(Vehicle)
        .filter(Vehicle.id == vehicle_id, Vehicle.organization_id == org_id, Vehicle.deleted_at.is_(None))
        .first()
    )
    if not vehicle:
        raise HTTPException(404, "Vehicle not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(vehicle, field, value)
    vehicle.updated_by = user_id

    db.commit()
    db.refresh(vehicle)
    return vehicle


@router.delete("/{vehicle_id}", status_code=204)
def archive_vehicle(
    vehicle_id: uuid.UUID,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
    user_id: uuid.UUID = Depends(get_current_user_id),
    _perm: object = Depends(require_permission("fleet.vehicle.delete")),
):
    """Soft-delete only — never a hard DELETE, per audit requirements."""
    from datetime import datetime

    vehicle = (
        db.query(Vehicle)
        .filter(Vehicle.id == vehicle_id, Vehicle.organization_id == org_id, Vehicle.deleted_at.is_(None))
        .first()
    )
    if not vehicle:
        raise HTTPException(404, "Vehicle not found")

    vehicle.deleted_at = datetime.utcnow()
    vehicle.updated_by = user_id
    db.commit()
