"""
Read-tracking for the notification feed.
Notifications themselves are DERIVED from live org data (see app/notifications.py);
this table only records which notification keys each user has marked as read.
user_id is a LOOSE UUID (no FK) per the Argo integration contract golden rule.
"""
import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class NotificationRead(Base):
    __tablename__ = "notification_reads"
    __table_args__ = (
        UniqueConstraint("user_id", "notification_key", name="uq_notification_reads_user_key"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # LOOSE UUID — the user who marked it read; NO FK (contract golden rule)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    notification_key: Mapped[str] = mapped_column(String(120), nullable=False)
    read_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
