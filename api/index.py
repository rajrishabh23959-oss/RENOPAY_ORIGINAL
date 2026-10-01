import os
import sys
from pathlib import Path

# Ensure renopay-backend is in sys.path so 'app' can be imported
current_dir = Path(__file__).resolve().parent
backend_dir = current_dir.parent / "renopay-backend"

if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

try:
    from app.main import app
except Exception as e:
    import traceback
    from fastapi import FastAPI
    from fastapi.responses import PlainTextResponse

    err_text = traceback.format_exc()
    app = FastAPI()

    @app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
    async def catch_all(path: str):
        return PlainTextResponse(f"BACKEND STARTUP ERROR:\n{err_text}", status_code=500)
