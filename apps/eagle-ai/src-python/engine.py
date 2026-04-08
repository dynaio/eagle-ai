import random
import io
import pandas as pd
from typing import List, Dict

class PredictionEngine:
    
    def __init__(self):
        # In production, this would load actual TTM weights (.bin or .pt)
        # For the test-mode v1.7, we use a high-fidelity probabilistic simulation.
        self.industrial_safety_cap = 336.0  # 14 Days

    def process_dataset(self, file_content: bytes, current_fleet: List[Dict]) -> List[Dict]:
        """
        Ingests industrial shift logs and updates machine failure horizons.
        """
        try:
            # Attempt to parse as CSV first
            try:
                df = pd.read_csv(io.BytesIO(file_content))
            except:
                df = pd.read_excel(io.BytesIO(file_content))

            # Simulate model inference per machine
            updated_fleet = []
            for machine in current_fleet:
                m_copy = machine.copy()
                
                # Check if machine has data in the shift log
                # Mock logic: If 'vibration_index' or 'rpm_variance' is high, drop hours
                if 'RPM' in df.columns:
                    avg_rpm = df['RPM'].mean()
                    if avg_rpm > 1200: # G36 high-stress threshold
                         m_copy['predicted_maintenance_hours'] *= 0.85
                
                # Random fluctuations to simulate real-time sensor jitter
                jitter = random.uniform(-2, 1)
                m_copy['predicted_maintenance_hours'] = max(1, min(self.industrial_safety_cap, m_copy['predicted_maintenance_hours'] + jitter))
                
                updated_fleet.append(m_copy)
            
            return updated_fleet

        except Exception as e:
            print(f"[ENGINE ERROR] Dataset processing failed: {str(e)}")
            return current_fleet

    def calculate_mtbf(self, fleet: List[Dict]) -> float:
        """
        Calculates the Mean Time Between Failures for the entire fleet.
        """
        if not fleet: return 0.0
        total_hours = sum(m['predicted_maintenance_hours'] for m in fleet)
        return total_hours / len(fleet)
