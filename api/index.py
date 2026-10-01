import os
import sys
import traceback
from pathlib import Path
from fastapi import FastAPI
from fastapi.responses import PlainTextResponse, JSONResponse

# Ensure renopay-backend is in sys.path
current_dir = Path(__file__).resolve().parent
backend_dir = current_dir.parent / "renopay-backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

app = FastAPI()

@app.get("/api/ping")
@app.get("/ping")
def ping():
    return {"status": "ok", "message": "Vercel Python runtime is working"}

@app.get("/api/debug-import")
@app.get("/debug-import")
def debug_import():
    try:
        import app.main
        return {"status": "success", "message": "app.main imported successfully"}
    except Exception as e:
        return PlainTextResponse(traceback.format_exc(), status_code=500)

try:
    from app.main import app as backend_app
    app = backend_app
except Exception as e:
    startup_error = traceback.format_exc()
    @app.get("/api/{full_path:path}")
    @app.post("/api/{full_path:path}")
    def fallback(full_path: str):
        return PlainTextResponse(f"BACKEND STARTUP ERROR:\n{startup_error}", status_code=500)
