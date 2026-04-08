import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface MachineData {
  machine_id: string;
  description: string;
  status: string;
  last_run_start: string | null;
  last_stop_time: string | null;
  last_maintenance_time: string | null;
  maintenance: {
    predicted_next_date: string;
    prediction_date: string;
    hours_remaining: number;
    failure_probability: {
      "24h": number;
      "48h": number;
      "7d": number;
    };
    confidence_score: number;
    color_code: string;
    urgency_reason: string;
    critical_failure?: {
      shift: number;
      confidence: number;
      estimated_day_offset: number;
      estimated_timestamp: string;
    };
    next_shift_probability?: number;
    weekly_predictions?: {
      day: number;
      shift: number;
      probability: number;
      predicted_class: number;
      EfficiencySpindle?: number;
      Productionkg_per_min?: number;
      Endsdown?: number;
      running?: number;
    }[];
  };
  performance: {
    efficiency_pct: number;
    endsdown_count: number;
    production_kg: number;
  };
  recommended_action: string;
  metadata?: Record<string, any>;
}

export interface IndustrialState {
  last_updated: string;
  data_gap_hours: number;
  app_info: {
    version: string;
    edition: string;
    license_status: string;
    is_activated: boolean;
    test_mode_expiry_date: string;
    days_remaining_in_test: number;
  };
  settings: {
    refresh_interval_minutes: number;
    memory_limit_mb: number;
    default_maintenance_horizon_hours: number;
    critical_threshold_hours: number;
    prediction_interval_weeks: number;
    maintenance_capacity: {
      shift1: number;
      shift2: number;
      shift3: number;
    };
    spider_web_active: boolean;
    urgency_thresholds: {
      critical: number;
      warning: number;
      healthy: number;
    };
    saturation_horizon_days: number;
    database_settings?: {
      db_type: string;
      host: string;
      port?: number;
      database?: string | null;
      namespace?: string | null;
      username: string;
      password: string;
      update_interval: number;
      spider_web_active: boolean;
      selected_tables: string[];
      last_sync_timestamp?: string;
    };
    prediction_horizon_days: number;
  };
  global_stats: {
    total_machines: number;
    machines_at_risk: number;
    average_efficiency: number;
    fleet_integrity_score: number;
  };
  machines_data: MachineData[];
  recommendations: {
    urgent_machines_top_5: string[];
    system_recommendations: string;
    maintenance_summary: string;
  };
  notifications: {
    id: string;
    type: string;
    message: string;
    timestamp: string;
    read: boolean;
  }[];
  is_processing: boolean;
  manual_upload_allowed: boolean;
  dataset_info?: {
    total_rows: number;
    total_shifts: number;
    first_date: string;
    last_date: string;
    total_days: number;
    machineCount?: number;
    entriesCount?: number;
  };
  model_performance?: {
    total_accuracy: number;
    f1_score: number;
    precision: number;
    recall: number;
    training_duration_sec?: number;
    best_iteration?: number;
  };
}

// ─── MODULE-LEVEL SINGLETON ──────────────────────────────────────────────────
// Single shared state for the entire app: one fetch loop, zero redundant polls.

type Listener = () => void;

const S = {
  state: null as IndustrialState | null,
  lastUiRead: null as string | null,
  isLoading: true,
  baseUrl: null as string | null,
  initialized: false,
  intervalHandle: 0 as unknown as ReturnType<typeof setInterval>,
};

// Boot from localStorage cache immediately — zero wait on second launch
try {
  const cached = localStorage.getItem('eagle_telemetry_cache');
  if (cached) {
    S.state = JSON.parse(cached);
    S.isLoading = false;
  }
} catch { /* ignore */ }

const listeners = new Set<Listener>();

function notify() {
  listeners.forEach(fn => fn());
}

async function doFetch() {
  if (!S.baseUrl) return;
  try {
    const [stateRes, machinesRes] = await Promise.all([
      fetch(`${S.baseUrl}/eagle/state`),
      fetch(`${S.baseUrl}/eagle/machines`),
    ]);
    const coreState = await stateRes.json();
    const machines = await machinesRes.json();
    S.state = { ...coreState, machines_data: Array.isArray(machines) ? machines : [] };
    S.lastUiRead = new Date().toISOString();
    try { localStorage.setItem('eagle_telemetry_cache', JSON.stringify(S.state)); } catch { /* quota */ }
  } catch (err) {
    console.error('[IndustrialBridge] Fetch failed:', err);
  } finally {
    S.isLoading = false;
    notify();
  }
}

function initSingleton(port: number) {
  if (S.initialized) return;
  S.initialized = true;
  S.baseUrl = `http://127.0.0.1:${port}`;
  doFetch();
  // Background refresh every 5 min — single global timer
  S.intervalHandle = setInterval(doFetch, 5 * 60 * 1000);
}

// Global eagle-refresh event support
window.addEventListener('eagle-refresh', () => doFetch());

// ─────────────────────────────────────────────────────────────────────────────

export function useIndustrialState() {
  const [, forceUpdate] = useState(0);

  // Subscribe to state changes
  useEffect(() => {
    const fn: Listener = () => forceUpdate(n => n + 1);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);

  // Initialize Tauri port — only the first mounting component does this
  useEffect(() => {
    if (S.initialized) return;
    invoke<number>('get_backend_port')
      .then(p => initSingleton(p))
      .catch(() => initSingleton(6789));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveState = useCallback(async (newState: IndustrialState) => {
    if (!S.baseUrl) return false;
    try {
      const res = await fetch(`${S.baseUrl}/eagle/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newState),
      });
      if (res.ok) {
        S.state = newState;
        notify();
        return true;
      }
      return false;
    } catch (err) {
      console.error('[IndustrialBridge] State Save Failed:', err);
      return false;
    }
  }, []);

  return {
    state: S.state,
    lastUiRead: S.lastUiRead,
    isLoading: S.isLoading,
    refetch: doFetch,
    saveState,
    baseUrl: S.baseUrl,
  };
}
