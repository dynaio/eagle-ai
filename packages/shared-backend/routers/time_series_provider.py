from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
from .state_manager_instance import session_manager

router = APIRouter(prefix="/time-series", tags=["TimeSeriesProvider"])

async def get_session(x_session_id: str = Header(..., description="Unique Session ID")):
    return await session_manager.get_session(x_session_id)

@router.get("/config")
async def get_provider_config():
    return {"provider": "IndustrialStream", "interval": "1s"}
