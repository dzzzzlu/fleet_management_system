# Argo Fleet Management Module

Fleet management system: **FastAPI + PostgreSQL** backend, **React 18 (Vite) + Tailwind CSS** frontend, JWT auth with 5 roles (Viewer, Staff, Manager, Administrator, Driver).

## Repository layout

```
backend/backend/            FastAPI app
  app/main.py               entrypoint + CORS
  app/routers/              auth, vehicles, drivers, trips, maintenance, fuel-logs, incidents, dashboard
  app/deps.py               role permissions matrix (RBAC)
  alembic/                  DB migrations
  seed_demo_users.py        creates the 5 presentation demo accounts
frontend/frontend/frontend/ React SPA (Vite)
```

## Local development

Backend (Python 3.11+):

```bash
cd backend/backend
python -m venv venv
venv\Scripts\activate            # Windows
pip install -r requirements.txt
copy .env.example .env           # fill DATABASE_URL + JWT_SECRET_KEY
alembic upgrade head
uvicorn app.main:app --reload    # http://localhost:8000
```

Frontend:

```bash
cd frontend/frontend/frontend
npm install
copy .env.example .env           # VITE_API_URL=http://localhost:8000/api
npm run dev                      # http://localhost:5173
```

## Deployment (Vercel frontend + Render backend + Neon Postgres)

> Note: the course guide names Replit as the required host. Vercel/Render is only an
> option if your internship supervisor approves it — confirm first.

### 1. Hosted database (Neon / Supabase / Render Postgres)

Create a free Postgres instance and copy its connection string. Append `?sslmode=require` if not present. Locally set:

```
DATABASE_URL=postgresql+psycopg2://user:pass@host/db?sslmode=require
```

Run migrations against it once from `backend/backend`: `alembic upgrade head`.

### 2. Backend → Render (free web service)

- New → Web Service → connect the GitLab repo.
- Root directory: `backend/backend`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Environment variables:
  - `DATABASE_URL` = hosted Postgres URL (from step 1)
  - `JWT_SECRET_KEY` = long random string (`openssl rand -hex 32`)
  - `CORS_ORIGINS` = `http://localhost:5173,https://YOUR-FRONTEND.vercel.app`
- Deploy, then hit `https://YOUR-BACKEND.onrender.com/api/health` to verify.

Free-tier note: the service sleeps after ~15 min idle; first request takes 10–30 s.
The UI already shows a "server waking up" message on network errors.

### 3. Frontend → Vercel

- Import the GitLab repo. **Root directory:** `frontend/frontend/frontend`
- Framework preset: Vite (build `npm run build`, output `dist`).
- Environment variable: `VITE_API_URL = https://YOUR-BACKEND.onrender.com/api`
- Deploy. The included `vercel.json` rewrites all routes to `index.html` so deep links work.
- After you know the final `*.vercel.app` URL, add it to the backend's `CORS_ORIGINS` and redeploy the backend.

### 4. Demo accounts for the presentation

Once deployed (so they live in the hosted database), create the five fictional demo users either via the admin UI (**Settings → User Management**, administrator only) or by running the idempotent seed script against the hosted DB:

```bash
cd backend/backend
# point DATABASE_URL at the hosted database first
python seed_demo_users.py
```

| Email | Role | Name |
|---|---|---|
| admin@demofleet.test | Administrator | Rafael Cruz |
| manager@demofleet.test | Manager | Liza Domingo |
| staff@demofleet.test | Staff | Marco Villanueva |
| viewer@demofleet.test | Viewer | Anna Reyes |
| driver@demofleet.test | Driver | Ben Santos |

Password for all: `Demo(users)2026....`

The driver account is auto-linked to a fleet driver record so its self-scoped views (own trips/maintenance/incidents) resolve correctly.

### 5. Secrets policy

Never commit `.env`. Only `.env.example` files (variable names, placeholder values) go to GitLab. Production secrets live in Render's environment panel (backend) and Vercel's project settings (frontend).

## Roles & permissions

Enforced server-side in `app/deps.py` (`ROLE_PERMISSIONS`) — the UI merely hides what the API would reject anyway:

- **viewer** – read-only across fleet records
- **staff** – create/update vehicles, drivers, trips, maintenance
- **manager** – staff + trip approval, completing maintenance
- **administrator** – everything + delete/archive + user management (Settings → User Management)
- **driver** – sees only their own trips, incidents, and maintenance of assigned vehicles (scoped by `fleet_drivers.user_id`)

All queries are organization-scoped from the JWT — never from client input (blocks cross-tenant access).
