import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_org_id, get_current_user_id, require_permission, driver_record_for_user
from app.models.trip import Trip
from app.models.vehicle import Vehicle
from app.models.driver import Driver
from app.models.vehicle_assignment import VehicleAssignment
from app.schemas.trip import TripCreate, TripStatusUpdate, TripOut

router = APIRouter(prefix="/api/trips", tags=["trips"])


@router.get("", response_model=list[TripOut])
def list_trips(
    trip_status: str | None = None,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
    user=Depends(require_permission("fleet.trip.view")),
):
    q = db.query(Trip).filter(Trip.organization_id == org_id, Trip.deleted_at.is_(None))
    if trip_status:
        q = q.filter(Trip.trip_status == trip_status)
    # role='driver' sees ONLY their own trips (linked via fleet_drivers.user_id)
    driver = driver_record_for_user(db, user)
    if user.role == "driver":
        if driver is None:
            return []
        q = q.filter(Trip.driver_id == driver.id)
    return q.order_by(Trip.departure_time.desc()).all()


@router.post("", response_model=TripOut, status_code=201)
def log_trip(
    payload: TripCreate,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
    user_id: uuid.UUID = Depends(get_current_user_id),
    _perm: object = Depends(require_permission("fleet.trip.create")),
):
    """
    Mirrors the Database Process Flow diagram:
    Validate -> BEGIN TRANSACTION (insert trip, update vehicle status) ->
    create assignment record (update driver status) -> COMMIT.
    Any failure rolls back the whole thing (no partial records / no double-booking).
    """
    vehicle = (
        db.query(Vehicle)
        .filter(Vehicle.id == payload.vehicle_id, Vehicle.organization_id == org_id, Vehicle.deleted_at.is_(None))
        .with_for_update()
        .first()
    )
    driver = (
        db.query(Driver)
        .filter(Driver.id == payload.driver_id, Driver.organization_id == org_id, Driver.deleted_at.is_(None))
        .with_for_update()
        .first()
    )

    # --- Validate Request: vehicle available, driver active ---
    if not vehicle or vehicle.status != "available":
        raise HTTPException(409, "Vehicle is not available")
    if not driver or driver.status != "active":
        raise HTTPException(409, "Driver is not active/available")

    try:
        # --- BEGIN TRANSACTION ---
        trip = Trip(
            organization_id=org_id,
            created_by=user_id,
            updated_by=user_id,
            trip_status="scheduled",
            **payload.model_dump(),
        )
        db.add(trip)
        vehicle.status = "assigned"
        vehicle.updated_by = user_id

        # --- Create Assignment Record ---
        assignment = VehicleAssignment(
            organization_id=org_id,
            created_by=user_id,
            updated_by=user_id,
            vehicle_id=vehicle.id,
            driver_id=driver.id,
            assigned_by=user_id,
            assigned_date=payload.departure_time.date(),
            assignment_status="active",
        )
        db.add(assignment)
        driver.status = "active"  # stays active; kept assigned via assignment record
        driver.updated_by = user_id

        db.commit()  # --- COMMIT ---
    except Exception:
        db.rollback()  # --- Reject Request: no partial records saved ---
        raise HTTPException(500, "Trip could not be created; no changes were saved")

    db.refresh(trip)
    return trip


@router.patch("/{trip_id}/status", response_model=TripOut)
def update_trip_status(
    trip_id: uuid.UUID,
    payload: TripStatusUpdate,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
    user_id: uuid.UUID = Depends(get_current_user_id),
    _perm: object = Depends(require_permission("fleet.trip.update")),
):
    trip = (
        db.query(Trip)
        .filter(Trip.id == trip_id, Trip.organization_id == org_id, Trip.deleted_at.is_(None))
        .first()
    )
    if not trip:
        raise HTTPException(404, "Trip not found")

    trip.trip_status = payload.trip_status
    if payload.arrival_time:
        trip.arrival_time = payload.arrival_time
    if payload.odometer_end is not None:
        trip.odometer_end = payload.odometer_end
    trip.updated_by = user_id

    # --- Trip Completed -> Release Vehicle (vehicle=Available, assignment.returned_date set) ---
    if payload.trip_status in ("completed", "cancelled"):
        vehicle = db.query(Vehicle).filter(Vehicle.id == trip.vehicle_id).with_for_update().first()
        if vehicle:
            vehicle.status = "available"
            vehicle.updated_by = user_id

        assignment = (
            db.query(VehicleAssignment)
            .filter(
                VehicleAssignment.vehicle_id == trip.vehicle_id,
                VehicleAssignment.driver_id == trip.driver_id,
                VehicleAssignment.assignment_status == "active",
            )
            .first()
        )
        if assignment:
            assignment.assignment_status = "returned"
            assignment.returned_date = datetime.utcnow().date()
            assignment.updated_by = user_id

    db.commit()
    db.refresh(trip)
    return trip
