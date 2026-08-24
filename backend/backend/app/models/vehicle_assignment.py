import uuid
from datetime import date
from sqlalchemy import String, Date, Text, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
from app.models.mixins import TenantMixin


class VehicleAssignment(Base, TenantMixin):
    """Junction: which driver is/was assigned to which vehicle."""
    __tablename__ = "fleet_vehicle_assignments"
    __table_args__ = (
        Index("ix_fleet_va_org_status", "organization_id", "assignment_status"),
    )

    # in-module FKs are allowed (contract rule 4)
    vehicle_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("fleet_vehicles.id"), nullable=False, index=True
    )
    driver_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("fleet_drivers.id"), nullable=False, index=True
    )
    # loose UUID — the dispatcher/user who made the assignment; NEVER FK to users
    assigned_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    assigned_date: Mapped[date] = mapped_column(Date, nullable=False)
    returned_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    # active | returned | cancelled
    assignment_status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
