import os
import sys
import traceback
from pathlib import Path
from fastapi import FastAPI
from fastapi.responses import PlainTextResponse

# Ensure renopay-backend is in sys.path so 'app' can be imported
current_dir = Path(__file__).resolve().parent
backend_dir = current_dir.parent / "renopay-backend"

if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

app = FastAPI()

try:
    from app.main import app as backend_app
    app = backend_app
except Exception as e:
    startup_error = traceback.format_exc()
    @app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
    async def fallback(path: str):
        return PlainTextResponse(f"BACKEND STARTUP ERROR:\n{startup_error}", status_code=500)
