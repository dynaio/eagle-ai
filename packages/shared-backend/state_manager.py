import os
import json
import time
import shutil
from datetime import datetime
from typing import Dict, Any, List
import sys

class StateManager:
    """
    Multi-App Industrial State Bridge Manager.
    Manages atomic state persistence for all Eagle Framework modules.
    """
    
    def __init__(self, root_dir: str = None):
        if root_dir is None:
            # Resolve to the package root where this file lives
            self.root_dir = os.path.dirname(os.path.abspath(__file__))
        else:
            self.root_dir = root_dir
            
        self.state_dir = os.path.join(self.root_dir, "state")
        self.settings_dir = os.path.join(self.root_dir, "settings")
        
        for d in [self.state_dir, self.settings_dir]:
            if not os.path.exists(d):
                os.makedirs(d)

    def _get_state_path(self, app_id: str) -> str:
        return os.path.join(self.state_dir, f"{app_id}_state.json")

    def _get_temp_path(self, app_id: str) -> str:
        return os.path.join(self.state_dir, f"{app_id}_state.tmp")

    def generate_initial_state(self, app_id: str = "eagle_ai"):
        """Populates the initial state for a specific application."""
        now = datetime.now().isoformat()
        if app_id == "eagle_ai":
            state = {
                "last_updated": now,
                "app_info": { "version": "1.3.1", "edition": "ST", "license_status": "Test Mode" },
                "settings": { "refresh_interval_minutes": 30, "memory_limit_mb": 512, "critical_threshold_hours": 24 },
                "global_stats": { "total_machines": 32, "machines_at_risk": 0, "average_efficiency": 96.5, "fleet_integrity_score": 100.0 },
                "machines_data": [],
                "recommendations": { "urgent_machines_top_5": [], "system_recommendations": "Initialized." }
            }
            for i in range(851, 883):
                m_id = f"MC{i}"
                state["machines_data"].append({
                    "machine_id": m_id,
                    "status": "Running",
                    "maintenance": { "hours_remaining": 336.0, "prediction_date": now, "color_code": "#10b981" },
                    "performance": { "efficiency_pct": 96.5, "endsdown_count": 0, "production_kg": 0.0 }
                })
            self.save_state("eagle_ai", state)
        else:
            self.save_state(app_id, {"last_updated": now, "status": "initialized"})

    def refresh_from_session(self, app_id: str, session_state: Any):
        """Maps session telemetry to the persisted state file."""
        if app_id == "eagle_ai":
            now = datetime.now().isoformat()
            state = self.get_state("eagle_ai") or {}
            state["last_updated"] = now
            state["machines_data"] = []
            
            for m in session_state.machines.values():
                state["machines_data"].append({
                    "machine_id": m["id"],
                    "status": m.get("status", "Running"),
                    "maintenance": {
                        "hours_remaining": round(m.get("predicted_maintenance_hours", 336.0), 1),
                        "prediction_date": m.get("prediction_date", now),
                        "color_code": "#10b981"
                    },
                    "performance": {
                        "efficiency_pct": round(m.get("efficiency", 96.5), 1),
                        "endsdown_count": m.get("endsdown", 0),
                        "production_kg": round(m.get("production", 0), 1)
                    }
                })
            self.save_state("eagle_ai", state)

    def save_state(self, app_id: str, state: Dict[str, Any]):
        path = self._get_state_path(app_id)
        temp = self._get_temp_path(app_id)
        with open(temp, 'w') as f:
            json.dump(state, f, indent=4)
        shutil.move(temp, path)

    def get_state(self, app_id: str) -> Dict[str, Any]:
        path = self._get_state_path(app_id)
        if os.path.exists(path):
            with open(path, 'r') as f:
                return json.load(f)
        return {}

if __name__ == "__main__":
    sm = StateManager()
    sm.generate_initial_state("eagle_ai")
