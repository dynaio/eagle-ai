from fastapi import APIRouter, HTTPException, Depends, Header, UploadFile, File
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
from datetime import datetime
import random
import io
import polars as pl
from routers.state_manager_instance import state_manager, session_manager

router = APIRouter(prefix="/eagle", tags=["EagleAI"])

class MachineStatusUpdate(BaseModel):
    machine_id: str
    status: str

class MachineUpdate(BaseModel):
    machine_id: str
    hours: float

class ManualUpdateRequest(BaseModel):
    machine_id: str
    efficiency: float
    production: float
    endsdown: int
    runtime: float
    is_running: bool = True

class PredictRequest(BaseModel):
    machine_id: str
    current_metrics: Dict[str, Any]

async def get_session(x_session_id: str = Header(..., description="Unique Session ID")):
    return await session_manager.get_session(x_session_id)

@router.get("/state")
async def get_eagle_state():
    state = state_manager.get_state("eagle_ai")
    if not state:
        state_manager.generate_initial_state("eagle_ai")
        state = state_manager.get_state("eagle_ai")
    return state

@router.get("/machines")
async def get_machines(state: Any = Depends(get_session)):
    # Simulate drift
    for m in state.machines.values():
        if m["status"] == "Running":
            m["efficiency"] = max(85.0, min(99.0, m["efficiency"] + random.uniform(-0.5, 0.5)))
            m["production"] += random.uniform(0.1, 0.3)
            m["predicted_maintenance_hours"] = max(0, m["predicted_maintenance_hours"] - 0.1)

    state_manager.refresh_from_session("eagle_ai", state)
    return list(state.machines.values())

@router.post("/machine/status")
async def update_machine_status(req: MachineStatusUpdate, state: Any = Depends(get_session)):
    if req.machine_id not in state.machines:
        raise HTTPException(status_code=404, detail="Machine not found")
    
    m = state.machines[req.machine_id]
    now_str = datetime.now().isoformat()
    
    if req.status == "Maintained":
        m["status"] = "Running"
        m["predicted_maintenance_hours"] = 336.0
        m["efficiency"] = 99.0
    elif req.status == "Stopped":
        m["status"] = "Stopped"
    elif req.status == "Running":
        m["status"] = "Running"
        
    state_manager.refresh_from_session("eagle_ai", state)
    return {"status": "success", "machine": m}

@router.post("/test/randomize_fleet")
async def randomize_fleet(state: Any = Depends(get_session)):
    now_str = datetime.now().isoformat()
    for i, m in enumerate(state.machines.values()):
        day = (i % 14) + 1
        m["predicted_maintenance_hours"] = (day * 24) + random.uniform(-1.0, 1.0)
        m["efficiency"] = random.uniform(82.0, 98.5)
        m["status"] = "Running" if day > 2 else random.choice(["Running", "Stopped"]) 
            
    state_manager.refresh_from_session("eagle_ai", state)
    return {"status": "success"}
