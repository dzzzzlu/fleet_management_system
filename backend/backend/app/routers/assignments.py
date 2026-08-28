import uuid
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import (
    get_current_org_id,
    get_current_user_id,
    get_current_user,
    require_any_role,
    require_permission,
    driver_record_for_user,
)
from app.models.vehicle_assignment import VehicleAssignment
from app.models.driver import Driver
from app.models.vehicle import Vehicle
from app.schemas.assignment import AssignmentCreate

router = APIRouter(prefix="/api/assignments", tags=["assignments"])


def _missing_active(db: Session, org_id, driver_id=None, vehicle_id=None):
    """Return the first non-returned/non-cancelled assignment matching the filter, or None."""
    q = db.query(VehicleAssignment).filter(
        VehicleAssignment.organization_id == org_id,
        VehicleAssignment.deleted_at.is_(None),
        VehicleAssignment.assignment_status == "active",
    )
    if driver_id is not None:
        q = q.filter(VehicleAssignment.driver_id == driver_id)
    if vehicle_id is not None:
        q = q.filter(VehicleAssignment.vehicle_id == vehicle_id)
    return q.first()


def _serialize(a: VehicleAssignment, db: Session) -> dict:
    driver = db.query(Driver).filter(Driver.id == a.driver_id, Driver.deleted_at.is_(None)).first()
    vehicle = db.query(Vehicle).filter(Vehicle.id == a.vehicle_id, Vehicle.deleted_at.is_(None)).first()
    today = date.today()
    if a.returned_date is not None:
        display_status = "returned"
    elif a.assignment_status != "active":
        display_status = a.assignment_status
    elif a.assigned_date > today:
        display_status = "scheduled"
    else:
        display_status = "active"
    return {
        "id": str(a.id),
        "organization_id": str(a.organization_id),
        "vehicle_id": str(a.vehicle_id),
        "driver_id": str(a.driver_id),
        "assigned_date": a.assigned_date.isoformat(),
        "returned_date": a.returned_date.isoformat() if a.returned_date else None,
        "assignment_status": a.assignment_status,
        "display_status": display_status,
        "notes": a.notes,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "driver_name": driver.full_name if driver else None,
        "driver_employee_number": driver.employee_number if driver else None,
        "vehicle_plate": vehicle.plate_number if vehicle else None,
        "vehicle_brand": vehicle.brand if vehicle else None,
        "vehicle_model": vehicle.model if vehicle else None,
    }


@router.get("")
def list_assignments(
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
    user=Depends(get_current_user),
    _perm=Depends(require_permission("fleet.driver.view")),
):
    q = db.query(VehicleAssignment).filter(
        VehicleAssignment.organization_id == org_id,
        VehicleAssignment.deleted_at.is_(None),
    )
    if user.role == "driver":
        driver = driver_record_for_user(db, user)
        if driver is None:
            return []
        q = q.filter(VehicleAssignment.driver_id == driver.id)
    rows = q.order_by(VehicleAssignment.created_at.desc()).all()
    return [_serialize(r, db) for r in rows]


@router.post("", status_code=201)
def create_assignment(
    payload: AssignmentCreate,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
    user_id: uuid.UUID = Depends(get_current_user_id),
    _perm=Depends(require_any_role("administrator", "manager")),
):
    today = date.today()
    if payload.assigned_date <= today:
        raise HTTPException(
            400, "A vehicle cannot be assigned on today's date — pick a future date."
        )
    driver = (
        db.query(Driver)
        .filter(Driver.id == payload.driver_id, Driver.organization_id == org_id, Driver.deleted_at.is_(None))
        .first()
    )
    if not driver:
        raise HTTPException(404, "Driver not found")
    vehicle = (
        db.query(Vehicle)
        .filter(Vehicle.id == payload.vehicle_id, Vehicle.organization_id == org_id, Vehicle.deleted_at.is_(None))
        .first()
    )
    if not vehicle:
        raise HTTPException(404, "Vehicle not found")
    if _missing_active(db, org_id, vehicle_id=payload.vehicle_id):
        raise HTTPException(400, "Vehicle is already assigned (active or scheduled). Return it before reassigning.")
    if _missing_active(db, org_id, driver_id=payload.driver_id):
        raise HTTPException(400, "Driver already has an active/scheduled assignment. Return it first.")

    a = VehicleAssignment(
        organization_id=org_id,
        vehicle_id=payload.vehicle_id,
        driver_id=payload.driver_id,
        assigned_by=user_id,
        assigned_date=payload.assigned_date,
        assignment_status="active",
        notes=payload.notes,
        created_by=user_id,
        updated_by=user_id,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return _serialize(a, db)


@router.post("/{assignment_id}/return")
def return_assignment(
    assignment_id: uuid.UUID,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
    user_id: uuid.UUID = Depends(get_current_user_id),
    _perm=Depends(require_any_role("administrator", "manager")),
):
    a = (
        db.query(VehicleAssignment)
        .filter(
            VehicleAssignment.id == assignment_id,
            VehicleAssignment.organization_id == org_id,
            VehicleAssignment.deleted_at.is_(None),
            VehicleAssignment.assignment_status == "active",
        )
        .first()
    )
    if not a:
        raise HTTPException(404, "Active assignment not found")
    a.assignment_status = "returned"
    a.returned_date = date.today()
    a.updated_by = user_id
    db.commit()
    db.refresh(a)
    return _serialize(a, db)
