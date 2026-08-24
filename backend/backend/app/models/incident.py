import uuid
from datetime import date
from decimal import Decimal
from sqlalchemy import String, Date, Text, Numeric, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
from app.models.mixins import TenantMixin


class Incident(Base, TenantMixin):
    """Additive: vehicle incident/accident/violation log (per official module description)."""

    __tablename__ = "fleet_incidents"
    __table_args__ = (
        Index("ix_fleet_incidents_org_status", "organization_id", "incident_status"),
    )

    vehicle_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("fleet_vehicles.id"), nullable=False, index=True
    )
    driver_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("fleet_drivers.id"), nullable=True, index=True
    )
    # loose UUID — who reported it; NEVER FK to users
    reported_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    incident_date: Mapped[date] = mapped_column(Date, nullable=False)
    # accident | damage | violation | theft | other
    incident_type: Mapped[str] = mapped_column(String(30), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    estimated_cost: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    # reported | under_review | resolved | closed
    incident_status: Mapped[str] = mapped_column(String(20), nullable=False, default="reported")
