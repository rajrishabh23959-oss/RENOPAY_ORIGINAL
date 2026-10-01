import os
import sys
from pathlib import Path

# Ensure renopay-backend is in sys.path so 'app' can be imported
current_dir = Path(__file__).resolve().parent
backend_dir = current_dir.parent / "renopay-backend"

if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

try:
    from app.main import app as real_app
    async def app(scope, receive, send):
        try:
            await real_app(scope, receive, send)
        except Exception as e:
            import traceback
            tb = traceback.format_exc()
            if scope["type"] == "http":
                body = f"RUNTIME ERROR:\n{tb}".encode("utf-8")
                await send({
                    "type": "http.response.start",
                    "status": 500,
                    "headers": [
                        (b"content-type", b"text/plain; charset=utf-8"),
                        (b"content-length", str(len(body)).encode("ascii")),
                    ],
                })
                await send({"type": "http.response.body", "body": body})
            else:
                raise
except Exception as e:
    import traceback
    tb = traceback.format_exc()
    async def app(scope, receive, send):
        if scope["type"] == "http":
            body = f"IMPORT ERROR:\n{tb}".encode("utf-8")
            await send({
                "type": "http.response.start",
                "status": 500,
                "headers": [
                    (b"content-type", b"text/plain; charset=utf-8"),
                    (b"content-length", str(len(body)).encode("ascii")),
                ],
            })
            await send({"type": "http.response.body", "body": body})
        else:
            raise

