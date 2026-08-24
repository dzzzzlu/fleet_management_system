import uuid
from datetime import date
from decimal import Decimal
from sqlalchemy import String, Date, Text, Numeric, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
from app.models.mixins import TenantMixin


class FuelLog(Base, TenantMixin):
    __tablename__ = "fleet_fuel_logs"
    __table_args__ = (
        Index("ix_fleet_fuel_logs_org_date", "organization_id", "fuel_date"),
    )

    vehicle_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("fleet_vehicles.id"), nullable=False, index=True
    )
    driver_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("fleet_drivers.id"), nullable=True, index=True
    )
    # loose UUID — who logged the fuel entry; NEVER FK to users
    logged_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    fuel_date: Mapped[date] = mapped_column(Date, nullable=False)
    liters: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    odometer: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    station: Mapped[str | None] = mapped_column(String(150), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
