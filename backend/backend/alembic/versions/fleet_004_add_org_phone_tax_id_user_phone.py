"""fleet_004: add phone/tax_id to organizations, phone to users

Revision ID: fleet_004
Revises: fleet_003
Create Date: 2026-08-17

Additive only — no columns removed or altered.
"""
from alembic import op
import sqlalchemy as sa

revision = "fleet_004"
down_revision = "fleet_003"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("organizations", sa.Column("phone", sa.String(30), nullable=True))
    op.add_column("organizations", sa.Column("tax_id", sa.String(100), nullable=True))
    op.add_column("users", sa.Column("phone", sa.String(30), nullable=True))


def downgrade():
    op.drop_column("users", "phone")
    op.drop_column("organizations", "tax_id")
    op.drop_column("organizations", "phone")
