"""fleet_001: create fleet_* tables

Revision ID: fleet_001
Revises: None
Create Date: 2026-08-02

NOTE: down_revision is None in this sandbox. At integration, your supervisor
re-points this to Argo's real head revision — that is the only edit that
happens here, and they do it, not you.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "fleet_001"
down_revision = "zzz_local_stub"
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
    existing = set(inspector.get_table_names())

    if "fleet_vehicles" not in existing:
        op.create_table(
            "fleet_vehicles",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column("organization_id", UUID(as_uuid=True),
                      sa.ForeignKey("organizations.id", ondelete="CASCADE"),
                      nullable=False, index=True),
            sa.Column("plate_number", sa.String(20), nullable=False),
            sa.Column("vehicle_type", sa.String(30), nullable=False),
            sa.Column("brand", sa.String(100), nullable=False),
            sa.Column("model", sa.String(100), nullable=False),
            sa.Column("year", sa.Integer, nullable=True),
            sa.Column("status", sa.String(20), nullable=False, server_default="available"),
            *_audit_columns(),
            sa.UniqueConstraint("organization_id", "plate_number", name="uq_fleet_vehicles_org_plate"),
        )
        op.create_index("ix_fleet_vehicles_org_status", "fleet_vehicles", ["organization_id", "status"])

    if "fleet_drivers" not in existing:
        op.create_table(
            "fleet_drivers",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column("organization_id", UUID(as_uuid=True),
                      sa.ForeignKey("organizations.id", ondelete="CASCADE"),
                      nullable=False, index=True),
            sa.Column("user_id", UUID(as_uuid=True), nullable=True),  # loose, no FK
            sa.Column("employee_number", sa.String(30), nullable=False),
            sa.Column("full_name", sa.String(150), nullable=False),
            sa.Column("license_number", sa.String(50), nullable=False),
            sa.Column("license_expiry", sa.Date, nullable=True),
            sa.Column("phone", sa.String(30), nullable=True),
            sa.Column("status", sa.String(20), nullable=False, server_default="active"),
            *_audit_columns(),
            sa.UniqueConstraint("organization_id", "employee_number", name="uq_fleet_drivers_org_empno"),
            sa.UniqueConstraint("organization_id", "license_number", name="uq_fleet_drivers_org_license"),
        )
        op.create_index("ix_fleet_drivers_org_status", "fleet_drivers", ["organization_id", "status"])

    if "fleet_vehicle_assignments" not in existing:
        op.create_table(
            "fleet_vehicle_assignments",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column("organization_id", UUID(as_uuid=True),
                      sa.ForeignKey("organizations.id", ondelete="CASCADE"),
                      nullable=False, index=True),
            sa.Column("vehicle_id", UUID(as_uuid=True), sa.ForeignKey("fleet_vehicles.id"), nullable=False, index=True),
            sa.Column("driver_id", UUID(as_uuid=True), sa.ForeignKey("fleet_drivers.id"), nullable=False, index=True),
            sa.Column("assigned_by", UUID(as_uuid=True), nullable=True),  # loose, no FK
            sa.Column("assigned_date", sa.Date, nullable=False),
            sa.Column("returned_date", sa.Date, nullable=True),
            sa.Column("assignment_status", sa.String(20), nullable=False, server_default="active"),
            sa.Column("notes", sa.Text, nullable=True),
            *_audit_columns(),
        )
        op.create_index("ix_fleet_va_org_status", "fleet_vehicle_assignments", ["organization_id", "assignment_status"])

    if "fleet_trips" not in existing:
        op.create_table(
            "fleet_trips",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column("organization_id", UUID(as_uuid=True),
                      sa.ForeignKey("organizations.id", ondelete="CASCADE"),
                      nullable=False, index=True),
            sa.Column("vehicle_id", UUID(as_uuid=True), sa.ForeignKey("fleet_vehicles.id"), nullable=False, index=True),
            sa.Column("driver_id", UUID(as_uuid=True), sa.ForeignKey("fleet_drivers.id"), nullable=False, index=True),
            sa.Column("trip_number", sa.String(30), nullable=False),
            sa.Column("destination", sa.String(255), nullable=False),
            sa.Column("departure_time", sa.DateTime, nullable=False),
            sa.Column("arrival_time", sa.DateTime, nullable=True),
            sa.Column("odometer_start", sa.Numeric(10, 2), nullable=True),
            sa.Column("odometer_end", sa.Numeric(10, 2), nullable=True),
            sa.Column("trip_status", sa.String(20), nullable=False, server_default="scheduled"),
            *_audit_columns(),
            sa.UniqueConstraint("organization_id", "trip_number", name="uq_fleet_trips_org_number"),
        )
        op.create_index("ix_fleet_trips_org_status", "fleet_trips", ["organization_id", "trip_status"])

    if "fleet_maintenance" not in existing:
        op.create_table(
            "fleet_maintenance",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column("organization_id", UUID(as_uuid=True),
                      sa.ForeignKey("organizations.id", ondelete="CASCADE"),
                      nullable=False, index=True),
            sa.Column("vehicle_id", UUID(as_uuid=True), sa.ForeignKey("fleet_vehicles.id"), nullable=False, index=True),
            sa.Column("requested_by", UUID(as_uuid=True), nullable=True),  # loose, no FK
            sa.Column("maintenance_type", sa.String(100), nullable=False),
            sa.Column("scheduled_date", sa.Date, nullable=False),
            sa.Column("completed_date", sa.Date, nullable=True),
            sa.Column("cost", sa.Numeric(12, 2), nullable=True),
            sa.Column("maintenance_status", sa.String(20), nullable=False, server_default="pending"),
            sa.Column("remarks", sa.Text, nullable=True),
            *_audit_columns(),
        )
        op.create_index("ix_fleet_maintenance_org_status", "fleet_maintenance", ["organization_id", "maintenance_status"])

    if "fleet_fuel_logs" not in existing:
        op.create_table(
            "fleet_fuel_logs",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column("organization_id", UUID(as_uuid=True),
                      sa.ForeignKey("organizations.id", ondelete="CASCADE"),
                      nullable=False, index=True),
            sa.Column("vehicle_id", UUID(as_uuid=True), sa.ForeignKey("fleet_vehicles.id"), nullable=False, index=True),
            sa.Column("driver_id", UUID(as_uuid=True), sa.ForeignKey("fleet_drivers.id"), nullable=True, index=True),
            sa.Column("logged_by", UUID(as_uuid=True), nullable=True),  # loose, no FK
            sa.Column("fuel_date", sa.Date, nullable=False),
            sa.Column("liters", sa.Numeric(8, 2), nullable=False),
            sa.Column("cost", sa.Numeric(12, 2), nullable=False),
            sa.Column("odometer", sa.Numeric(10, 2), nullable=True),
            sa.Column("station", sa.String(150), nullable=True),
            sa.Column("notes", sa.Text, nullable=True),
            *_audit_columns(),
        )
        op.create_index("ix_fleet_fuel_logs_org_date", "fleet_fuel_logs", ["organization_id", "fuel_date"])


def downgrade():
    op.drop_table("fleet_fuel_logs")
    op.drop_table("fleet_maintenance")
    op.drop_table("fleet_trips")
    op.drop_table("fleet_vehicle_assignments")
    op.drop_table("fleet_drivers")
    op.drop_table("fleet_vehicles")
