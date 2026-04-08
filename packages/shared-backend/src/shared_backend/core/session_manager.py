import random
from typing import Dict, Any, Optional
from datetime import datetime

class SessionState:
    def __init__(self, app_id: str, machines: Dict[str, Any]):
        self.app_id = app_id
        self.machines = machines
        self.last_updated = datetime.now()

class SessionManager:
    """
    Manages in-memory state for active sessions.
    Handles drift simulation and telemetry tracking.
    """
    def __init__(self):
        self.sessions: Dict[str, SessionState] = {}

    async def get_session(self, session_id: str, app_id: str, initial_machines: Dict[str, Any]) -> SessionState:
        if session_id not in self.sessions:
            self.sessions[session_id] = SessionState(app_id, initial_machines)
        return self.sessions[session_id]

    def remove_session(self, session_id: str):
        if session_id in self.sessions:
            del self.sessions[session_id]

    def clear_all_sessions(self):
        self.sessions = {}

# Singleton Instance
session_manager = SessionManager()
