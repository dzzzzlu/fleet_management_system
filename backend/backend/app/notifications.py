"""
Derive a role-appropriate notification feed from LIVE organization data.

Notifications are not stored as rows — they are computed on demand so they are
always correct and scoped to the requesting user's role and (for drivers) their
own assignment. The only persisted state is read-tracking (NotificationRead),
keyed by a stable `key` string so a notification stays marked-read across calls.

Each notification: {key, category, title, message, created_at}
"""
import uuid
from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from app.models.local_stub import User
from app.models.vehicle import Vehicle
from app.models.driver import Driver
from app.models.trip import Trip
from app.models.maintenance import Maintenance
from app.models.incident import Incident
from app.models.notification_read import NotificationRead
from app.deps import driver_record_for_user, driver_assigned_vehicle_ids

CATEGORY_MAINTENANCE = "maintenance"
CATEGORY_TRIP = "trip"
CATEGORY_INCIDENT = "incident"
CATEGORY_COMPLIANCE = "compliance"
CATEGORY_VEHICLE = "vehicle"


def _notif(key: str, category: str, title: str, message: str, ts: datetime | None = None) -> dict:
    return {
        "key": key,
        "category": category,
        "title": title,
        "message": message,
        "created_at": (ts or datetime.utcnow()).isoformat() + "Z",
    }


def _license_expiry_days(driver: Driver) -> int | None:
    if driver.license_expiry:
        return (driver.license_expiry - date.today()).days
    return None


def _insurance_expiry_days(vehicle: Vehicle) -> int | None:
    if vehicle.insurance_expiry:
        return (vehicle.insurance_expiry - date.today()).days
    return None


def _license_cat(days: int) -> str:
    if days < 0:
        return "expired"
    if days <= 30:
        return "expiring_soon"
    return "ok"


def _prev_12h(dt: datetime) -> bool:
    return (datetime.utcnow() - dt).total_seconds() <= 12 * 3600


