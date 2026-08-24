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

## Deployment (Vercel for both frontend & backend + Supabase Postgres)

> Note: the course guide names Replit as the required host. Vercel is only an
> option if your internship supervisor approves it — confirm first.

Architecture: two separate Vercel projects from this one repo.
- **frontend** → static React build (root: `frontend/frontend/frontend`)
- **backend** → FastAPI running as a Python serverless function (root: `backend/backend`, entrypoint `api/index.py`)

### 1. Database — Supabase (free)

1. Create a project at supabase.com (sign up with GitHub).
2. **Connect → ORM → SQLAlchemy** and copy the connection string.
3. Use the **pooler** host (`*.pooler.supabase.com`), not `db.*.supabase.co` (IPv6-only on free tier). For serverless, port **6543** (transaction mode) avoids connection exhaustion; port **5432** (session) also works at small scale.
4. Final format:
```
postgresql+psycopg2://postgres.PROJECT-REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?sslmode=require
```

### 2. Backend on Vercel

1. Vercel → **Add New → Project** → import this repo again (a second project).
2. **Root Directory:** `backend/backend`, Framework Preset: **Other**.
3. Environment variables:
   - `DATABASE_URL` = Supabase string from step 1
   - `JWT_SECRET_KEY` = long random string
   - `CORS_ORIGINS` = `http://localhost:5173,https://YOUR-FRONTEND.vercel.app`
4. Deploy, then verify `https://YOUR-BACKEND.vercel.app/api/health`.

Note: serverless functions have cold starts (1–3 s typical); the UI shows a friendly message when the first request wakes it up.

### 3. Run migrations + seed against Supabase (from your PC, once)

Temporarily set `DATABASE_URL` in `backend/backend/.env` to the Supabase string, then:

```bash
alembic upgrade head          # create tables
python seed_demo_users.py     # create the 5 demo accounts (idempotent)
```

Revert `.env` to your local database afterward.

### 4. Frontend on Vercel

1. Import repo as another project. **Root Directory:** `frontend/frontend/frontend`, preset **Vite**.
2. Env var: `VITE_API_URL = https://YOUR-BACKEND.vercel.app/api` (note the `/api` suffix).
3. Deploy; the bundled `vercel.json` rewrites deep links to `index.html`.
4. Make sure both Vercel domains appear in the backend project's `CORS_ORIGINS`, then redeploy the backend.

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
