import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, DateTime, Numeric, UniqueConstraint, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
from app.models.mixins import TenantMixin


class Trip(Base, TenantMixin):
    __tablename__ = "fleet_trips"
    __table_args__ = (
        UniqueConstraint("organization_id", "trip_number", name="uq_fleet_trips_org_number"),
        Index("ix_fleet_trips_org_status", "organization_id", "trip_status"),
    )

    vehicle_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("fleet_vehicles.id"), nullable=False, index=True
    )
    driver_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("fleet_drivers.id"), nullable=False, index=True
    )

    trip_number: Mapped[str] = mapped_column(String(30), nullable=False)
    destination: Mapped[str] = mapped_column(String(255), nullable=False)
    departure_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    arrival_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    odometer_start: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    odometer_end: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    # scheduled | active | completed | cancelled
    trip_status: Mapped[str] = mapped_column(String(20), nullable=False, default="scheduled")
