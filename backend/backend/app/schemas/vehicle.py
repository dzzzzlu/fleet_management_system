import uuid
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict


class VehicleBase(BaseModel):
    plate_number: str
    vehicle_type: str
    brand: str
    model: str
    year: int | None = None
    status: str = "available"
    # additive
    insurance_provider: str | None = None
    insurance_policy_number: str | None = None
    insurance_expiry: date | None = None
    gps_last_lat: Decimal | None = None
    gps_last_lng: Decimal | None = None
    gps_last_updated_at: datetime | None = None


class VehicleCreate(VehicleBase):
    pass


class VehicleUpdate(BaseModel):
    plate_number: str | None = None
    vehicle_type: str | None = None
    brand: str | None = None
    model: str | None = None
    year: int | None = None
    status: str | None = None
    # additive
    insurance_provider: str | None = None
    insurance_policy_number: str | None = None
    insurance_expiry: date | None = None
    gps_last_lat: Decimal | None = None
    gps_last_lng: Decimal | None = None
    gps_last_updated_at: datetime | None = None


class VehicleOut(VehicleBase):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    organization_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
