import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_org_id, get_current_user_id, require_permission, driver_record_for_user
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
    _perm: object = Depends(require_permission("fleet.trip.create")),
):
    incident = Incident(
        organization_id=org_id,
        created_by=user_id,
        updated_by=user_id,
        **payload.model_dump(),
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
