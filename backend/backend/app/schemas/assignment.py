import uuid
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict


class AssignmentCreate(BaseModel):
    vehicle_id: uuid.UUID
    driver_id: uuid.UUID
    assigned_date: date
    notes: str | None = None


class AssignmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    organization_id: uuid.UUID
    vehicle_id: uuid.UUID
    driver_id: uuid.UUID
    assigned_date: date
    returned_date: date | None
    assignment_status: str
    notes: str | None
    created_at: datetime
