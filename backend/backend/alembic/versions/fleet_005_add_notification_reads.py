"""fleet_005: add notification_reads (per-user read tracking for derived feed)

Revision ID: fleet_005
Revises: fleet_004
Create Date: 2026-08-28

Additive only — no columns removed or altered.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "fleet_005"
down_revision = "fleet_004"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "notification_reads",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("notification_key", sa.String(120), nullable=False),
        sa.Column("read_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("user_id", "notification_key", name="uq_notification_reads_user_key"),
    )


def downgrade():
    op.drop_table("notification_reads")
