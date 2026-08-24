"""
Vercel entrypoint: exposes the FastAPI ASGI app to Vercel's Python runtime.
All requests are rewritten here via ../vercel.json; the app's own routes
already carry the /api prefix.
"""
import os
import sys

# Make `app` package importable (this file lives in backend/backend/api/)
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app  # noqa: E402
