from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
from .state_manager_instance import session_manager

router = APIRouter(prefix="/data-analyzer", tags=["DataAnalyzer"])

class LoadRequest(BaseModel):
    path: str

async def get_session(x_session_id: str = Header(..., description="Unique Session ID")):
    return await session_manager.get_session(x_session_id)

@router.post("/load")
async def load_dataset(req: LoadRequest, state: Any = Depends(get_session)):
    # Legacy logic placeholder
    return {"status": "success", "path": req.path}

@router.get("/stats")
async def get_stats(state: Any = Depends(get_session)):
    return {"row_count": state.total_rows, "col_count": len(state.columns)}
