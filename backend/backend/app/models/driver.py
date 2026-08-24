import uuid
from datetime import date
from sqlalchemy import String, Date, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
from app.models.mixins import TenantMixin


class Driver(Base, TenantMixin):
    __tablename__ = "fleet_drivers"
    __table_args__ = (
        UniqueConstraint("organization_id", "employee_number", name="uq_fleet_drivers_org_empno"),
        UniqueConstraint("organization_id", "license_number", name="uq_fleet_drivers_org_license"),
        Index("ix_fleet_drivers_org_status", "organization_id", "status"),
    )

    # loose UUID reference to the platform user account — NEVER a FK (contract rule 4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    employee_number: Mapped[str] = mapped_column(String(30), nullable=False)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    license_number: Mapped[str] = mapped_column(String(50), nullable=False)
    license_expiry: Mapped[date | None] = mapped_column(Date, nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    # active | inactive | suspended
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
