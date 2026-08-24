"""
Seed realistic demo fleet data (vehicles, drivers, assignments, trips,
maintenance, fuel logs) for the live presentation demo.

Idempotent: skips if DEMO plate numbers already exist. Dates are generated
relative to "today" so charts always show recent trends.

Usage (from backend/backend):
    python seed_demo_data.py

Requires migrated tables and DATABASE_URL (.env or environment).
"""
import os
import random
import sys
import uuid
from datetime import date, datetime, timedelta

from dotenv import load_dotenv

load_dotenv()

try:
    from app.database import SessionLocal
    from app.models import (
        Driver, FuelLog, Maintenance, Organization,
        Trip, User, Vehicle, VehicleAssignment,
    )
except ImportError:
    print("Run from backend/backend with venv active: python seed_demo_data.py")
    sys.exit(1)

random.seed(42)

DEMO_ORG_NAME = os.getenv("DEMO_ORG_NAME", "Demo Fleet Corp.")
PLATE_PREFIX = "DEMO"

VEHICLES = [
    # plate, type, brand, model, year, status
    ("ABC-1023", "Van",     "Toyota",   "Hiace Commuter",  2021, "assigned"),
    ("ABC-2087", "Truck",   "Isuzu",    "Elf NQR",         2020, "assigned"),
    ("ABC-3155", "Sedan",   "Toyota",   "Vios",            2022, "available"),
    ("ABC-4290", "Van",     "Nissan",   "Urvan NV350",     2019, "available"),
    ("ABC-5318", "Truck",   "Mitsubishi","Fuso Canter",    2018, "maintenance"),
    ("ABC-6442", "Sedan",   "Hyundai",  "Accent",          2020, "inactive"),
    ("ABC-7571", "Van",     "Mitsubishi","L300",           2017, "available"),
]

DRIVERS = [
    # employee_number, name, license, phone, linked_demo_user?
    ("DRV-DEMO-001", "Ben Santos",      "DEMO-LC-0001", "+63 917 555 0105", True),
    ("DRV-DEMO-002", "Carlos Reyes",    "DEMO-LC-0002", "+63 917 555 0106", False),
    ("DRV-DEMO-003", "Danilo Ramos",    "DEMO-LC-0003", "+63 917 555 0107", False),
    ("DRV-DEMO-004", "Ernesto Garcia",  "DEMO-LC-0004", "+63 917 555 0108", False),
    ("DRV-DEMO-005", "Fernando Lopez",  "DEMO-LC-0005", "+63 917 555 0109", False),
]

DESTINATIONS = [
    "Batangas Port", "Quezon City Hub", "Clark Freeport", "Laguna Warehouse",
    "Baguio City", "Naval Station Manila", "Subic Bay Depot",
]

MAINT_TYPES = [
    ("Preventive maintenance service", 4500, 9000),
    ("Oil and filter change",           1800, 3200),
    ("Brake pads replacement",          3500, 7500),
    ("Tire replacement (4 pcs)",       12000, 22000),
    ("Air-conditioning repair",         4000, 9000),
    ("Transmission service",            8000, 15000),
    ("Battery replacement",             4500, 6500),
]

STATIONS = ["Petron - Commonwealth", "Shell - Mindanao Ave", "Caltex - Tandang Sora",
            "Phoenix - Fairview", "Total - Visayas Ave"]


def months_ago(n, day=15):
    """Date roughly n months back."""
    d = date.today()
    month = d.month - n
    year = d.year
    while month <= 0:
        month += 12
        year -= 1
    day = min(day, 28)
    return date(year, month, day)


