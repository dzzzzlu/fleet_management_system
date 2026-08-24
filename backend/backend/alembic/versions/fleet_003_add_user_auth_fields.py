"""fleet_003: add auth fields to users (password_hash, role, org link, active)

Revision ID: fleet_003
Revises: fleet_002
Create Date: 2026-08-13

NOTE: purely additive to `users` — no fleet_* table touched, per plan
(DB change limited to the users table).
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
import uuid

revision = "fleet_003"
down_revision = "fleet_002"
branch_labels = None
depends_on = None

FAKE_ORG_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")


def upgrade():
    op.add_column("users", sa.Column("organization_id", UUID(as_uuid=True), nullable=True))
    op.add_column("users", sa.Column("full_name", sa.String(150), nullable=True))
    op.add_column("users", sa.Column("password_hash", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("role", sa.String(20), nullable=False, server_default="viewer"))
    op.add_column("users", sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"))
    op.add_column(
        "users", sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now())
    )
    op.add_column(
        "users", sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now())
    )

    op.create_foreign_key(
        "fk_users_organization_id", "users", "organizations", ["organization_id"], ["id"], ondelete="CASCADE"
    )
    op.create_unique_constraint("uq_users_email", "users", ["email"])
    op.create_check_constraint(
        "ck_users_role", "users", "role IN ('viewer','staff','manager','administrator','driver')"
    )

    # backfill any pre-existing row (local sandbox) to the default org so
    # organization_id can be made NOT NULL
    op.execute(f"UPDATE users SET organization_id = '{FAKE_ORG_ID}' WHERE organization_id IS NULL")
    op.alter_column("users", "organization_id", nullable=False)


def downgrade():
    op.drop_constraint("ck_users_role", "users", type_="check")
    op.drop_constraint("uq_users_email", "users", type_="unique")
    op.drop_constraint("fk_users_organization_id", "users", type_="foreignkey")
    for col in ["updated_at", "created_at", "is_active", "role", "password_hash", "full_name", "organization_id"]:
        op.drop_column("users", col)
