from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import os
import json
import random
from core.config import STATE_DIR, DATA_DIR
from core.state_manager import state_manager
from core.session_manager import session_manager
from services.ai_engine import ai_engine
from services.db_connector import DBConnector
from .eagleai import model__predict__, is__data__valid__, XGBoost__Machine__update__

router = APIRouter(prefix="/eagle", tags=["EagleAI"])

class MachineHoursUpdate(BaseModel):
    machine_id: str
    hours: float

def generate_weekly_predictions(base_hours, last_updated_str):
    # base_hours is relative to last_updated_str
    # Returns 5 weeks (35 days) of mock predictions aligned with the model logic
    last_updated = datetime.fromisoformat(last_updated_str)
    
    crit_day_offset = int(base_hours / 24) % 35
    crit_shift = (int(base_hours) % 3) + 1
    critical_date = last_updated.date() + timedelta(days=crit_day_offset)
    estimated_ts = datetime.combine(critical_date, datetime.min.time()) + timedelta(hours=(crit_shift-1)*8 + 10) # Roughly middle of shift
    
    predictions = []
    for day_offset in range(35):
        current_date = last_updated.date() + timedelta(days=day_offset)
        shifts_severity = []
        for shift_num in [1, 2, 3]:
            # PERSISTENCE LOGIC: Machine stays down until maintained
            if current_date > critical_date:
                severity = 2
            elif current_date == critical_date and shift_num >= crit_shift:
                severity = 2
            else:
                days_until_critical = (critical_date - current_date).days
                if 0 <= days_until_critical <= 7:
                    severity = 1
                else:
                    severity = 0
            shifts_severity.append(severity)
            
        predictions.append({
            "week": (day_offset // 7) + 1,
            "date": current_date.isoformat(),
            "shifts": shifts_severity
        })
        
    return {
        "weekly_predictions": predictions,
        "critical_failure": {
            "shift": crit_shift,
            "confidence": 0.85, # Mock confidence
            "estimated_day_offset": crit_day_offset,
            "estimated_timestamp": estimated_ts.isoformat()
        }
    }

@router.get("/state")
async def get_eagle_state():
    state = state_manager.get_state("eagle_ai", "eagle_ai_state.json")
    if not state:
        # Fallback to initial if missing
        initial = {
            "last_updated": datetime.now().isoformat(),
            "settings": {
                "refresh_interval_minutes": 30, 
                "prediction_interval_weeks": 5,
                "default_maintenance_horizon_hours": 336,
                "critical_threshold_hours": 24,
                "maintenance_capacity": {"shift1": 5, "shift2": 5, "shift3": 5},
                "spider_web_active": False,
                "urgency_thresholds": {"critical": 30, "warning": 30, "healthy": 40},
                "saturation_horizon_days": 15
            }
        }
        state_manager.initialize_app_state("eagle_ai", initial, "eagle_ai_state.json")
        state = initial
    else:
        # Migration for existing state
        needs_save = False
        if "settings" not in state: 
            state["settings"] = {}
            needs_save = True
            
        if "machines_metadata" not in state:
            # Import metadata from legacy file if it exists, otherwise initialize
            legacy_path = STATE_DIR / "machines_pred.json"
            if legacy_path.exists():
                try:
                    with open(legacy_path, 'r') as f:
                        legacy_data = json.load(f)
                        state["machines_metadata"] = {m["machine_id"]: m for m in legacy_data.get("machines", [])}
                except:
                    state["machines_metadata"] = {}
            else:
                state["machines_metadata"] = {}
            needs_save = True

        # Initialize machines_metadata if it's empty
        if not state["machines_metadata"]:
            for i in range(851, 883):
                m_id = f"MC{i}"
                state["machines_metadata"][m_id] = {
                    "machine_id": m_id,
                    "status": "Running",
                    "maintenance": {"hours_remaining": 336.0}
                }
            needs_save = True
            
        if "spider_web_active" in state["settings"]:
            # Move old setting to new structure if exists
            if "database_settings" not in state["settings"]:
                state["settings"]["database_settings"] = {
                    "db_type": "SQL Server",
                    "host": "localhost",
                    "username": "",
                    "password": "",
                    "update_interval": 30,
                    "spider_web_active": state["settings"]["spider_web_active"],
                    "selected_tables": []
                }
            del state["settings"]["spider_web_active"]
            needs_save = True
            
        if "database_settings" not in state["settings"]:
             state["settings"]["database_settings"] = {
                    "db_type": "SQL Server",
                    "host": "localhost",
                    "username": "",
                    "password": "",
                    "update_interval": 30,
                    "spider_web_active": False,
                    "selected_tables": []
                }
             needs_save = True

        if "urgency_thresholds" not in state["settings"]:
            state["settings"]["urgency_thresholds"] = {"critical": 80, "warning": 60, "healthy": 35}
            needs_save = True
            
        if "saturation_horizon_days" not in state["settings"]:
            state["settings"]["saturation_horizon_days"] = 15
            needs_save = True
            
        # Update test mode period if in testing
        if state.get("app_info", {}).get("license_status") == "Test Mode":
            state["settings"]["test_period_days"] = 120
            needs_save = True
            
        # Logic for disabling manual data when spider web is active
        db_settings = state.get("settings", {}).get("database_settings", {})
        state["manual_upload_allowed"] = not db_settings.get("spider_web_active", False)
        
        # Add notification system if missing
        if "notifications" not in state:
            state["notifications"] = []
            needs_save = True
            
        # Report AI Engine status
        state["is_processing"] = ai_engine.is_processing

        if needs_save:
            state_manager.save_state("eagle_ai", state, "eagle_ai_state.json")
    return state

@router.post("/state")
async def save_eagle_state(state: Dict[str, Any]):
    # Prevent overwriting machines data in the core state file if accidentally sent
    if "machines_data" in state:
        del state["machines_data"]
    
    state["last_updated"] = datetime.now().isoformat()
    state_manager.save_state("eagle_ai", state, "eagle_ai_state.json")
    return {"status": "success"}

@router.get("/machines")
async def get_machines(x_session_id: str = Header("default-session")):
    # 1. Retrieve latest forecasts from AI Engine (Using predictions.json exclusively)
    model_data = ai_engine.get_machine_forecasts()
    raw_predictions = model_data.get("predictions", [])
    dataset_info = model_data.get("dataset_info", {})
    
    # Reference date for day offsets
    last_date_str = dataset_info.get("last_date", "")
    try:
        reference_date = datetime.strptime(last_date_str, "%Y-%m-%d %H:%M:%S")
    except Exception:
        reference_date = datetime.now()

    # Map raw predictions (851.0 -> MC851)
    predictions_map = {}
    for p in raw_predictions:
        raw_id = str(p.get("machine_id", ""))
        numeric_id = "".join(filter(str.isdigit, raw_id.split('.')[0]))
        if numeric_id:
            predictions_map[f"MC{numeric_id}"] = p.get("shifts", [])

    # 2. Get machine metadata from eagle_ai_state.json
    state = state_manager.get_state("eagle_ai", "eagle_ai_state.json")
    machines_metadata = state.get("machines_metadata", {})
    
    # If no metadata (should be handled in get_state above, but for safety)
    if not machines_metadata:
        for i in range(851, 883):
            m_id = f"MC{i}"
            machines_metadata[m_id] = {
                "machine_id": m_id,
                "status": "Running",
                "maintenance": {"hours_remaining": 336.0}
            }

    final_machines = []
    
    # 3. Process each machine
    for m_id, m in machines_metadata.items():
        shifts = predictions_map.get(m_id)
        
        # Ensure deep copy to avoid session contamination logic if needed, but we modify in place for the response
        m_copy = json.loads(json.dumps(m))
            
        if shifts:
            m_copy["maintenance"]["weekly_predictions"] = shifts
            
            # --- DATE SYNCHRONIZATION ---
            now = datetime.now()
            reference_date_only = reference_date.replace(hour=0, minute=0, second=0, microsecond=0)
            now_only = now.replace(hour=0, minute=0, second=0, microsecond=0)
            current_day_offset = (now_only - reference_date_only).days
            
            current_shift_num = 1 if 6 <= now.hour < 14 else 2 if 14 <= now.hour < 22 else 3
            
            true_current_shift = next((s for s in shifts if s.get("day") == current_day_offset and s.get("shift") == current_shift_num), None)
            if not true_current_shift and current_day_offset < 1:
                 true_current_shift = next((s for s in shifts if s.get("day") == 1 and s.get("shift") == current_shift_num), None)
            
            m_copy["maintenance"]["next_shift_probability"] = true_current_shift.get("probability", 1.0) if true_current_shift else 1.0
            
            # Compute fault date: FIRST shift with prob > 80%? 
            # Wait, user said bigger prob = critical. 
            # So fault date is first day/shift with probability > 80% (0.8)
            SHIFT_HOURS = {1: 6, 2: 14, 3: 22}
            sorted_shifts = sorted(shifts, key=lambda x: (x.get("day", 0), x.get("shift", 0)))
            
            estimated_ts = None
            first_failing_shift = None
            for s in sorted_shifts:
                prob = s.get("probability", 1.0)
                if prob <= 0.3: # Threshold for critical (<= 30%)
                    day_num = s.get("day", 1)
                    shift_num = s.get("shift", 1)
                    shift_hour = SHIFT_HOURS.get(shift_num, 6)
                    fault_dt = reference_date_only + timedelta(days=day_num)
                    fault_dt = fault_dt.replace(hour=shift_hour)
                    estimated_ts = fault_dt.isoformat()
                    first_failing_shift = s
                    break
            
            if estimated_ts:
                m_copy["maintenance"]["critical_failure"] = {
                    "estimated_timestamp": estimated_ts,
                    "shift": first_failing_shift.get("shift", 1),
                    "confidence": round(first_failing_shift.get("probability", 0.0), 2),
                    "estimated_day_offset": first_failing_shift.get("day", 1)
                }
        
        final_machines.append(m_copy)

    # 4. Session Management & Synchronization
    session = await session_manager.get_session(x_session_id, "eagle_ai", {m["machine_id"]: m for m in final_machines})
    
    # CRITICAL: Always sync predictions to existing session machines
    for m in final_machines:
        m_id = m["machine_id"]
        if m_id in session.machines:
            # Update prediction data only, preserving manual state if needed
            session.machines[m_id]["maintenance"]["weekly_predictions"] = m["maintenance"].get("weekly_predictions", [])
            session.machines[m_id]["maintenance"]["next_shift_probability"] = m["maintenance"].get("next_shift_probability", 1.0)
            session.machines[m_id]["maintenance"]["critical_failure"] = m["maintenance"].get("critical_failure")
            
    return list(session.machines.values())

@router.post("/notifications/clear")
async def clear_notifications():
    """Mark all notifications as read."""
    state = state_manager.get_state("eagle_ai", "eagle_ai_state.json")
    for note in state.get("notifications", []):
        note["read"] = True
    state_manager.save_state("eagle_ai", state, "eagle_ai_state.json")
    return {"status": "success"}

@router.post("/predict")
async def trigger_prediction():
    """Manually trigger the AI Engine."""
    result = ai_engine.run_prediction(n_days=10)
    return result

@router.post("/neural-bridge/autofind-host")
async def autofind_db_host():
    """Automatic discovery of Rieter/Industrial database servers."""
    hosts = DBConnector.autofind_hosts()
    return {"hosts": hosts}

@router.post("/neural-bridge/autofind-table")
async def autofind_db_table():
    """Structure-aware table discovery (matches current model structure)."""
    state_data = await get_eagle_state() # Use the function to get hydrated state
    db_settings = state_data.get("settings", {}).get("database_settings", {})
    if not db_settings.get("host"):
         raise HTTPException(status_code=400, detail="Database host not configured.")

    connector = DBConnector(db_settings)
    # Use production_data.xls as reference template
    ref_path = DATA_DIR / "production_data.xls"
    
    # Fallback to last uploaded file if default template missing
    if not os.path.exists(ref_path):
        uploaded_files = state_data.get("uploaded_files", [])
        if uploaded_files:
            ref_path = DATA_DIR / uploaded_files[-1]["internal_name"]

    matches = connector.autofind_table(ref_path)
    return {"matches": matches}

@router.get("/neural-bridge/tables")
async def list_available_tables():
    state_data = await get_eagle_state()
    db_settings = state_data.get("settings", {}).get("database_settings", {})
    if not db_settings.get("host"):
         return {"tables": []}
         
    connector = DBConnector(db_settings)
    return {"tables": connector.discover_tables()}

    return list(session.machines.values())

@router.post("/machine/status")
async def update_machine_status(update: Dict[str, Any], x_session_id: str = Header("default-session")):
    state = state_manager.get_state("eagle_ai", "eagle_ai_state.json")
    machines_metadata = state.get("machines_metadata", {})
    
    m_id = update.get("machine_id")
    if m_id in machines_metadata:
        m = machines_metadata[m_id]
        m["status"] = update.get("status")
        if m["status"] == "Maintained":
            m["status"] = "Running"
            
            day = update.get("day")
            month = update.get("month")
            year = update.get("year")
            time_str = update.get("time", "08:00")
            
            if day and month and year:
                try:
                    h, mn = map(int, time_str.split(':'))
                    maint_dt = datetime(year, month, day, h, mn)
                    maint_ts_str = maint_dt.isoformat()
                except:
                    maint_ts_str = update.get("timestamp", datetime.now().isoformat())
            else:
                maint_ts_str = update.get("timestamp", datetime.now().isoformat())

            m["maintenance"]["hours_remaining"] = 336.0 
            m["maintenance"]["prediction_date"] = maint_ts_str
            # Forecast reset logic (mock) - wait, we should probably stick to actual predictions.json data
            # but for manual maintenance reset, we can still generate mock predictions until net XGBoost run
            m["maintenance"]["weekly_predictions"] = generate_weekly_predictions(336.0, maint_ts_str)["weekly_predictions"]
        
        # Save to main state
        state_manager.save_state("eagle_ai", state, "eagle_ai_state.json")
        
        # XGBOOST UPDATE
        try:
            predictions_path = str(STATE_DIR / "predictions.json")
            XGBoost__Machine__update__(
                machine_id=m_id, 
                current_status=update.get("status"),
                output_json=predictions_path
            )
        except Exception as e:
            print(f"XGBoost manual update failed: {e}")
            
    # Sync session
    session = await session_manager.get_session(x_session_id, "eagle_ai", {})
    if m_id in session.machines:
        session.machines[m_id]["status"] = m["status"]
        session.machines[m_id]["maintenance"] = m["maintenance"]
        
    return {"status": "success"}

@router.post("/machine/update-hours")
async def update_machine_hours(update: MachineHoursUpdate, x_session_id: str = Header("default-session")):
    state = state_manager.get_state("eagle_ai", "eagle_ai_state.json")
    machines_metadata = state.get("machines_metadata", {})
    last_updated_str = state.get("last_updated", datetime.now().isoformat())

    if update.machine_id in machines_metadata:
        m = machines_metadata[update.machine_id]
        m["maintenance"]["hours_remaining"] = update.hours
        m["maintenance"]["prediction_date"] = last_updated_str
        m["maintenance"]["weekly_predictions"] = generate_weekly_predictions(update.hours, last_updated_str)["weekly_predictions"]
        
        state_manager.save_state("eagle_ai", state, "eagle_ai_state.json")
        
        # Sync session
        session = await session_manager.get_session(x_session_id, "eagle_ai", {})
        if update.machine_id in session.machines:
            session.machines[update.machine_id]["maintenance"] = m["maintenance"]
            
        return {"status": "success"}
    
    raise HTTPException(status_code=404, detail="Machine not found")

@router.post("/test/randomize_fleet")
async def randomize_fleet(x_session_id: str = Header("default-session")):
    state = state_manager.get_state("eagle_ai", "eagle_ai_state.json")
    machines_metadata = state.get("machines_metadata", {})
    
    for i, (m_id, m) in enumerate(machines_metadata.items()):
        day = (i % 14) + 1
        m["maintenance"]["hours_remaining"] = (day * 24) + random.uniform(-1.0, 1.0)
        m["status"] = "Running" if day > 2 else random.choice(["Running", "Stopped"]) 
    
    state_manager.save_state("eagle_ai", state, "eagle_ai_state.json")
    
    # Clear session to force reload from persistent state
    if x_session_id in session_manager.sessions:
        del session_manager.sessions[x_session_id]
            
    return {"status": "success"}
