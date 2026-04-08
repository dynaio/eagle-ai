import { useState, useEffect, useMemo } from 'react';
import { Activity, AlertTriangle, Gauge, Zap, Scale, ShieldAlert, Database } from 'lucide-react';
import { motion } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { MachineCard } from '@/components/MachineCard';
import { useIndustrialState, MachineData } from '@/hooks/useIndustrialState';
import { cn } from '@/lib/utils';

function SyncStatusBar({ baseUrl }: { baseUrl: string }) {
  const [status, setStatus] = useState<any>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`${baseUrl}/database/status`);
        const data = await res.json();
        setStatus(data);
      } catch (err) {
        console.error("Failed to fetch sync status:", err);
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [baseUrl]);

  if (!status || !status.is_running) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 px-6 py-3 rounded-2xl mb-8"
    >
      <div className="flex items-center gap-4">
        <div className="relative">
          <Activity className={cn("h-4 w-4 text-emerald-500", status.sync_active && "animate-pulse")} />
          {status.sync_active && (
            <motion.div 
              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute inset-0 bg-emerald-500 rounded-full blur-sm"
            />
          )}
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase text-emerald-500 leading-none mb-1">Spider Web Live Sync Enabled</span>
          <span className="text-[9px] font-bold text-muted-foreground uppercase opacity-60">
            {status.sync_active ? "Neural Data Transfer in Progress..." : "Synchronized & Stable"}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-8">
        <div className="flex flex-col items-end">
          <span className="text-[9px] font-black text-muted-foreground uppercase opacity-40">Last Sync</span>
          <span className="text-[10px] font-black tabular-nums">{status.last_sync ? new Date(status.last_sync).toLocaleTimeString() : 'Pending'}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[9px] font-black text-muted-foreground uppercase opacity-40">Next Pulse</span>
          <span className="text-[10px] font-black tabular-nums">{status.next_sync ? new Date(status.next_sync).toLocaleTimeString() : 'N/A'}</span>
        </div>
      </div>
    </motion.div>
  );
}

