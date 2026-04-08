import logging
import asyncio
from typing import Dict, Any, Optional, List
from datetime import datetime
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from core.state_manager import state_manager
from services.db_connector import DBConnector

logger = logging.getLogger(__name__)

class DBSyncService:
    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self.is_running = False
        self.last_sync = None
        self.next_sync = None
        self.sync_active = False

    def start(self):
        if self.is_running:
            return
        
        # Load state to check if live sync is enabled
        state = state_manager.get_state("eagle_ai", "eagle_ai_state.json")
        settings = state.get("settings", {})
        db_settings = settings.get("database_settings", {})
        
        if db_settings.get("spider_web_active"):
            interval = db_settings.get("update_interval", 30)
            self.scheduler.add_job(
                self.sync_task, 
                'interval', 
                minutes=interval, 
                id='db_sync_job',
                replace_existing=True
            )
            self.scheduler.start()
            self.is_running = True
            logger.info(f"Spider Web Live Sync started with interval: {interval}m")
            
            # Update next sync time for UI
            job = self.scheduler.get_job('db_sync_job')
            if job:
                self.next_sync = job.next_run_time.isoformat()

    def stop(self):
        if self.is_running:
            self.scheduler.shutdown()
            self.is_running = False
            logger.info("Spider Web Live Sync stopped.")

    async def sync_task(self):
        """Main synchronization task."""
        if self.sync_active:
            return
        
        self.sync_active = True
        try:
            state = state_manager.get_state("eagle_ai", "eagle_ai_state.json")
            db_settings = state.get("settings", {}).get("database_settings", {})
            
            if not db_settings.get("spider_web_active") or not db_settings.get("selected_tables"):
                return

            connector = DBConnector(db_settings)
            all_new_data = []
            
            last_sync_ts = db_settings.get("last_sync_timestamp")
            
            for table in db_settings["selected_tables"]:
                logger.info(f"Syncing from table: {table}")
                data = connector.fetch_data(table, last_sync_ts)
                if data:
                    all_new_data.extend(data)
            
            if all_new_data:
                # 1. Save data to a consistent file for AI processing
                # In a real app, this would convert the list of dicts to a proper XLS/CSV file
                data_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
                os.makedirs(data_dir, exist_ok=True)
                live_file = os.path.join(data_dir, "production_data_live.xls")
                
                # Convert results to DataFrame and save (Simulating XLS save, usually CSV is easier for pandas on Linux)
                try:
                    df = pd.DataFrame(all_new_data)
                    # We use CSV as internal standard if XLS writer is tricky, but AIEngine handles both
                    df.to_excel(live_file, index=False)
                    logger.info(f"Saved {len(all_new_data)} live records to {live_file}")
                except Exception as e:
                    logger.error(f"Failed to save live data file: {e}")

                # 2. Update persistent status
                db_settings["last_sync_timestamp"] = datetime.now().isoformat()
                state["last_updated"] = db_settings["last_sync_timestamp"]
                state_manager.save_state("eagle_ai", state, "eagle_ai_state.json")
                
                self.last_sync = db_settings["last_sync_timestamp"]
                
                # 3. Trigger AI Engine prediction (Background)
                from services.ai_engine import ai_engine
                ai_engine.run_prediction(n_days=10)
            
            # Update next sync for UI
            job = self.scheduler.get_job('db_sync_job')
            if job:
                self.next_sync = job.next_run_time.isoformat()

        except Exception as e:
            logger.error(f"Sync task failed: {e}")
        finally:
            self.sync_active = False

    def get_status(self) -> Dict[str, Any]:
        return {
            "is_running": self.is_running,
            "sync_active": self.sync_active,
            "last_sync": self.last_sync,
            "next_sync": self.next_sync
        }

# Singleton Instance
db_sync_service = DBSyncService()
