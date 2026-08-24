import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_org_id, require_permission
from app.models.vehicle import Vehicle
from app.models.driver import Driver
from app.models.trip import Trip
from app.models.maintenance import Maintenance
from app.models.fuel_log import FuelLog

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary")
def dashboard_summary(db: Session = Depends(get_db), org_id: uuid.UUID = Depends(get_current_org_id),
    _perm: object = Depends(require_permission("fleet.report.view"))):
    base_v = db.query(Vehicle).filter(Vehicle.organization_id == org_id, Vehicle.deleted_at.is_(None))

    status_counts = dict(
        base_v.with_entities(Vehicle.status, func.count(Vehicle.id)).group_by(Vehicle.status).all()
    )

    total_vehicles = base_v.count()
    active_drivers = (
        db.query(Driver)
        .filter(Driver.organization_id == org_id, Driver.status == "active", Driver.deleted_at.is_(None))
        .count()
    )
    active_trips = (
        db.query(Trip)
        .filter(Trip.organization_id == org_id, Trip.trip_status.in_(("scheduled", "active")), Trip.deleted_at.is_(None))
        .count()
    )
    pending_maintenance = (
        db.query(Maintenance)
        .filter(Maintenance.organization_id == org_id, Maintenance.maintenance_status == "pending", Maintenance.deleted_at.is_(None))
        .count()
    )

    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    monthly_fuel_cost = (
        db.query(func.coalesce(func.sum(FuelLog.cost), 0))
        .filter(FuelLog.organization_id == org_id, FuelLog.fuel_date >= thirty_days_ago.date())
        .scalar()
    )

    return {
        "total_vehicles": total_vehicles,
        "active_vehicles": status_counts.get("available", 0) + status_counts.get("assigned", 0),
        "vehicles_in_maintenance": status_counts.get("maintenance", 0),
        "active_drivers": active_drivers,
        "active_trips": active_trips,
        "pending_maintenance": pending_maintenance,
        "monthly_fuel_cost": float(monthly_fuel_cost or 0),
        "vehicle_status_distribution": status_counts,
    }
