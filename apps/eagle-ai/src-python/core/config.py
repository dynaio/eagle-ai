import os
import sys
from pathlib import Path

# Detect if running as a PyInstaller bundle (Sidecar)
IS_BUNDLE = getattr(sys, 'frozen', False)

# Directory priorities:
# 1. Environment Variables (passed by Rust launcher)
# 2. Packaged paths (~/.eagle-ai) if frozen
# 3. Local project paths if dev
ENVR_STATE = os.environ.get("EAGLE_STATE_DIR")
ENVR_DATA = os.environ.get("EAGLE_DATA_DIR")
ENVR_SETTINGS = os.environ.get("EAGLE_SETTINGS_DIR")

if ENVR_STATE:
    STATE_DIR = Path(ENVR_STATE).resolve()
    DATA_DIR = Path(ENVR_DATA).resolve() if ENVR_DATA else STATE_DIR.parent / "data"
    SETTINGS_DIR = Path(ENVR_SETTINGS).resolve() if ENVR_SETTINGS else STATE_DIR.parent / "settings"
    BASE_DIR = STATE_DIR.parent
    RESOURCE_DIR = Path(getattr(sys, '_MEIPASS', Path(__file__).resolve().parent.parent))
elif IS_BUNDLE:
    # Standard Persistent Data Directory for Production
    HOME_DIR = Path.home() / ".eagle-ai"
    BASE_DIR = HOME_DIR
    STATE_DIR = BASE_DIR / "state"
    DATA_DIR = BASE_DIR / "data"
    SETTINGS_DIR = BASE_DIR / "settings"
    # Resource dir is where the code/static assets live (temporary during run)
    RESOURCE_DIR = Path(getattr(sys, '_MEIPASS', Path(__file__).resolve().parent.parent))
else:
    # Development Mode
    BASE_DIR = Path(__file__).resolve().parent.parent
    RESOURCE_DIR = BASE_DIR
    STATE_DIR = BASE_DIR / "state"
    DATA_DIR = BASE_DIR / "data"
    SETTINGS_DIR = BASE_DIR / "settings"

# Static Code/Logic Directories
ROUTERS_DIR = RESOURCE_DIR / "routers"
SERVICES_DIR = RESOURCE_DIR / "services"
MODELS_DIR = RESOURCE_DIR / "models"

# Ensure directories exist
for d in [STATE_DIR, SETTINGS_DIR, DATA_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# Global API Config
API_TITLE = "EagleAI Industrial Backend"
API_VERSION = "2.1.0"
DEFAULT_PORT = 6789
