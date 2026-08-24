"""
Seed 5 fictional demo accounts (one per role) for the live presentation demo.

Idempotent: safe to run multiple times — existing accounts are updated
(password/role/name refreshed), missing ones are created.

Usage (run from backend/backend):
    python seed_demo_users.py                 # auto-create/reuse "Demo Fleet Corp." org
    DEMO_ORG_ID=<uuid> python seed_demo_users.py   # seed into an existing organization

Requires DATABASE_URL in .env or environment and migrated tables
(`alembic upgrade head`) BEFORE running this script.
"""
import os
import sys
import uuid

from dotenv import load_dotenv

load_dotenv()

try:
    from app.database import SessionLocal, engine
    from app.models import Organization, User, Driver
    from app.security import hash_password
except ImportError:
    print("Run this from the backend/backend directory (venv active): python seed_demo_users.py")
    sys.exit(1)

DEMO_PASSWORD = "Demo(users)2026...."
DEMO_ORG_NAME = os.getenv("DEMO_ORG_NAME", "Demo Fleet Corp.")

ACCOUNTS = [
    # email, full name, role
    ("admin@demofleet.test", "Rafael Cruz", "administrator"),
    ("manager@demofleet.test", "Liza Domingo", "manager"),
    ("staff@demofleet.test", "Marco Villanueva", "staff"),
    ("viewer@demofleet.test", "Anna Reyes", "viewer"),
    ("driver@demofleet.test", "Ben Santos", "driver"),
]


def main():
    from sqlalchemy import inspect

    inspector = inspect(engine)
    required = {"users", "organizations"}
    if not required.issubset(set(inspector.get_table_names())):
        print("Tables not found. Run migrations first:  alembic upgrade head")
        sys.exit(1)

    db = SessionLocal()
    try:
        org_id_env = os.getenv("DEMO_ORG_ID")
        if org_id_env:
            org = db.query(Organization).filter(Organization.id == uuid.UUID(org_id_env)).first()
            if not org:
                print(f"DEMO_ORG_ID {org_id_env} not found.")
                sys.exit(1)
        else:
            org = db.query(Organization).filter(Organization.name == DEMO_ORG_NAME).first()
            if not org:
                org = Organization(id=uuid.uuid4(), name=DEMO_ORG_NAME)
                db.add(org)
                db.flush()
                print(f"Created organization: {org.name} ({org.id})")
            else:
                print(f"Reusing existing organization: {org.name} ({org.id})")

        created, updated = [], []
        driver_user_id = None

        for email, full_name, role in ACCOUNTS:
            user = db.query(User).filter(User.email == email).first()
            if user:
                user.full_name = full_name
                user.role = role
                user.password_hash = hash_password(DEMO_PASSWORD)
                user.organization_id = org.id
                user.is_active = True
                updated.append(email)
            else:
                user = User(
                    id=uuid.uuid4(),
                    organization_id=org.id,
                    email=email,
                    full_name=full_name,
                    password_hash=hash_password(DEMO_PASSWORD),
                    role=role,
                    is_active=True,
                )
                db.add(user)
                created.append(email)
            db.flush()
            if role == "driver":
                driver_user_id = user.id

        # Link the demo driver account to a fleet_drivers record so its
        # self-scoped views (own trips/incidents/maintenance) resolve.
        if driver_user_id:
            drv = db.query(Driver).filter(Driver.user_id == driver_user_id).first()
            if not drv:
                drv = Driver(
                    id=uuid.uuid4(),
                    organization_id=org.id,
                    user_id=driver_user_id,
                    employee_number="DRV-DEMO-001",
                    full_name="Ben Santos",
                    license_number="DEMO-LC-0001",
                    phone="+63 917 555 0105",
                    status="active",
                )
                db.add(drv)
                print("Linked fleet_drivers record DRV-DEMO-001 to driver@demofleet.test")

        db.commit()
        print("\nDemo accounts ready (password: Demo(users)2026....)")
        for email, full_name, role in ACCOUNTS:
            print(f"  {role:<14} {email:<26} {full_name}")
        print(f"\nOrganization ID (share so others can join): {org.id}")
        print(f"created={len(created)} updated={len(updated)}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
