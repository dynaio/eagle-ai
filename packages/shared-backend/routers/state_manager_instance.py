from state_manager import StateManager
import time
import asyncio
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from datetime import datetime

@dataclass
class DatasetVersion:
    timestamp: float
    df: Any # polars.LazyFrame
    description: str
    memory_mb: float

@dataclass
class SessionState:
    session_id: str
    last_heartbeat: float = field(default_factory=time.time)
    df: Optional[Any] = None
    file_path: Optional[str] = None
    columns: list = field(default_factory=list)
    total_rows: int = 0
    versions: List[DatasetVersion] = field(default_factory=list)
    memory_limit_mb: int = 4096
    machines: Dict[str, Any] = field(default_factory=dict)

class SessionManager:
    def __init__(self):
        self.sessions: Dict[str, SessionState] = {}
        self.lock = asyncio.Lock()
        
    async def get_session(self, session_id: str) -> SessionState:
        async with self.lock:
            if session_id not in self.sessions:
                state = SessionState(session_id=session_id)
                # Initialize 32 G36 machines
                now_str = datetime.now().isoformat()
                for i in range(851, 883):
                    m_id = f"MC{i}"
                    state.machines[m_id] = {
                        "id": m_id,
                        "status": "Running",
                        "efficiency": 96.5,
                        "production": 0.0,
                        "endsdown": 0,
                        "predicted_maintenance_hours": 336.0, 
                        "last_maintained_at": now_str,
                        "started_at": now_str,
                        "stopped_at": None
                    }
                self.sessions[session_id] = state
            else:
                self.sessions[session_id].last_heartbeat = time.time()
            return self.sessions[session_id]

    async def heartbeat(self, session_id: str):
        async with self.lock:
            if session_id not in self.sessions:
                self.sessions[session_id] = SessionState(session_id=session_id)
            self.sessions[session_id].last_heartbeat = time.time()

state_manager = StateManager()
session_manager = SessionManager()
