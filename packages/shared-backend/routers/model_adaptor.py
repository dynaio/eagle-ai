from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
from .state_manager_instance import session_manager

router = APIRouter(prefix="/model-adaptor", tags=["ModelAdaptor"])

async def get_session(x_session_id: str = Header(..., description="Unique Session ID")):
    return await session_manager.get_session(x_session_id)

@router.get("/status")
async def get_model_status():
    return {"model": "tiny_time_mixer", "status": "loaded"}
