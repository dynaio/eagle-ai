import logging
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
from datetime import datetime
from core.state_manager import state_manager
from services.db_connector import DBConnector
from services.db_sync_service import db_sync_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/database", tags=["Database Integration"])

class DBConfig(BaseModel):
    db_type: str
    host: str
    port: Optional[int] = None
    database: Optional[str] = None
    namespace: Optional[str] = None
    username: str
    password: str
    update_interval: int = 30
    spider_web_active: bool = False
    selected_tables: List[str] = []

@router.get("/settings")
async def get_db_settings():
    state = state_manager.get_state("eagle_ai", "eagle_ai_state.json")
    settings = state.get("settings", {})
    return settings.get("database_settings", {})

@router.post("/settings")
async def save_db_settings(config: DBConfig):
    state = state_manager.get_state("eagle_ai", "eagle_ai_state.json")
    if "settings" not in state:
        state["settings"] = {}
    
    state["settings"]["database_settings"] = config.dict()
    state_manager.save_state("eagle_ai", state, "eagle_ai_state.json")
    
    # Restart Sync if active
    db_sync_service.stop()
    if config.spider_web_active:
        logger.info("Restarting Live Sync after settings update.")
        db_sync_service.start()
        
    return {"status": "success"}

@router.post("/test")
async def test_db_connection(config: Dict[str, Any]):
    connector = DBConnector(config)
    result = connector.test()
    if result["status"] == "success":
        # Table Discovery
        result["tables"] = connector.discover_tables()
    return result

@router.post("/discover")
async def discover_tables(config: Dict[str, Any]):
    connector = DBConnector(config)
    tables = connector.discover_tables()
    return {"status": "success", "tables": tables}

@router.get("/status")
async def get_db_status():
    return db_sync_service.get_status()

@router.post("/sync")
async def trigger_manual_sync():
    """Manually trigger a data synchronization."""
    if not db_sync_service.sync_active:
        await db_sync_service.sync_task()
        return {"status": "success", "message": "Neural synchronization completed."}
    else:
        raise HTTPException(status_code=429, detail="Synchronization is already in progress.")
