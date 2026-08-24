import uuid
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict


class DriverBase(BaseModel):
    employee_number: str
    full_name: str
    license_number: str
    license_expiry: date | None = None
    phone: str | None = None
    status: str = "active"


class DriverCreate(DriverBase):
    pass


class DriverUpdate(BaseModel):
    full_name: str | None = None
    license_number: str | None = None
    license_expiry: date | None = None
    phone: str | None = None
    status: str | None = None


class DriverOut(DriverBase):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    organization_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
