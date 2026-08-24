"""fleet_002: add insurance + static GPS fields to fleet_vehicles, create fleet_incidents

Revision ID: fleet_002
Revises: fleet_001
Create Date: 2026-08-04

NOTE: purely additive — no existing column/table from fleet_001 is altered or dropped.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "fleet_002"
down_revision = "fleet_001"
branch_labels = None
depends_on = None


def _audit_columns():
    return [
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
        sa.Column("created_by", UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", UUID(as_uuid=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime, nullable=True),
    ]


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    existing_vehicle_cols = {c["name"] for c in inspector.get_columns("fleet_vehicles")}
    if "insurance_provider" not in existing_vehicle_cols:
        op.add_column("fleet_vehicles", sa.Column("insurance_provider", sa.String(150), nullable=True))
    if "insurance_policy_number" not in existing_vehicle_cols:
        op.add_column("fleet_vehicles", sa.Column("insurance_policy_number", sa.String(100), nullable=True))
    if "insurance_expiry" not in existing_vehicle_cols:
        op.add_column("fleet_vehicles", sa.Column("insurance_expiry", sa.Date, nullable=True))
    if "gps_last_lat" not in existing_vehicle_cols:
        op.add_column("fleet_vehicles", sa.Column("gps_last_lat", sa.Numeric(9, 6), nullable=True))
    if "gps_last_lng" not in existing_vehicle_cols:
        op.add_column("fleet_vehicles", sa.Column("gps_last_lng", sa.Numeric(9, 6), nullable=True))
    if "gps_last_updated_at" not in existing_vehicle_cols:
        op.add_column("fleet_vehicles", sa.Column("gps_last_updated_at", sa.DateTime, nullable=True))

    existing_tables = set(inspector.get_table_names())
    if "fleet_incidents" not in existing_tables:
        op.create_table(
            "fleet_incidents",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column("organization_id", UUID(as_uuid=True),
                      sa.ForeignKey("organizations.id", ondelete="CASCADE"),
                      nullable=False, index=True),
            sa.Column("vehicle_id", UUID(as_uuid=True), sa.ForeignKey("fleet_vehicles.id"), nullable=False, index=True),
            sa.Column("driver_id", UUID(as_uuid=True), sa.ForeignKey("fleet_drivers.id"), nullable=True, index=True),
            sa.Column("reported_by", UUID(as_uuid=True), nullable=True),  # loose, no FK
            sa.Column("incident_date", sa.Date, nullable=False),
            sa.Column("incident_type", sa.String(30), nullable=False),
            sa.Column("description", sa.Text, nullable=True),
            sa.Column("estimated_cost", sa.Numeric(12, 2), nullable=True),
            sa.Column("incident_status", sa.String(20), nullable=False, server_default="reported"),
            *_audit_columns(),
        )
        op.create_index("ix_fleet_incidents_org_status", "fleet_incidents", ["organization_id", "incident_status"])


def downgrade():
    op.drop_table("fleet_incidents")
    op.drop_column("fleet_vehicles", "gps_last_updated_at")
    op.drop_column("fleet_vehicles", "gps_last_lng")
    op.drop_column("fleet_vehicles", "gps_last_lat")
    op.drop_column("fleet_vehicles", "insurance_expiry")
    op.drop_column("fleet_vehicles", "insurance_policy_number")
    op.drop_column("fleet_vehicles", "insurance_provider")
