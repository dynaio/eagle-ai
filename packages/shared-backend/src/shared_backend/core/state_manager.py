import json
import shutil
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional
from core.config import STATE_DIR

logger = logging.getLogger(__name__)

class StateManager:
    """
    Handles atomic persistence for multiple framework applications.
    Each app has its own JSON file in the state/ directory.
    """
    
    def __init__(self, state_dir: Path = STATE_DIR):
        self.state_dir = state_dir
        self.state_dir.mkdir(parents=True, exist_ok=True)

    def _get_path(self, app_id: str, filename: Optional[str] = None) -> Path:
        if filename:
            return self.state_dir / filename
        return self.state_dir / f"{app_id}_state.json"

    def _get_temp_path(self, app_id: str, filename: Optional[str] = None) -> Path:
        if filename:
            return self.state_dir / f"{filename}.tmp"
        return self.state_dir / f"{app_id}_state.tmp"

    def get_state(self, app_id: str, filename: Optional[str] = None) -> Dict[str, Any]:
        path = self._get_path(app_id, filename)
        if path.exists():
            try:
                with open(path, 'r') as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Failed to read state for {app_id}: {e}")
        return {}

    def save_state(self, app_id: str, state: Dict[str, Any], filename: Optional[str] = None):
        path = self._get_path(app_id, filename)
        temp = self._get_temp_path(app_id, filename)
        try:
            with open(temp, 'w') as f:
                json.dump(state, f, indent=4)
            shutil.move(str(temp), str(path))
        except Exception as e:
            logger.error(f"Failed to save state for {app_id}: {e}")
            if temp.exists():
                temp.unlink()

    def initialize_app_state(self, app_id: str, initial_data: Dict[str, Any], filename: Optional[str] = None):
        """Creates the state file if it doesn't exist."""
        path = self._get_path(app_id, filename)
        if not path.exists():
            self.save_state(app_id, initial_data, filename)

# Singleton Instance
state_manager = StateManager()
