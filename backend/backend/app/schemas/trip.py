import uuid
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict


class TripCreate(BaseModel):
    vehicle_id: uuid.UUID
    driver_id: uuid.UUID
    trip_number: str
    destination: str
    departure_time: datetime
    odometer_start: Decimal | None = None


class TripStatusUpdate(BaseModel):
    trip_status: str  # active | completed | cancelled
    arrival_time: datetime | None = None
    odometer_end: Decimal | None = None


class TripOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    organization_id: uuid.UUID
    vehicle_id: uuid.UUID
    driver_id: uuid.UUID
    trip_number: str
    destination: str
    departure_time: datetime
    arrival_time: datetime | None
    trip_status: str
