import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import time
import argparse

from state_manager import StateManager
from routers.state_manager_instance import state_manager, session_manager
from routers import eagle_ai, data_analyzer, model_adaptor, time_series_provider

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Industrial Startup
    print("[BOOT] Eagle Framework v1.3.1-HF15 initializing...")
    state_manager.generate_initial_state("eagle_ai")
    
    # Start housekeeping
    loop = asyncio.get_event_loop()
    loop.create_task(lifecycle_manager())
    yield
    print("[BOOT] Eagle Framework shutting down...")

async def lifecycle_manager():
    """Housekeeping for dead sessions."""
    while True:
        await asyncio.sleep(10)
        now = time.time()
        async with session_manager.lock:
            dead_sessions = [sid for sid, state in session_manager.sessions.items() if now - state.last_heartbeat > 30]
            for sid in dead_sessions:
                print(f"[Session] Cleaning up: {sid}")
                del session_manager.sessions[sid]

app = FastAPI(
    title="Eagle Shared Backend",
    version="1.3.1",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Routers
app.include_router(eagle_ai.router)
app.include_router(data_analyzer.router)
app.include_router(model_adaptor.router)
app.include_router(time_series_provider.router)

@app.get("/ping")
async def ping():
    return {"status": "ok", "framework": "Eagle v1.3.1"}

@app.api_route("/{path_name:path}", methods=["GET", "POST", "OPTIONS"])
async def catch_all(request: Request, path_name: str):
    return {"error": "Not Found", "path": path_name}

def get_available_port(start_port: int) -> int:
    import socket
    port = start_port
    while port < start_port + 10:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(('127.0.0.1', port)) != 0:
                return port
        port += 1
    return start_port

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=6789)
    args = parser.parse_args()
    
    target_port = get_available_port(args.port)
    print(f"[BOOT] Initializing on 127.0.0.1:{target_port}")
    
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=target_port,
        reload=False,
        log_level="info"
    )
