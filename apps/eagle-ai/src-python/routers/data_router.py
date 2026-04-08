from fastapi import APIRouter, UploadFile, File, HTTPException, Header
import os
import shutil
from datetime import datetime
from .eagleai import is__data__valid__, model__predict__
from services.ai_engine import ai_engine
from core.state_manager import state_manager
from core.session_manager import session_manager
from core.config import DATA_DIR, STATE_DIR

router = APIRouter(tags=["Data Ingestion"])

@router.post("/handler")
async def handle_industrial_data(
    file: UploadFile = File(...),
    x_session_id: str = Header("default-session")
):
    """
    Industrial Data Ingestion Handler.
    Receives shift-level data (XLS/XLSX/CSV), validates it, and triggers AIEngine.
    """
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)

    # Standardize filename to production_data_live.xls (keep extension but standardized name)
    ext = os.path.splitext(file.filename)[1]
    # We use .xls as the standard internal name for the model if not specified otherwise
    internal_filename = "production_data_live" + ext
    file_path = os.path.join(DATA_DIR, internal_filename)

    try:
        # Save file to disk
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # 1. Validate data against model expectations
        # Use production_data.xls as reference if it exists
        ref_path = os.path.join(DATA_DIR, "production_data.xls")
        if not os.path.exists(ref_path):
            ref_path = file_path # Self-reference if first time

        is_valid, validation_details = is__data__valid__(file_path, verbose=True)

        if not is_valid:
            # Push an error notification to the FIFO queue
            error_msg = f"Data Format Mismatch: Industrial feed {file.filename} is missing required telemetry columns."
            ai_engine.add_notification("error", error_msg)
            # Return 400 so the frontend shows the red dialog
            raise HTTPException(status_code=400, detail=error_msg)

        # 1.5 Update State to register this as the latest processed file
        state = state_manager.get_state("eagle_ai", "eagle_ai_state.json")
        uploaded_files = state.get("uploaded_files", [])
        
        # Add new entry
        new_file_entry = {
            "id": datetime.now().strftime("%Y%m%d%H%M%S"),
            "original_name": file.filename,
            "internal_name": internal_filename,
            "upload_timestamp": datetime.now().isoformat(),
            "status": "processed",
            "rows": 0 # Logic to count rows could be added here
        }
        
        # Keep only last 5 for history hygiene
        uploaded_files.append(new_file_entry)
        state["uploaded_files"] = uploaded_files[-5:]
        state_manager.save_state("eagle_ai", state, "eagle_ai_state.json")

        # 2. Trigger AI Engine in the background
        # Note: run_prediction handles the persistence to predictions.json
        ai_engine.add_notification("Industrial dataset loaded successfully. Starting Neural Engine sync...", "success")
        ai_engine.run_prediction(n_days=14)
        
        # Clear sessions to force data refresh across all clients
        session_manager.clear_all_sessions()

        return {
            "status": "success",
            "saved_as": internal_filename,
            "message": "Data received and validation passed. AI Engine is processing.",
            "session": x_session_id
        }

    except HTTPException:
        raise
    except Exception as e:
        error_msg = f"Ingestion Critical Failure: {str(e)}"
        ai_engine.add_notification("error", error_msg)
        raise HTTPException(status_code=500, detail=error_msg)
