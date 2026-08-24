import uuid
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict


class IncidentBase(BaseModel):
    vehicle_id: uuid.UUID
    driver_id: uuid.UUID | None = None
    incident_date: date
    incident_type: str
    description: str | None = None
    estimated_cost: Decimal | None = None
    incident_status: str = "reported"


class IncidentCreate(IncidentBase):
    pass


class IncidentUpdate(BaseModel):
    driver_id: uuid.UUID | None = None
    incident_date: date | None = None
    incident_type: str | None = None
    description: str | None = None
    estimated_cost: Decimal | None = None
    incident_status: str | None = None


class IncidentOut(IncidentBase):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    organization_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
