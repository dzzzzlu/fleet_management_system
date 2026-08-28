import uuid
from typing import Any
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_org_id, require_any_role
from app.models.vehicle import Vehicle
from app.models.driver import Driver
from app.models.incident import Incident

router = APIRouter(prefix="/api/archives", tags=["archives"])


def _as_dict(obj) -> dict[str, Any]:
    d = {}
    for col in obj.__table__.columns:
        d[col.name] = getattr(obj, col.name)
    return d


@router.get("/vehicles")
def archived_vehicles(
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
    _role=Depends(require_any_role("administrator", "manager")),
):
    rows = (
        db.query(Vehicle)
        .filter(Vehicle.organization_id == org_id, Vehicle.deleted_at.isnot(None))
        .order_by(Vehicle.deleted_at.desc())
        .all()
    )
    out = []
    for v in rows:
        d = _as_dict(v)
        out.append({
            "id": str(d["id"]),
            "plate_number": d["plate_number"],
            "vehicle_type": d["vehicle_type"],
            "brand": d["brand"],
            "model": d["model"],
            "year": d["year"],
            "status": d["status"],
            "insurance_provider": d["insurance_provider"],
            "deleted_at": d["deleted_at"],
        })
    return out


@router.get("/drivers")
def archived_drivers(
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
    _role=Depends(require_any_role("administrator", "manager")),
):
    rows = (
        db.query(Driver)
        .filter(Driver.organization_id == org_id, Driver.deleted_at.isnot(None))
        .order_by(Driver.deleted_at.desc())
        .all()
    )
    out = []
    for dr in rows:
        d = _as_dict(dr)
        out.append({
            "id": str(d["id"]),
            "employee_number": d["employee_number"],
            "full_name": d["full_name"],
            "license_number": d["license_number"],
            "phone": d["phone"],
            "status": d["status"],
            "deleted_at": d["deleted_at"],
        })
    return out


@router.get("/incidents")
def archived_incidents(
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
    _role=Depends(require_any_role("administrator", "manager")),
):
    rows = (
        db.query(Incident)
        .filter(Incident.organization_id == org_id, Incident.deleted_at.isnot(None))
        .order_by(Incident.deleted_at.desc())
        .all()
    )
    vehicle_ids = {r.vehicle_id for r in rows}
    driver_ids = {r.driver_id for r in rows if r.driver_id}
    vmap = {
        v.id: v.plate_number
        for v in db.query(Vehicle).filter(Vehicle.id.in_(vehicle_ids)).all()
    } if vehicle_ids else {}
    dmap = {
        d.id: d.full_name
        for d in db.query(Driver).filter(Driver.id.in_(driver_ids)).all()
    } if driver_ids else {}

    out = []
    for inc in rows:
        d = _as_dict(inc)
        out.append({
            "id": str(d["id"]),
            "vehicle_id": str(d["vehicle_id"]),
            "vehicle_plate": vmap.get(inc.vehicle_id),
            "driver_name": dmap.get(inc.driver_id),
            "incident_type": d["incident_type"],
            "incident_status": d["incident_status"],
            "incident_date": d["incident_date"],
            "description": d["description"],
            "estimated_cost": d["estimated_cost"],
            "deleted_at": d["deleted_at"],
        })
    return out
