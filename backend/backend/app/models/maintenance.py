import uuid
from datetime import date
from decimal import Decimal
from sqlalchemy import String, Date, Text, Numeric, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
from app.models.mixins import TenantMixin


class Maintenance(Base, TenantMixin):
    __tablename__ = "fleet_maintenance"
    __table_args__ = (
        Index("ix_fleet_maintenance_org_status", "organization_id", "maintenance_status"),
    )

    vehicle_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("fleet_vehicles.id"), nullable=False, index=True
    )
    # loose UUID — who requested it; NEVER FK to users
    requested_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    maintenance_type: Mapped[str] = mapped_column(String(100), nullable=False)
    scheduled_date: Mapped[date] = mapped_column(Date, nullable=False)
    completed_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    cost: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    # pending | in_progress | completed | cancelled
    maintenance_status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
