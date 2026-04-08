try:
    import pyodbc
    PYODBC_AVAILABLE = True
except ImportError:
    import logging
    logger = logging.getLogger(__name__)
    logger.warning("Industrial SQL Bridge (pyodbc) not initialized. Using local cache fallback.")
    PYODBC_AVAILABLE = False

import logging
import socket
import os
import pandas as pd
from typing import List, Dict, Any, Optional
import re

logger = logging.getLogger(__name__)

class DBConnector:
    available = PYODBC_AVAILABLE
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.db_type = config.get("db_type", "SQL Server")
        self.host = config.get("host", "localhost")
        self.port = config.get("port")
        self.database = config.get("database") or config.get("namespace")
        self.username = config.get("username")
        self.password = config.get("password")
        self.driver = self._get_driver()

    def _get_driver(self) -> str:
        if not self.available: return "DRIVER_NOT_FOUND"
        try:
            drivers = pyodbc.drivers()
            if self.db_type == "SQL Server":
                # Priority for ODBC Driver 17/18
                for d in ["ODBC Driver 18 for SQL Server", "ODBC Driver 17 for SQL Server", "SQL Server"]:
                    if d in drivers: return d
            elif self.db_type == "IRIS":
                for d in ["InterSystems IRIS ODBC", "InterSystems ODBC"]:
                    if d in drivers: return d
            return drivers[0] if drivers else "SQL Server"
        except Exception as e:
            logger.error(f"Failed to list drivers: {e}")
            return "SQL Server"

    def get_connection_string(self) -> str:
        if self.db_type == "SQL Server":
            # Handle port if specified in host or separate
            server = self.host
            if self.port and ":" not in server:
                server = f"{server},{self.port}"
            return f"DRIVER={{{self.driver}}};SERVER={server};DATABASE={self.database};UID={self.username};PWD={self.password}"
        else: # IRIS
            return f"DRIVER={{{self.driver}}};SERVER={self.host};PORT={self.port or 1972};NAMESPACE={self.database};UID={self.username};PWD={self.password}"

    def test(self) -> Dict[str, Any]:
        if not self.available:
            return {"status": "error", "message": "System ODBC module not found. Please install unixodbc/libodbc on the server."}
        try:
            conn_str = self.get_connection_string()
            logger.info(f"Testing connection to {self.db_type} at {self.host}")
            # Never log the full connection string as it contains the password
            conn = pyodbc.connect(conn_str, timeout=5)
            conn.close()
            return {"status": "success", "message": "Neural bridge established successfully."}
        except Exception as e:
            logger.error(f"Connection test failed: {e}")
            return {"status": "error", "message": str(e)}

    def discover_tables(self) -> List[str]:
        if not self.available: return []
        try:
            conn = pyodbc.connect(self.get_connection_string(), timeout=5)
            cursor = conn.cursor()
            
            # Fetch all tables marked as 'TABLE'
            all_tables = [t.table_name for t in cursor.tables(tableType='TABLE')]
            
            # Filter out system tables and temporary objects
            # Common patterns to exclude: sys.%, INFORMATION_SCHEMA.%, temp%, i7% (IRIS)
            filtered = []
            excluded_prefixes = ['sys.', 'INFORMATION_SCHEMA.', 'temp', 'MSsys', 'dtproperties']
            
            for table in all_tables:
                if any(table.lower().startswith(p.lower()) for p in excluded_prefixes):
                    continue
                if self.db_type == 'IRIS' and (table.startswith('%') or 'Cube' in table):
                    continue
                filtered.append(table)
                
            conn.close()
            return sorted(list(set(filtered)))
        except Exception as e:
            logger.error(f"Table discovery failed: {e}")
            return []

    def fetch_data(self, table_name: str, last_sync_time: Optional[str] = None) -> List[Dict[str, Any]]:
        if not self.available: return []
        # Security: Sanitize table name
        if not re.match(r'^[a-zA-Z0-9_.]+$', table_name):
            logger.error(f"Invalid table name provided: {table_name}")
            return []
            
        try:
            conn = pyodbc.connect(self.get_connection_string(), timeout=10)
            cursor = conn.cursor()
            
            query = f"SELECT * FROM {table_name}"
            if last_sync_time:
                # Assuming 'Timestamp' column for simplicity, can be dynamic
                query += f" WHERE Timestamp > '{last_sync_time}'"
            
            query += " ORDER BY Timestamp ASC" 
            
            cursor.execute(query)
            columns = [column[0] for column in cursor.description]
            results = []
            for row in cursor.fetchall():
                results.append(dict(zip(columns, row)))
            
            conn.close()
            return results
        except Exception as e:
            logger.error(f"Data fetch failed for {table_name}: {e}")
            return []

    @classmethod
    def autofind_hosts(cls) -> List[str]:
        """Discovery for Rieter/Textile industrial hosts."""
        potential = ["localhost", "127.0.0.1", "RIETER_SRV", "RIETER_DB", "TEXTILE_SQL", "SPINNING_DATA", "PROD_DB"]
        
        # Try to resolve or ping these hosts (simple socket check)
        found = []
        for host in potential:
            try:
                # Check for port 1433 (default SQL Server)
                with socket.create_connection((host, 1433), timeout=0.1):
                    found.append(host)
            except:
                continue
        return found if found else ["localhost"]

    def autofind_table(self, reference_csv_path: str) -> List[Dict[str, Any]]:
        """Matches database tables against the structure of a reference CSV file."""
        if not self.available or not os.path.exists(reference_csv_path):
            return []
            
        try:
            # 1. Get reference headers
            ref_df = pd.read_csv(reference_csv_path, nrows=0)
            ref_headers = set(col.strip().lower() for col in ref_df.columns)
            
            # 2. Discover all tables
            tables = self.discover_tables()
            matches = []
            
            conn = pyodbc.connect(self.get_connection_string(), timeout=5)
            cursor = conn.cursor()
            
            for table in tables:
                try:
                    # Sanitize
                    if not re.match(r'^[a-zA-Z0-9_.]+$', table): continue
                    
                    # Fetch headers only
                    cursor.execute(f"SELECT TOP 0 * FROM {table}")
                    db_headers = [col[0].strip().lower() for col in cursor.description]
                    
                    # Calculate overlap
                    overlap = ref_headers.intersection(set(db_headers))
                    score = len(overlap) / len(ref_headers) if ref_headers else 0
                    
                    if score > 0.1: # Threshold for potential match
                        matches.append({
                            "table_name": table,
                            "match_score": round(score * 100, 2),
                            "matched_columns": list(overlap),
                            "total_columns": len(db_headers)
                        })
                except:
                    continue
            
            conn.close()
            # Sort by highest score
            return sorted(matches, key=lambda x: x["match_score"], reverse=True)
            
        except Exception as e:
            logger.error(f"Autofind table failed: {e}")
            return []
