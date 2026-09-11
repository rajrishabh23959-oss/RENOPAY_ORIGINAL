import os
import sys
from pathlib import Path

# Ensure renopay-backend is in sys.path so 'app' can be imported
current_dir = Path(__file__).resolve().parent
backend_dir = current_dir.parent / "renopay-backend"

if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.main import app
