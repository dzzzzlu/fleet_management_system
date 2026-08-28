import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_org_id, get_current_user_id, get_current_user, require_permission, require_any_permission, driver_record_for_user, driver_assigned_vehicle_ids
from app.models.incident import Incident
from app.schemas.incident import IncidentCreate, IncidentUpdate, IncidentOut

router = APIRouter(prefix="/api/incidents", tags=["incidents"])


@router.get("", response_model=list[IncidentOut])
def list_incidents(
    vehicle_id: uuid.UUID | None = None,
    status_filter: str | None = None,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
    user=Depends(require_permission("fleet.trip.view")),
):
    q = db.query(Incident).filter(Incident.organization_id == org_id, Incident.deleted_at.is_(None))
    if vehicle_id:
        q = q.filter(Incident.vehicle_id == vehicle_id)
    if status_filter:
        q = q.filter(Incident.incident_status == status_filter)
    # role='driver' sees ONLY incidents tied to their own driver record
    driver = driver_record_for_user(db, user)
    if user.role == "driver":
        if driver is None:
            return []
        q = q.filter(Incident.driver_id == driver.id)
    return q.order_by(Incident.created_at.desc()).all()


@router.post("", response_model=IncidentOut, status_code=201)
def create_incident(
    payload: IncidentCreate,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
    user_id: uuid.UUID = Depends(get_current_user_id),
    user=Depends(get_current_user),
    _perm: object = Depends(require_permission("fleet.trip.create")),
):
    # --- driver role: only report incidents on their own vehicle; force driver_id ---
    if user.role == "driver":
        my_driver = driver_record_for_user(db, user)
        if my_driver is None:
            raise HTTPException(403, "No driver profile linked to your account")
        my_vehicle_ids = driver_assigned_vehicle_ids(db, my_driver.id)
        if not my_vehicle_ids:
            raise HTTPException(409, "No vehicle is currently assigned to you")
        if payload.vehicle_id not in my_vehicle_ids:
            raise HTTPException(403, "You may only report incidents on a vehicle assigned to you")
        if payload.driver_id and payload.driver_id != my_driver.id:
            raise HTTPException(403, "You may only report incidents as yourself")
        payload_dict = payload.model_dump()
        payload_dict["driver_id"] = my_driver.id
    else:
        payload_dict = payload.model_dump()

    incident = Incident(
        organization_id=org_id,
        created_by=user_id,
        updated_by=user_id,
        reported_by=user_id,
        **payload_dict,
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)
    return incident


@router.get("/{incident_id}", response_model=IncidentOut)
def get_incident(
    incident_id: uuid.UUID,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
    user=Depends(require_permission("fleet.trip.view")),
):
    incident = (
        db.query(Incident)
        .filter(Incident.id == incident_id, Incident.organization_id == org_id, Incident.deleted_at.is_(None))
        .first()
    )
    if not incident:
        raise HTTPException(404, "Incident not found")
    # role='driver' may only open their own incidents
    driver = driver_record_for_user(db, user)
    if user.role == "driver" and (driver is None or incident.driver_id != driver.id):
        raise HTTPException(404, "Incident not found")
    return incident


@router.patch("/{incident_id}", response_model=IncidentOut)
def update_incident(
    incident_id: uuid.UUID,
    payload: IncidentUpdate,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
    user_id: uuid.UUID = Depends(get_current_user_id),
    _perm: object = Depends(require_permission("fleet.trip.update")),
):
    incident = (
        db.query(Incident)
        .filter(Incident.id == incident_id, Incident.organization_id == org_id, Incident.deleted_at.is_(None))
        .first()
    )
    if not incident:
        raise HTTPException(404, "Incident not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(incident, field, value)
    incident.updated_by = user_id

    db.commit()
    db.refresh(incident)
    return incident


@router.delete("/{incident_id}", status_code=204)
def archive_incident(
    incident_id: uuid.UUID,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
    user_id: uuid.UUID = Depends(get_current_user_id),
    _perm: object = Depends(require_permission("fleet.trip.update")),
):
    """Soft-delete only — never a hard DELETE, per audit requirements."""
    from datetime import datetime

    incident = (
        db.query(Incident)
        .filter(Incident.id == incident_id, Incident.organization_id == org_id, Incident.deleted_at.is_(None))
        .first()
    )
    if not incident:
        raise HTTPException(404, "Incident not found")

    incident.deleted_at = datetime.utcnow()
    incident.updated_by = user_id
    db.commit()
