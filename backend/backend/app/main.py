import os

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import vehicles, drivers, trips, maintenance, fuel_logs, dashboard, incidents, auth, notifications, archives

app = FastAPI(title="Argo Fleet Management Module")

# Comma-separated list of allowed origins. Local dev + production frontend.
# e.g. CORS_ORIGINS=https://myfleet.vercel.app,https://myfleet-git-main.vercel.app
_default_origins = "http://localhost:5173,http://127.0.0.1:5173"
allowed_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", _default_origins).split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(vehicles.router)
app.include_router(drivers.router)
app.include_router(trips.router)
app.include_router(maintenance.router)
app.include_router(fuel_logs.router)
app.include_router(incidents.router)
app.include_router(notifications.router)
app.include_router(archives.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
