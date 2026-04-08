import os
from pathlib import Path

# Base directory: packages/shared-backend/src/shared_backend
BASE_DIR = Path(__file__).resolve().parent.parent

# Sub-directories
ROUTERS_DIR = BASE_DIR / "routers"
STATE_DIR = Path(os.getenv("EAGLE_STATE_DIR", str(BASE_DIR / "state")))
SETTINGS_DIR = Path(os.getenv("EAGLE_SETTINGS_DIR", str(BASE_DIR / "settings")))
SERVICES_DIR = BASE_DIR / "services"
MODELS_DIR = BASE_DIR / "models"
DATA_DIR = Path(os.getenv("EAGLE_DATA_DIR", str(BASE_DIR / "data")))

# Ensure directories exist
for d in [STATE_DIR, SETTINGS_DIR, DATA_DIR]:
    try:
        d.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        print(f"Warning: Could not create directory {d}: {e}")

# Global API Config
API_TITLE = "Eagle Shared Backend"
API_VERSION = "2.0.0"
DEFAULT_PORT = 6789
