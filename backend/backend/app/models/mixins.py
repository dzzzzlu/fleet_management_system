"""
Shared column blocks used by every fleet_* table.
Per the Argo DB Integration Contract:
  - id: UUID PK, default=uuid.uuid4
  - organization_id: UUID, HARD FK -> organizations.id, CASCADE, NOT NULL, indexed
  - created_at / updated_at: NOT NULL, server-side defaults
  - created_by / updated_by: LOOSE UUID, NO FK constraint
  - deleted_at: nullable, for soft-delete
"""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column


class TenantMixin:
    """org boundary + audit columns. Mix into every fleet_* model."""

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    # LOOSE UUIDs — a user id, but NEVER a foreign key (contract Golden Rule)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
