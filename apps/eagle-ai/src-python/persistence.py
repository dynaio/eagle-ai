import os
import json
from datetime import datetime
from core.config import DATA_DIR

class DatabaseLayer:
    """
    Industrial Persistence Bridge for EagleAI.
    Synchronizes Python Sidecar with the central eagle_state.json.
    """
    
    def __init__(self, storage_path: str = None):
        if storage_path is None:
            self.state_path = str(DATA_DIR / "eagle_state.json")
        else:
            self.state_path = storage_path
            
    def _read_raw_state(self) -> dict:
        if os.path.exists(self.state_path):
            with open(self.state_path, 'r') as f:
                return json.load(f)
        return {}

    def _write_raw_state(self, state: dict):
        with open(self.state_path, 'w') as f:
            json.dump(state, f, indent=4)

    def get_fleet(self, session_id: str = None) -> list:
        state = self._read_raw_state()
        machines = state.get('machines_data', [])
        # Transform to simplified fleet format for the sidecar API
        fleet = []
        for m in machines:
            fleet.append({
                "machine_id": m.get('machine_id'),
                "status": m.get('status'),
                "maintenance": m.get('maintenance', {}),
                "performance": m.get('performance', {})
            })
        return fleet

    def save_fleet(self, session_id: str, fleet_updates: list):
        state = self._read_raw_state()
        machines = state.get('machines_data', [])
        
        # Update existing machines in the central state
        for update in fleet_updates:
            for m in machines:
                if m['machine_id'] == update.get('machine_id'):
                    # Update core fields
                    if 'status' in update:
                        m['status'] = update['status']
                    if 'maintenance' in update:
                        m['maintenance'].update(update['maintenance'])
                    if 'predicted_maintenance_hours' in update:
                        m['maintenance']['hours_remaining'] = update['predicted_maintenance_hours']
                    break
        
        state['last_updated'] = datetime.now().isoformat()
        self._write_raw_state(state)

    def get_stats(self, session_id: str = None) -> dict:
        state = self._read_raw_state()
        stats = state.get('global_stats', {})
        return {
            "sync_count": 1, # Centralized state doesn't track this per se
            "fleet_health": stats.get('fleet_integrity_score', 0),
            "uptime": 1240,
            "last_updated": state.get('last_updated', 'Never')
        }