def build_notifications(db: Session, user: User) -> list[dict]:
    org_id = user.organization_id
    role = user.role
    out: list[dict] = []
    now = datetime.utcnow()
    today = date.today()

    # ---- Driver: everything scoped to Justin's OWN assignment ----
    if role == "driver":
        drv = driver_record_for_user(db, user)
        if drv is None:
            return out
        vehicle_ids = driver_assigned_vehicle_ids(db, drv.id)

        days = _license_expiry_days(drv)
        if days is not None and days <= 45 and drv.license_number:
            if days < 0:
                out.append(_notif(
                    f"driver-license-{drv.id}",
                    CATEGORY_COMPLIANCE,
                    "Driver license expired",
                    f"Your license {drv.license_number} expired {abs(days)} day(s) ago. Renew it to keep driving assigned vehicles.",
                ))
            else:
                out.append(_notif(
                    f"driver-license-{drv.id}",
                    CATEGORY_COMPLIANCE,
                    "License expiring soon",
                    f"Your driver's license expires in {days} day(s). Plan a renewal before it lapses.",
                ))

        # maintenance on assigned vehicles
        rem1 = (
            db.query(Maintenance)
            .filter(
                Maintenance.organization_id == org_id,
                Maintenance.vehicle_id.in_(vehicle_ids) if vehicle_ids else Maintenance.vehicle_id.is_(None),
                Maintenance.maintenance_status.in_(["pending", "in_progress"]),
                Maintenance.deleted_at.is_(None),
            )
            .count()
        )
        if rem1 and vehicle_ids:
            out.append(_notif(
                f"driver-maint-open-{drv.id}",
                CATEGORY_MAINTENANCE,
                "Maintenance pending on your vehicle",
                f"You have {rem1} open maintenance item(s) on your assigned vehicle.",
            ))

        # incidents on assigned vehicles
        inc1 = (
            db.query(Incident)
            .filter(
                Incident.organization_id == org_id,
                Incident.vehicle_id.in_(vehicle_ids) if vehicle_ids else Incident.vehicle_id.is_(None),
                Incident.incident_status.in_(["reported", "under_review"]),
                Incident.deleted_at.is_(None),
            )
            .count()
        )
        if inc1 and vehicle_ids:
            out.append(_notif(
                f"driver-incs-{drv.id}",
                CATEGORY_INCIDENT,
                "Incident awaiting review",
                f"{inc1} incident report(s) on your assigned vehicle need attention.",
            ))

        # vehicle in maintenance
        if vehicle_ids:
            vm_ids = [
                r[0]
                for r in db.query(Vehicle.id)
                .filter(Vehicle.id.in_(vehicle_ids), Vehicle.status == "maintenance", Vehicle.deleted_at.is_(None))
                .all()
            ]
            if vm_ids:
                out.append(_notif(
                    f"driver-vehmaint-{drv.id}",
                    CATEGORY_VEHICLE,
                    "Vehicle in the shop",
                    "Your assigned vehicle is currently flagged as under maintenance.",
                ))

        # scheduled trips on their vehicle
        sched = (
            db.query(Trip)
            .filter(
                Trip.organization_id == org_id,
                Trip.vehicle_id.in_(vehicle_ids) if vehicle_ids else Trip.vehicle_id.is_(None),
                Trip.trip_status == "scheduled",
                Trip.departure_time >= now,
                Trip.deleted_at.is_(None),
            )
            .count()
        )
        if sched and vehicle_ids:
            out.append(_notif(
                f"driver-trips-{drv.id}",
                CATEGORY_TRIP,
                "Upcoming trip assigned",
                f"You have {sched} scheduled trip(s) on your assigned vehicle.",
            ))

        return out

    # ---- Non-driver roles: scoped to the org's fleet operations ----

    # Maintenance needing action (staff/manager/admin)
    open_maint = (
        db.query(Maintenance)
        .filter(
            Maintenance.organization_id == org_id,
            Maintenance.maintenance_status.in_(["pending", "in_progress"]),
            Maintenance.deleted_at.is_(None),
        )
        .count()
    )
    if open_maint:
        out.append(_notif(
            "org-maint-open",
            CATEGORY_MAINTENANCE,
            "Maintenance queue",
            f"{open_maint} maintenance record(s) are pending or in progress across the fleet.",
        ))

    # Incidents awaiting review (manager/admin) — staff can also see
    open_incs = (
        db.query(Incident)
        .filter(
            Incident.organization_id == org_id,
            Incident.incident_status.in_(["reported", "under_review"]),
            Incident.deleted_at.is_(None),
        )
        .count()
    )
    if open_incs:
        out.append(_notif(
            "org-incidents-open",
            CATEGORY_INCIDENT,
            "Incidents need review",
            f"{open_incs} incident report(s) are awaiting review.",
        ))

    # Trips that are active/in-progress right now
    active_trips = (
        db.query(Trip)
        .filter(
            Trip.organization_id == org_id,
            Trip.trip_status == "active",
            Trip.deleted_at.is_(None),
        )
        .count()
    )
    if active_trips:
        out.append(_notif(
            "org-trips-active",
            CATEGORY_TRIP,
            "Trips currently in progress",
            f"{active_trips} trip(s) are active on the road right now.",
        ))

    # Vehicles recently created (real-time signal for operational staff)
    recent_vehicles = (
        db.query(Vehicle)
        .filter(
            Vehicle.organization_id == org_id,
            Vehicle.deleted_at.is_(None),
        )
        .all()
    )
    for v in recent_vehicles:
        if v.created_at and _prev_12h(v.created_at):
            out.append(_notif(
                f"vehicle-new-{v.id}",
                CATEGORY_VEHICLE,
                "New vehicle added",
                f"{v.plate_number} ({v.brand} {v.model}) was added to the fleet.",
            ))
            break

    # Compliance: expiring licenses + insurance (staff+)
    expiring_licenses = []
    for d in (
        db.query(Driver)
        .filter(Driver.organization_id == org_id, Driver.deleted_at.is_(None))
        .all()
    ):
        days = _license_expiry_days(d)
        if days is not None and days <= 45:
            expiring_licenses.append((d, days, _license_cat(days)))
    if expiring_licenses:
        names = ", ".join(f"{d.full_name} ({abs(days)}d)" for d, days, _ in expiring_licenses[:3])
        out.append(_notif(
            "org-licenses",
            CATEGORY_COMPLIANCE,
            "Driver licenses need attention",
            f"License(s) expired or expiring within 45 days: {names}.",
        ))

    expiring_insurance = []
    for v in recent_vehicles:
        days = _insurance_expiry_days(v)
        if days is not None and days <= 60:
            expiring_insurance.append((v, days))
    if expiring_insurance:
        names = ", ".join(f"{v.plate_number} ({abs(days)}d)" for v, days in expiring_insurance[:3])
        out.append(_notif(
            "org-insurance",
            CATEGORY_COMPLIANCE,
            "Vehicle insurance expiry",
            f"Insurance expiring or expired within 60 days: {names}.",
        ))

    return out


def resolve_read_keys(db: Session, user_id: uuid.UUID) -> set[str]:
    rows = (
        db.query(NotificationRead.notification_key)
        .filter(NotificationRead.user_id == user_id)
        .all()
    )
    return {r[0] for r in rows}
