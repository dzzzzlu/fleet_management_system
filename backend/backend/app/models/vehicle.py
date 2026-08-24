import uuid
from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import String, Integer, Numeric, Date, DateTime, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
from app.models.mixins import TenantMixin


class Vehicle(Base, TenantMixin):
    __tablename__ = "fleet_vehicles"
    __table_args__ = (
        UniqueConstraint("organization_id", "plate_number", name="uq_fleet_vehicles_org_plate"),
        Index("ix_fleet_vehicles_org_status", "organization_id", "status"),
    )

    plate_number: Mapped[str] = mapped_column(String(20), nullable=False)
    vehicle_type: Mapped[str] = mapped_column(String(30), nullable=False)  # Van, Sedan, Truck...
    brand: Mapped[str] = mapped_column(String(100), nullable=False)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # available | assigned | maintenance | inactive | retired
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="available")

    # --- Additive: insurance (per official module description) ---
    insurance_provider: Mapped[str | None] = mapped_column(String(150), nullable=True)
    insurance_policy_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    insurance_expiry: Mapped[date | None] = mapped_column(Date, nullable=True)

    # --- Additive: GPS as static/manual field only — NOT live tracking (kept excluded per scope) ---
    gps_last_lat: Mapped[Decimal | None] = mapped_column(Numeric(9, 6), nullable=True)
    gps_last_lng: Mapped[Decimal | None] = mapped_column(Numeric(9, 6), nullable=True)
    gps_last_updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