export default function Dashboard() {
  const { state, lastUiRead, refetch, baseUrl } = useIndustrialState();
  const [gridCols, setGridCols] = useState(() => localStorage.getItem('eagle_cards_per_row') || '4');
  const [sessionId] = useState(() => localStorage.getItem('eagle_session_id') || uuidv4());


  const machines: MachineData[] = useMemo(() => {
    if (!state?.machines_data) return [];
    
    // Aligned with Maintenance Roadmap logic: Day 1 is last_date + 1
    const baseDateStr = state.dataset_info?.last_date;
    if (!baseDateStr) return state.machines_data;

    const baseDate = new Date(baseDateStr);
    baseDate.setHours(0,0,0,0);
    
    const now = new Date();
    now.setHours(0,0,0,0);
    
    // If today is March 31 and last_date is March 30, dayDiff is 1
    const dayDiff = Math.round((now.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // We only show predictions for Day 1-14. If out of range, show no predictions.
    if (dayDiff < 1 || dayDiff > 14) return [];

    return [...state.machines_data]
      .filter(m => {
        if (!m.maintenance?.weekly_predictions?.length) return false;
        // Filter strictly to current Roadmap Day (Today)
        return m.maintenance.weekly_predictions.some(p => p.day === dayDiff);
      })
      .sort((a, b) => {
        // Critical First: lowest probability for today is most critical
        const getTodayProb = (m: MachineData) => {
          const hour = new Date().getHours();
          const shiftNum = hour < 6 || hour >= 22 ? 3 : hour < 14 ? 1 : 2;
          return m.maintenance?.weekly_predictions?.find(p => p.day === dayDiff && p.shift === shiftNum)?.probability ?? 1.0;
        };
        const probA = getTodayProb(a);
        const probB = getTodayProb(b);
        if (probA !== probB) return probA - probB; // Ascending: Smaller Probability (Higher Risk) Comes First
        return a.machine_id.localeCompare(b.machine_id);
      });
  }, [state?.machines_data, state?.dataset_info?.last_date]);

  useEffect(() => {
    const handleStorage = () => setGridCols(localStorage.getItem('eagle_cards_per_row') || '4');
    window.addEventListener('eagle-refresh', refetch);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('eagle-refresh', refetch);
      window.removeEventListener('storage', handleStorage);
    };
  }, [refetch]);

  const handleStatusUpdate = async (machineId: string, status: string, timestamp?: string) => {
    if (!baseUrl) return;
    try {
      await fetch(`${baseUrl}/eagle/machine/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Session-ID': sessionId },
        body: JSON.stringify({
          machine_id: machineId,
          status,
          timestamp: timestamp || new Date().toISOString()
        })
      });
      refetch();
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const dashboardStats = useMemo(() => {
    if (!state) return { total: 0, atRisk: 0, avgEfficiency: 0, integrity: 100 };
    const criticalThresholdStr = state.settings?.urgency_thresholds?.critical ?? 30;
    const critLimit = parseFloat(criticalThresholdStr.toString()) / 100.0;
    const totalCount = machines.length || state.machines_data.length;
    
    // Any machine with probability <= Critical Threshold is at risk
    const atRiskCount = state.machines_data.filter(m => {
      const prob = m.maintenance?.next_shift_probability ?? 1.0;
      return prob <= critLimit;
    }).length;
    
    const avgEfficiency = (machines.length > 0) 
      ? machines.reduce((acc, m) => acc + (m.performance?.efficiency_pct || 0), 0) / machines.length 
      : 0;

    return {
      total: totalCount,
      atRisk: atRiskCount,
      avgEfficiency: avgEfficiency,
      integrity: state?.global_stats?.fleet_integrity_score || 100
    };
  }, [machines, state]);

  const horizonDays = state?.settings?.prediction_horizon_days || 10;
  const isDataStale = useMemo(() => {
    if (!state?.dataset_info?.last_date) return false;
    const lastDate = new Date(state.dataset_info.last_date);
    const now = new Date();
    const diffDays = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays > horizonDays;
  }, [state, horizonDays]);

  // Only block UI if we have no cached state at all
  if (!state) {
    return (
      <div className="flex h-full items-center justify-center bg-background/50 backdrop-blur-xl">
        <div className="flex flex-col items-center gap-6">
           <div className="h-20 w-20 relative flex items-center justify-center">
             <div className="absolute inset-0 rounded-full border-4 border-primary/10" />
             <div className="h-12 w-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin shadow-lg" />
             <div className="absolute -inset-4 bg-primary/5 blur-2xl rounded-full animate-pulse pointer-events-none" />
           </div>
           <div className="flex flex-col items-center gap-1">
             <span className="text-xs font-black uppercase tracking-[0.3em] text-primary">Initializing Neural Bridge</span>
             <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">Synchronizing G36 Station Cluster</span>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 pb-32">
      {/* Header Summary */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h1 className="text-sm font-black tracking-[0.4em] text-muted-foreground uppercase opacity-80">
            Predictive AI Multi-Machine Station — <span className="text-primary italic font-black">ST-Edition v1.3.1</span>
          </h1>
          <div className="flex flex-col items-end gap-1">
            <span className="text-[9px] font-bold text-muted-foreground uppercase opacity-40">
              Last Heartbeat: {lastUiRead ? new Date(lastUiRead).toLocaleTimeString() : 'N/A'}
            </span>
            {state?.dataset_info?.last_date && (
              <span className={cn(
                "text-[9px] font-black uppercase tracking-tighter px-2 py-0.5 rounded border",
                isDataStale ? "bg-rose-500/10 text-rose-500 border-rose-500/20" : "bg-primary/10 text-primary border-primary/20"
              )}>
                {isDataStale ? '⚠ FORECAST EXPIRED' : 'Predictive Horizon Reference'}: {new Date(state.dataset_info.last_date).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        <div className="h-1 w-32 bg-primary rounded-full mt-1" />
        
        {isDataStale ? (
          <div className="mt-3 flex items-center gap-4 px-6 py-4 bg-rose-500/10 border-2 border-rose-500/30 rounded-2xl animate-pulse">
            <AlertTriangle className="h-6 w-6 text-rose-500 shrink-0" />
            <div className="space-y-1">
              <h3 className="text-sm font-black text-rose-500 uppercase">Telemetry Horizon Exceeded</h3>
              <p className="text-[10px] font-bold text-muted-foreground uppercase leading-tight">
                Current platform time is outside the 10-day predictive roadmap. Please upload fresh machine telemetry from Spider Web to recalibrate.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-3 px-4 py-2 bg-primary/5 border border-primary/20 rounded-xl max-w-2xl">
            <ShieldAlert className="h-4 w-4 text-primary shrink-0" />
            <p className="text-[9px] font-bold text-muted-foreground uppercase leading-relaxed tracking-wider">
              <span className="text-primary">Strategic Disclaimer:</span> This interface provides roadmap predictions generated by the Neural Engine. It is a predictive forecast for maintenance planning and NOT a real-time fault sensor.
            </p>
          </div>
        )}
      </div>

      {baseUrl && <SyncStatusBar baseUrl={baseUrl} />}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <SummaryCard
          title="Total Units"
          value={dashboardStats.total.toString()}
          icon={Scale}
          color="text-blue-400"
        />
        <SummaryCard
          title="Critical Units"
          value={dashboardStats.atRisk.toString()}
          icon={AlertTriangle}
          color={dashboardStats.atRisk > 0 ? "text-rose-500" : "text-emerald-500"}
          trend={dashboardStats.atRisk > 0 ? "Fleet Integrity Dropping" : "Fleet Optimal"}
        />
        <SummaryCard
          title="Fleet Integrity"
          value={`${dashboardStats.integrity.toFixed(2)}%`}
          icon={Zap}
          color="text-orange-500"
        />
        <SummaryCard
          title="Avg Efficiency"
          value={`${dashboardStats.avgEfficiency.toFixed(2)}%`}
          icon={Gauge}
          color="text-emerald-500"
        />
      </div>

      {/* Machine Grid */}
      <div className="space-y-6 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" /> 
            {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' }).toUpperCase()} FLEET STATUS
          </h2>
          <div className="flex items-center gap-6 text-[10px] font-black text-muted-foreground uppercase tracking-widest bg-secondary/30 px-6 py-2 rounded-full border border-border/50">
            <span className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" /> Healthy</span>
            <span className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]" /> Warning</span>
            <span className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]" /> Alert</span>
            <span className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]" /> Critical</span>
          </div>
        </div>

        {isDataStale ? (
          <div className="py-24 text-center space-y-4 bg-secondary/10 rounded-[3rem] border-2 border-dashed border-border/50">
             <Database className="h-12 w-12 text-muted-foreground mx-auto opacity-20" />
             <div className="space-y-1">
               <h3 className="text-lg font-black uppercase opacity-40">Predictive Signal Lost</h3>
               <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Horizon synchronization failure — Recalibration required</p>
             </div>
          </div>
        ) : machines.length === 0 ? (
          <div className="py-24 text-center space-y-4 bg-secondary/10 rounded-[3rem] border-2 border-dashed border-border/50">
             <Database className="h-12 w-12 text-muted-foreground mx-auto opacity-20" />
             <div className="space-y-1">
               <h3 className="text-lg font-black uppercase opacity-40">No Predictions for Today</h3>
               <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Current day {new Date().toLocaleDateString()} is outside the forecast window.</p>
             </div>
          </div>
        ) : (
          <div className={cn(
            "grid gap-6",
            gridCols === '2' ? "grid-cols-1 sm:grid-cols-2" :
              gridCols === '3' ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" :
                  "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          )}>
            {machines.map((machine) => (
              <MachineCard
                key={machine.machine_id}
                machine={machine}
                maintenanceHorizon={state.settings.default_maintenance_horizon_hours}
                referenceDate={state.dataset_info?.last_date}
                onStatusUpdate={handleStatusUpdate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ title, value, icon: Icon, color, trend }: any) {
  return (
    <div className="bg-card border border-border p-6 rounded-2xl shadow-sm group overflow-hidden relative">
      <div className="absolute -bottom-4 -right-4 p-4 opacity-[0.03] group-hover:opacity-10 transition-opacity">
        <Icon className="h-24 w-24 scale-110 rotate-12" />
      </div>
      <div className="flex items-start justify-between relative z-10">
        <div>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1 opacity-60">{title}</p>
          <p className={cn("text-3xl font-black tracking-tighter", color)}>{value}</p>
          {trend && <p className="text-[10px] font-bold mt-2 opacity-70 uppercase leading-none">{trend}</p>}
        </div>
        <div className={cn("p-2 rounded-xl bg-secondary shadow-inner", color)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
