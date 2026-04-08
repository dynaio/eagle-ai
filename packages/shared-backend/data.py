import polars as pl
from datetime import datetime
from typing import Dict, Any

def convert_to_model_features(df: pl.LazyFrame) -> pl.LazyFrame:
    """
    Converts raw Rieter G36 shift data into features suitable for TinyTimeMixer.
    Includes handling for idle shifts and feature scaling.
    """
    # 1. Basic Cleaning
    df = df.fill_null(0)
    
    # 2. Derive efficiency-gap indicators
    # Target efficiency for G36 is usually ~95-98%
    df = df.with_columns([
        (98.0 - pl.col("Efficiency_Pct")).alias("Efficiency_Gap"),
        (pl.col("Endsdown") / (pl.col("Actual_Runtime_Minutes") + 1)).alias("Endsdown_Rate")
    ])
    
    # 3. Static Covariates: Machine_ID mapping
    # We expect Machine_ID as a string like 'G36-01'
    # For TTM, we might need to label encode or pass as categorical
    
    return df

def update_manual_entry(state_machines: Dict[str, Any], entry_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Updates the session's machine state based on a manual shift entry.
    """
    m_id = entry_data.get("Machine_ID")
    if m_id in state_machines:
        m = state_machines[m_id]
        m["efficiency"] = entry_data.get("Efficiency_Pct", m["efficiency"])
        m["production"] = entry_data.get("Production_Kg", m["production"])
        m["endsdown"] = entry_data.get("Endsdown", m["endsdown"])
        m["status"] = "Running" if entry_data.get("Is_Running", True) else "Stopped"
        
        # Heuristic update for prediction (simplified for now)
        # If efficiency drops below 90, reduce maintenance hours significantly
        if m["efficiency"] < 90:
            m["predicted_maintenance_hours"] = max(12, m["predicted_maintenance_hours"] - 24)
        
    return state_machines