def main():
    db = SessionLocal()
    try:
        org = db.query(Organization).filter(Organization.name == DEMO_ORG_NAME).first()
        if not org:
            print(f'Organization "{DEMO_ORG_NAME}" not found. Run seed_demo_users.py first.')
            sys.exit(1)

        existing = db.query(Vehicle).filter(
            Vehicle.organization_id == org.id,
            Vehicle.plate_number.like(f"{PLATE_PREFIX}-%"),
        ).count()
        if existing:
            print(f"Demo fleet data already present ({existing} DEMO vehicles). Skipping.")
            return

        admin = db.query(User).filter(
            User.organization_id == org.id, User.role == "administrator"
        ).first()

        # --- Vehicles ---
        vehicles = {}
        for plate, vtype, brand, model, year, status in VEHICLES:
            v = Vehicle(
                organization_id=org.id,
                plate_number=f"{PLATE_PREFIX}-{plate}",
                vehicle_type=vtype, brand=brand, model=model, year=year,
                status=status,
                created_by=admin.id if admin else None,
            )
            db.add(v)
            vehicles[plate] = v
        db.flush()
        print(f"Created {len(vehicles)} vehicles")

        # --- Drivers (reuses/link DRV-DEMO-001 if already present) ---
        drivers = {}
        demo_user = db.query(User).filter(
            User.organization_id == org.id, User.email == "driver@demofleet.test"
        ).first()
        for emp_no, name, lic, phone, linked in DRIVERS:
            d = db.query(Driver).filter(
                Driver.organization_id == org.id, Driver.employee_number == emp_no
            ).first()
            if not d:
                d = Driver(
                    organization_id=org.id,
                    user_id=demo_user.id if (linked and demo_user) else None,
                    employee_number=emp_no, full_name=name, license_number=lic,
                    phone=phone, status="active",
                    license_expiry=date.today() + timedelta(days=random.randint(200, 900)),
                    created_by=admin.id if admin else None,
                )
                db.add(d)
                print(f"Created driver {emp_no} ({name})")
            drivers[emp_no] = d
        db.flush()

        # --- Active assignments for the two "assigned" vehicles ---
        assigned_plates = [plate for plate, *_rest, status in VEHICLES if status == "assigned"]
        pairs = list(zip(assigned_plates, ["DRV-DEMO-001", "DRV-DEMO-002"]))
        for plate, drv_no in pairs:
            db.add(VehicleAssignment(
                organization_id=org.id,
                vehicle_id=vehicles[plate].id,
                driver_id=drivers[drv_no].id,
                assigned_by=admin.id if admin else None,
                assigned_date=date.today() - timedelta(days=45),
                assignment_status="active",
                notes="Demo assignment",
                created_by=admin.id if admin else None,
            ))
        print(f"Created {len(pairs)} active assignments")

        # --- Trips: ~4 per month over the last 6 months ---
        trip_count = 0
        seq = 1
        ben_trips_every = 3  # every 3rd trip belongs to DRV-DEMO-001
        idx = 0
        for m in range(6, 0, -1):
            base = months_ago(m)
            for k in range(4):
                day = base + timedelta(days=k * 6)
                veh_plate = random.choice([p for p, *_r, s in VEHICLES if s in ("assigned", "available")])
                drv_no = "DRV-DEMO-001" if idx % ben_trips_every == 0 else random.choice(list(drivers))
                dep = datetime(day.year, day.month, day.day, random.randint(5, 9), random.choice([0, 15, 30, 45]))
                arr = dep + timedelta(hours=random.randint(2, 9))
                odo_start = random.randint(40000, 140000)
                status = "completed"
                if m == 1 and k >= 3:
                    dep = datetime.now() + timedelta(days=(k - 2))
                    arr, odo_end, status = None, None, "scheduled"
                elif m == 1 and k == 2:
                    status = "cancelled"
                    arr, odo_end = None, None
                else:
                    odo_end = odo_start + random.randint(80, 420)
                db.add(Trip(
                    organization_id=org.id,
                    vehicle_id=vehicles[veh_plate].id,
                    driver_id=drivers[drv_no].id,
                    trip_number=f"TRP-{dep.year}-{seq:04d}",
                    destination=random.choice(DESTINATIONS),
                    departure_time=dep,
                    arrival_time=arr,
                    odometer_start=odo_start if status != "scheduled" else None,
                    odometer_end=odo_end,
                    trip_status=status,
                    created_by=admin.id if admin else None,
                ))
                seq += 1
                trip_count += 1
                idx += 1
        print(f"Created {trip_count} trips")

        # --- Maintenance: ~2-3 per month over 6 months ---
        maint_count = 0
        for m in range(6, -1, -1):
            base = months_ago(max(m, 0), day=random.randint(3, 25)) if m > 0 else date.today() - timedelta(days=random.randint(1, 10))
            for _ in range(random.randint(2, 3)):
                mtype, lo, hi = random.choice(MAINT_TYPES)
                sched = base - timedelta(days=random.randint(0, 5))
                done = sched + timedelta(days=random.randint(0, 3))
                if m > 1:
                    status, completed, cost = "completed", done, round(random.uniform(lo, hi), 2)
                elif m == 1:
                    status, completed, cost = "completed", done, round(random.uniform(lo, hi), 2)
                else:
                    status = random.choice(["pending", "in_progress"])
                    completed, cost = None, None
                db.add(Maintenance(
                    organization_id=org.id,
                    vehicle_id=vehicles[random.choice(list(vehicles))].id,
                    requested_by=admin.id if admin else None,
                    maintenance_type=mtype,
                    scheduled_date=sched,
                    completed_date=completed,
                    cost=cost,
                    maintenance_status=status,
                    remarks="Demo record",
                    created_by=admin.id if admin else None,
                ))
                maint_count += 1
        print(f"Created {maint_count} maintenance records")

        # --- Fuel logs: ~5 per month over 6 months ---
        fuel_count = 0
        for m in range(6, -1, -1):
            base_month = months_ago(max(m, 0)) if m > 0 else date.today()
            for _ in range(5):
                fdate = base_month - timedelta(days=random.randint(0, 27))
                if fdate > date.today():
                    fdate = date.today() - timedelta(days=random.randint(0, 6))
                liters = round(random.uniform(28, 78), 1)
                db.add(FuelLog(
                    organization_id=org.id,
                    vehicle_id=vehicles[random.choice(list(vehicles))].id,
                    driver_id=drivers[random.choice(list(drivers))].id,
                    logged_by=admin.id if admin else None,
                    fuel_date=fdate,
                    liters=liters,
                    cost=round(liters * random.uniform(56, 65), 2),
                    odometer=random.randint(40050, 141000),
                    station=random.choice(STATIONS),
                    created_by=admin.id if admin else None,
                ))
                fuel_count += 1
        print(f"Created {fuel_count} fuel logs")

        db.commit()
        print("\nDone. Charts on Dashboard/Reports will now show data.")
        print("Re-run any time — it skips automatically when DEMO vehicles exist.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
