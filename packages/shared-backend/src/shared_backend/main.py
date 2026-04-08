import uvicorn
import os
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Ensure the package root is in the path for direct execution (sidecar)
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from routers import eagle_ai, model_adaptor, time_series_provider, db_integration, data_router
from core.config import API_TITLE, API_VERSION, DEFAULT_PORT
from contextlib import asynccontextmanager
import asyncio
from services.db_sync_service import db_sync_service
from services.ai_engine import ai_engine

@asynccontextmanager
async def lifespan(app: FastAPI):
    # POLICY: Model predictions are NEVER run automatically.
    # The model only runs when the user manually uploads new industrial data
    # via the data ingestion handler (POST /handler).
    # On startup, the app reads predictions.json from disk directly.
    
    # Start Spider Web Live Sync if enabled in settings
    db_sync_service.start()
    
    yield
    # Stop Sync on shutdown
    db_sync_service.stop()

app = FastAPI(title=API_TITLE, version=API_VERSION, lifespan=lifespan)

# Enable CORS for all apps
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(eagle_ai.router)
app.include_router(model_adaptor.router)
app.include_router(time_series_provider.router)
app.include_router(db_integration.router)
app.include_router(data_router.router, prefix="/data")

@app.get("/state/eagle")
async def get_eagle_state_direct():
    """
    Direct access to the eagle_ai_state.json file.
    Reads from the path defined in StateManager.
    """
    from core.state_manager import state_manager
    state = state_manager.get_state("eagle_ai")
    if not state:
        return {"error": "Eagle state file not found or empty", "status": "failed"}
    return state

@app.get("/")
async def root():
    return {
        "status": "online",
        "api": API_TITLE,
        "version": API_VERSION
    }

@app.get("/ping")
async def ping():
    return {"ping": "pong"}

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    args = parser.parse_args()
    
    print(f"Starting Industrial Backend on port {args.port}...")
    uvicorn.run(app, host="0.0.0.0", port=args.port)
