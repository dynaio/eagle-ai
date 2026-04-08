import os
import json
import logging
import threading
from datetime import datetime
from typing import Dict, Any, Optional, List
import pandas as pd
from core.config import DATA_DIR, STATE_DIR
from core.state_manager import state_manager
from routers.eagleai import model__predict__, is__data__valid__

logger = logging.getLogger(__name__)

class AIEngine:
    def __init__(self):
        self.data_dir = str(DATA_DIR)
        self.state_dir = str(STATE_DIR)
        os.makedirs(self.data_dir, exist_ok=True)
        os.makedirs(self.state_dir, exist_ok=True)
        # Force strict state path as per user requirement
        self.predictions_file = os.path.join(self.state_dir, "predictions.json")
        self.is_processing = False
        self._lock = threading.Lock()

    def get_latest_data_path(self) -> Optional[str]:
        """Determines the best data source for prediction."""
        state = state_manager.get_state("eagle_ai", "eagle_ai_state.json")
        uploaded_files = state.get("uploaded_files", [])
        
        # 1. Check for manual uploads
        if uploaded_files:
            for f in reversed(uploaded_files):
                if f.get("status") == "processed":
                    path = os.path.join(self.data_dir, f["internal_name"])
                    if os.path.exists(path):
                        return path
        
        # 2. Check for Live Data from Spider Web
        live_path = os.path.join(self.data_dir, "production_data_live.xls")
        if os.path.exists(live_path):
            return live_path

        # 3. Check for default production data
        default_path = os.path.join(self.data_dir, "production_data.xls")
        if os.path.exists(default_path):
            return default_path
            
        return None

    def add_notification(self, type_str: str, message: str):
        """Adds a notification to the Eagle AI state using FIFO (max 10)."""
        try:
            state = state_manager.get_state("eagle_ai", "eagle_ai_state.json")
            notifications = state.get("notifications", [])
            
            new_note = {
                "id": str(datetime.now().timestamp()),
                "type": type_str, # 'info', 'success', 'warning', 'error', 'processing'
                "message": message,
                "timestamp": datetime.now().isoformat(),
                "read": False
            }
            
            notifications.insert(0, new_note)
            # FIFO: Keep last 10
            state["notifications"] = notifications[:10]
            state_manager.save_state("eagle_ai", state, "eagle_ai_state.json")
        except Exception as e:
            logger.error(f"Failed to add notification: {e}")

    def run_prediction(self, n_days: int = 14, force: bool = False):
        """Triggers the prediction pipeline in a background thread."""
        with self._lock:
            if self.is_processing:
                logger.warning("Prediction already in progress.")
                return
            self.is_processing = True

        thread = threading.Thread(target=self._prediction_worker, args=(n_days,))
        thread.daemon = True
        thread.start()

    def _prediction_worker(self, n_days: int):
        """Worker thread for running the time-consuming model prediction."""
        try:
            file_path = self.get_latest_data_path()
            if not file_path:
                self.add_notification("error", "Prediction aborted: No valid data source found.")
                return

            # 1. Validation check
            is_valid, details = is__data__valid__(file_path, verbose=False)
            if not is_valid:
                error_msg = f"Data validation failed: Missing columns {details.get('missing', [])}"
                logger.error(error_msg)
                self.add_notification("error", "Selected data does not match the model's expectations. Use Red Acknowledge Box.")
                return

            # 2. Start Prediction
            self.add_notification("Neural Engine training started. Recalculating fleet roadmap...", "processing")
            logger.info(f"AI Engine thread started on: {file_path}")
            
            # This call takes 4-5 minutes
            results = model__predict__(
                file_path=file_path,
                n_days=n_days,
                output_json=self.predictions_file,
                verbose=False
            )
            
            # 3. Finalize and report
            state = state_manager.get_state("eagle_ai", "eagle_ai_state.json")
            state["last_updated"] = datetime.now().isoformat()
            state["model_performance"] = results.get("model_performance", {})
            state["dataset_info"] = results.get("dataset_info", {})
            state_manager.save_state("eagle_ai", state, "eagle_ai_state.json")
            
            self.add_notification("Neural Engine training completed. Roadmap updated.", "success")
            logger.info("AI Engine thread completed successfully.")

            # 4. CAPACITY ALERT SYSTEM
            self.check_capacity_alerts(results.get("predictions", []))

            # 5. DATA AGE REMINDER (Day 7)
            try:
                if results.get("dataset_info"):
                    last_date_str = results["dataset_info"].get("last_date", "")
                    if last_date_str:
                        last_date = datetime.strptime(last_date_str, "%Y-%m-%d %H:%M:%S")
                        age_days = (datetime.now() - last_date).days
                        if age_days >= 7:
                            self.add_notification(
                                f"Predictive window reaching limit (Age: {age_days} days). Please upload fresh industrial data.",
                                "warning"
                            )
            except Exception as e:
                logger.error(f"Data age check failed: {e}")
            
        except Exception as e:
            logger.error(f"AI Engine thread failed: {e}")
            self.add_notification(f"AI Engine failure: {str(e)}", "error")
        finally:
            with self._lock:
                self.is_processing = False

    def check_capacity_alerts(self, all_predictions):
        """Scans predictions for over-capacity shifts and alerts 3 shifts before."""
        try:
            # Load settings for capacity from main state
            state = state_manager.get_state("eagle_ai", "eagle_ai_state.json")
            capacities = state.get("settings", {}).get("maintenance_capacity", {"shift1": 5, "shift2": 5, "shift3": 5})
            
            # Group by shift: (day, shift) -> count
            shift_counts = {}
            for m_pred in all_predictions:
                for shift in m_pred.get("shifts", []):
                    # Fixed thresholds for red status (prob <= 0.6)
                    if shift.get("probability", 1.0) <= 0.6 or shift.get("predicted_class") == 0:
                        key = (shift["day"], shift["shift"])
                        shift_counts[key] = shift_counts.get(key, 0) + 1
            
            # Check for exceedance
            for (day, shift_num), count in sorted(shift_counts.items()):
                limit = capacities.get(f"shift{shift_num}", 5)
                if count > limit:
                    msg = f"SATURATION ALERT: Shift {shift_num} on Day {day} exceeds repair capacity ({count}/{limit} machines). Reallocate staff immediately."
                    self.add_notification("error", msg)
        except Exception as e:
            logger.error(f"Capacity check failed: {e}")

    def get_machine_forecasts(self) -> Dict[str, Any]:
        """Loads the last generated forecasts from disk (Smart Cache)."""
        if os.path.exists(self.predictions_file):
            try:
                with open(self.predictions_file, 'r') as f:
                    data = json.load(f)
                    
                    # 5. DATA AGE REMINDER (Day 7) - Check even on startup
                    try:
                        dataset_info = data.get("dataset_info", {})
                        last_date_str = dataset_info.get("last_date", "")
                        if last_date_str:
                            last_date = datetime.strptime(last_date_str, "%Y-%m-%d %H:%M:%S")
                            age_days = (datetime.now() - last_date).days
                            if age_days >= 7:
                                self.add_notification(
                                    "warning",
                                    f"Predictive window reaching limit (Age: {age_days} days). Please upload fresh industrial data."
                                )
                    except Exception: pass
                    
                    return data
            except Exception as e:
                logger.error(f"Failed to load predictions.json: {e}")
        return {"predictions": []}

# Singleton instance
ai_engine = AIEngine()
