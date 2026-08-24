"""zzz_local_stub: LOCAL SANDBOX ONLY

Revision ID: zzz_local_stub
Revises: fleet_001

⚠️ DO NOT hand this file over / include in your MR to GitLab.
This only exists so fleet_vehicles.organization_id has something to point at
on your machine. At integration, real Argo organizations/users take over and
your FKs line up automatically (contract §9).
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
import uuid

revision = "zzz_local_stub"
down_revision = None
branch_labels = None
depends_on = None

FAKE_ORG_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")


def upgrade():
    op.create_table(
        "organizations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
    )
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
    )
    op.bulk_insert(
        sa.table("organizations", sa.column("id", UUID), sa.column("name", sa.String)),
        [{"id": FAKE_ORG_ID, "name": "Metro Fleet Corp."}],
    )


def downgrade():
    op.drop_table("users")
    op.drop_table("organizations")
