import { useState, useMemo, useEffect } from 'react';
import { Calendar, Clock, AlertTriangle, CheckCircle2, Play, Square, Zap, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { useIndustrialState } from '@/hooks/useIndustrialState';
import { cn } from '@/lib/utils';

interface MaintenanceMachine {
  id: string;
  status: string;
  efficiency: number;
  production: number;
  endsdown: number;
  predicted_maintenance_hours: number;
  last_maintained_at: string | null;
  started_at: string | null;
  stopped_at: string | null;
  prediction_date: string | null;
  estimated_timestamp: string | null;
  weekly_predictions?: {
    day: number;
    shift: number;
    probability: number;
    predicted_class: number;
  }[];
}

export default function Maintenance() {
  const { state, refetch, baseUrl } = useIndustrialState();
  const [sessionId] = useState(() => localStorage.getItem('eagle_session_id') || uuidv4());
  const [pendingAction, setPendingAction] = useState<{ id: string; action: string } | null>(null);
  const [maintDate, setMaintDate] = useState({
    day: new Date().getDate(),
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    hour: new Date().getHours(),
    minute: new Date().getMinutes()
  });
  const [maintShift, setMaintShift] = useState(1);
  const [selectedDayTab, setSelectedDayTab] = useState(1); // 1-10

  // Model-Driven Shift Status (Revised for XGBoost Probabilities)
  const getShiftRiskStatus = (machine: MaintenanceMachine, dayNum: number, shiftIdx: number) => {
    const shift = machine.weekly_predictions?.find(s => s.day === dayNum && s.shift === (shiftIdx + 1));
    if (!shift) return 0;
    
    const thresholds = state?.settings?.urgency_thresholds || { critical: 30, healthy: 85 };
    const p = shift.probability * 100;
    
    if (p <= (thresholds.critical || 30)) return 3; // Critical
    if (p >= (thresholds.healthy || 85)) return 0;  // Healthy
    
    // Warning gradient
    const range = (thresholds.healthy || 85) - (thresholds.critical || 30);
    const pos = (p - (thresholds.critical || 30)) / range;
    if (pos < 0.4) return 2; // High Risk Area
    return 1; // Warning Area
  };

  // Generate 10-day roadmap based on last update
  const dayTabs = useMemo(() => {
    const refDateStr = state?.dataset_info?.last_date;
    if (!refDateStr) return [];
    
    const base = new Date(refDateStr);
    const days = [];
    for (let i = 1; i <= 10; i++) {
       const d = new Date(base);
       d.setDate(base.getDate() + i); // Start from last_date + 1
       days.push({
         dayNum: i,
         date: d,
         label: `Day ${i}`,
         shortDate: d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' }),
         dayName: d.toLocaleDateString(undefined, { weekday: 'short' }),
         isToday: d.toDateString() === new Date().toDateString()
       });
    }
    return days;
  }, [state]);

  // Smart Autoselect: Highlight today if in range, else select the last predicted day
  useEffect(() => {
    if (dayTabs.length > 0) {
      const todayIdx = dayTabs.findIndex(d => d.isToday);
      if (todayIdx !== -1) {
        setSelectedDayTab(dayTabs[todayIdx].dayNum);
      } else {
        // Fallback to the last predicted day if today is outside the window
        setSelectedDayTab(dayTabs[dayTabs.length - 1].dayNum);
      }
    }
  }, [dayTabs]);

  const allMachines: MaintenanceMachine[] = useMemo(() => {
    if (!state?.machines_data) return [];
    return state.machines_data
      .map(m => ({
        id: m.machine_id,
        status: m.status,
        efficiency: m.performance?.efficiency_pct || 0,
        production: m.performance?.production_kg || 0,
        endsdown: m.performance?.endsdown_count || 0,
        predicted_maintenance_hours: m.maintenance?.hours_remaining || 0,
        last_maintained_at: m.last_maintenance_time || null,
        started_at: m.last_run_start || null,
        stopped_at: m.last_stop_time || null,
        prediction_date: m.maintenance?.prediction_date || null,
        estimated_timestamp: m.maintenance?.critical_failure?.estimated_timestamp || null,
        weekly_predictions: m.maintenance?.weekly_predictions || []
      })).sort((a, b) => {
        // Critical First: lowest probability for current selected day across all shifts
        const getMinProb = (m: MaintenanceMachine) => {
          const dayPreds = m.weekly_predictions?.filter(p => p.day === selectedDayTab) || [];
          if (dayPreds.length === 0) return 1.0;
          return Math.min(...dayPreds.map(p => p.probability));
        };
        const probA = getMinProb(a);
        const probB = getMinProb(b);
        if (probA !== probB) return probA - probB; // Ascending: Lowest chance of running first
        return a.id.localeCompare(b.id);
      });
  }, [state, selectedDayTab]);

  const shiftLoads = useMemo(() => {
    const loads = [0, 0, 0];
    allMachines.forEach(m => {
      if (getShiftRiskStatus(m, selectedDayTab, 0) >= 1) loads[0]++;
      if (getShiftRiskStatus(m, selectedDayTab, 1) >= 1) loads[1]++;
      if (getShiftRiskStatus(m, selectedDayTab, 2) >= 1) loads[2]++;
    });
    return loads;
  }, [allMachines, selectedDayTab]);

  const capacities = state?.settings?.maintenance_capacity || { shift1: 5, shift2: 5, shift3: 5 };
  
  const saturatedDaysList = useMemo(() => {
    const days = [];
    const horizon = state?.settings?.saturation_horizon_days || 10;
    for (let dIdx = 1; dIdx <= horizon; dIdx++) {
      const loads = [0, 0, 0];
      allMachines.forEach(m => {
        if (getShiftRiskStatus(m, dIdx, 0) >= 1) loads[0]++;
        if (getShiftRiskStatus(m, dIdx, 1) >= 1) loads[1]++;
        if (getShiftRiskStatus(m, dIdx, 2) >= 1) loads[2]++;
      });
      if (loads[0] > (capacities.shift1 || 5) || 
          loads[1] > (capacities.shift2 || 5) || 
          loads[2] > (capacities.shift3 || 5)) {
        days.push(dIdx);
      }
    }
    return days;
  }, [allMachines, capacities, state?.settings?.saturation_horizon_days]);

  const hasOverCapacity = saturatedDaysList.length > 0;
  const overCapacityShifts = shiftLoads.map((load, idx) => load > (capacities[`shift${idx+1}` as keyof typeof capacities] || 5));

  const handleAction = (id: string, action: string) => {
    const now = new Date();
    setMaintDate({
      day: now.getDate(),
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      hour: now.getHours(),
      minute: now.getMinutes()
    });
    setPendingAction({ id, action });
  };

  // --- STATS CALCULATION: Normalized for current shift ---
  const dayStats = useMemo(() => {
    const hour = new Date().getHours();
    const currentShiftIdx = hour < 6 || hour >= 22 ? 2 : hour < 14 ? 0 : 1;
    
    const stats = {
      healthy: { count: 0, pct: 0 },
      warning: { count: 0, pct: 0 },
      alert: { count: 0, pct: 0 },
      critical: { count: 0, pct: 0 },
      total: allMachines.length,
      shiftNum: currentShiftIdx + 1
    };
    
    if (stats.total === 0) return stats;

    allMachines.forEach(m => {
       const sev = getShiftRiskStatus(m, selectedDayTab, currentShiftIdx);
       if (sev === 3) stats.critical.count++;
       else if (sev === 2) stats.alert.count++;
       else if (sev === 1) stats.warning.count++;
       else stats.healthy.count++;
    });

    stats.healthy.pct = parseFloat(((stats.healthy.count / stats.total) * 100).toFixed(2));
    stats.warning.pct = parseFloat(((stats.warning.count / stats.total) * 100).toFixed(2));
    stats.alert.pct = parseFloat(((stats.alert.count / stats.total) * 100).toFixed(2));
    stats.critical.pct = parseFloat(((stats.critical.count / stats.total) * 100).toFixed(2));
    
    return stats;
  }, [allMachines, selectedDayTab]);

  const confirmAction = async () => {
    if (!pendingAction || !baseUrl) return;
    try {
      const timeStr = `${String(maintDate.hour).padStart(2, '0')}:${String(maintDate.minute).padStart(2, '0')}`;
      await fetch(`${baseUrl}/eagle/machine/status`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Session-ID': sessionId 
        },
        body: JSON.stringify({
          machine_id: pendingAction.id,
          status: pendingAction.action,
          day: maintDate.day,
          month: maintDate.month,
          year: maintDate.year,
          time: timeStr,
          shift: maintShift
        })
      });
      refetch();
      setPendingAction(null);
    } catch (err) {
      console.error(err);
    }
  };

  if (!state || !baseUrl) {
    return (
      <div className="flex h-screen items-center justify-center bg-background/50 backdrop-blur-xl -mt-20">
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

  const renderProbabilityCell = (machine: MaintenanceMachine, dayNum: number, shiftIdx: number) => {
    const shift = machine.weekly_predictions?.find(s => s.day === dayNum && s.shift === (shiftIdx + 1));
    if (!shift) return <span className="text-[10px] font-black opacity-10">---</span>;
    
    const p = shift.probability;
    const sev = getShiftRiskStatus(machine, dayNum, shiftIdx);
    
    let colorClass = "text-emerald-500 bg-emerald-500/5 border-emerald-500/20";
    if (sev === 3) colorClass = "text-rose-500 bg-rose-500/10 border-rose-500/30 animate-pulse";
    else if (sev === 2) colorClass = "text-orange-500 bg-orange-500/5 border-orange-500/20";
    else if (sev === 1) colorClass = "text-yellow-500 bg-yellow-500/5 border-yellow-500/20";
    else if (machine.status === 'Stopped') colorClass = "text-muted-foreground opacity-40 bg-secondary/5 border-border/20";

    return (
      <div className={cn("px-3 py-1.5 rounded-xl border font-black tabular-nums text-[11px] transition-all", colorClass)}>
        {(p * 100).toFixed(2)}%
      </div>
    );
  };

  return (
    <div className="p-8 space-y-8 pb-32 max-w-6xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-sm font-black tracking-[0.4em] text-muted-foreground uppercase opacity-80">
          PROACTIVE FLEET MAINTENANCE SCHEDULE
        </h1>
        <div className="h-1 w-32 bg-primary rounded-full mt-1" />
      </div>

      <AnimatePresence>
        {pendingAction && (
          <div className="fixed inset-0 z-[100] bg-background/40 backdrop-blur-md flex items-center justify-center p-6">
            <motion.div 
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               className="bg-card border-2 border-border p-10 rounded-[3rem] shadow-2xl max-w-md w-full space-y-6"
            >
               <div className="text-center space-y-2">
                 <h2 className="text-2xl font-black uppercase tracking-tight">Confirm Event Log</h2>
                 <p className="text-[10px] font-bold text-muted-foreground uppercase">Setting {pendingAction.action} for {pendingAction.id}</p>
               </div>

               <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                   <div className="space-y-1">
                     <label className="text-[8px] font-black uppercase text-muted-foreground ml-1">Day</label>
                     <select 
                       value={maintDate.day}
                       onChange={(e) => setMaintDate({...maintDate, day: parseInt(e.target.value)})}
                       className="bg-secondary border border-border rounded-xl px-4 py-3 text-xs font-black w-full"
                     >
                       {[...Array(31)].map((_, i) => <option key={i+1} value={i+1}>{String(i+1).padStart(2, '0')}</option>)}
                     </select>
                   </div>
                   <div className="space-y-1">
                     <label className="text-[8px] font-black uppercase text-muted-foreground ml-1">Month</label>
                     <select 
                       value={maintDate.month}
                       onChange={(e) => setMaintDate({...maintDate, month: parseInt(e.target.value)})}
                       className="bg-secondary border border-border rounded-xl px-4 py-3 text-xs font-black w-full"
                     >
                       {[...Array(12)].map((_, i) => <option key={i+1} value={i+1}>{new Date(2000, i).toLocaleString('default', { month: 'short' })}</option>)}
                     </select>
                   </div>
                   <div className="space-y-1">
                     <label className="text-[8px] font-black uppercase text-muted-foreground ml-1">Year</label>
                     <select 
                       value={maintDate.year}
                       onChange={(e) => setMaintDate({...maintDate, year: parseInt(e.target.value)})}
                       className="bg-secondary border border-border rounded-xl px-4 py-3 text-xs font-black w-full"
                     >
                       {[2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
                     </select>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                   <div className="space-y-1">
                     <label className="text-[8px] font-black uppercase text-muted-foreground ml-1">Hour (0-23)</label>
                     <select 
                       value={maintDate.hour}
                       onChange={(e) => setMaintDate({...maintDate, hour: parseInt(e.target.value)})}
                       className="bg-secondary border border-border rounded-xl px-4 py-3 text-xs font-black w-full"
                     >
                       {[...Array(24)].map((_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}</option>)}
                     </select>
                   </div>
                   <div className="space-y-1">
                     <label className="text-[8px] font-black uppercase text-muted-foreground ml-1">Minute (0-59)</label>
                     <select 
                       value={maintDate.minute}
                       onChange={(e) => setMaintDate({...maintDate, minute: parseInt(e.target.value)})}
                       className="bg-secondary border border-border rounded-xl px-4 py-3 text-xs font-black w-full"
                     >
                       {[...Array(60)].map((_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}</option>)}
                     </select>
                   </div>
                </div>

                <div className="space-y-1">
                   <label className="text-[8px] font-black uppercase text-muted-foreground ml-1">Execution Shift</label>
                   <select 
                     value={maintShift}
                     onChange={(e) => setMaintShift(parseInt(e.target.value))}
                     className="bg-secondary border border-border rounded-xl px-4 py-3 text-xs font-black w-full"
                   >
                     <option value={1}>Shift 1</option>
                     <option value={2}>Shift 2</option>
                     <option value={3}>Shift 3</option>
                   </select>
                </div>
               </div>

               <div className="flex gap-3 pt-4">
                 <button 
                    onClick={() => setPendingAction(null)}
                    className="flex-1 py-4 text-xs font-black uppercase tracking-widest border border-border rounded-2xl hover:bg-secondary transition-all"
                 >
                    Cancel
                 </button>
                 <button 
                    onClick={confirmAction}
                    className="flex-1 py-4 text-xs font-black uppercase tracking-widest bg-primary text-primary-foreground rounded-2xl shadow-xl active:scale-95 transition-all"
                 >
                    Log Event
                 </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Strategic Roadmap Disclosure */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="relative group overflow-hidden bg-emerald-500/5 border border-emerald-500/20 p-6 rounded-[2rem] flex items-center gap-6 shadow-sm"
        >
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <Zap className="h-32 w-32 text-emerald-500 rotate-12" />
          </div>
          <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 shrink-0">
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xs font-black uppercase tracking-widest text-emerald-500">G36 Fleet Integration</h3>
            <p className="text-[10px] text-muted-foreground font-bold leading-relaxed">
              Full station telemetry active. MC871-MC882 and synchronized MC870 unit reporting at 0.1s latency.
            </p>
          </div>
        </motion.div>

        {/* Capacity Warning Banner */}
        <AnimatePresence>
          {hasOverCapacity && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="relative group overflow-hidden bg-rose-500/5 border border-rose-500/30 p-6 rounded-[2rem] flex items-center gap-6 shadow-sm shadow-rose-500/5"
            >
              <div className="p-4 bg-rose-500/10 rounded-2xl border border-rose-500/20 shrink-0">
                <ShieldAlert className="h-6 w-6 text-rose-500" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-black uppercase tracking-widest text-rose-500">Resource Saturation Alert</h3>
                <p className="text-[10px] text-muted-foreground font-bold leading-relaxed">
                  Active maintenance load exceeds shift capacity for Road Days: <span className="text-rose-600 font-black">{saturatedDaysList.join(', ')}</span>. Recalibrate shift allocation immediately.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-emerald-500/5 border border-emerald-500/20 p-6 rounded-[2rem] space-y-3">
          <div className="flex items-center justify-between">
             <span className="text-[10px] font-black uppercase text-emerald-500 tracking-widest">Shift {dayStats.shiftNum} Healthy</span>
             <span className="text-xl font-black text-emerald-500">{dayStats.healthy.pct}%</span>
          </div>
          <div className="h-2 w-full bg-emerald-500/10 rounded-full overflow-hidden">
             <motion.div initial={{ width: 0 }} animate={{ width: `${dayStats.healthy.pct}%` }} className="h-full bg-emerald-500" />
          </div>
          <div className="text-[9px] font-bold text-muted-foreground uppercase opacity-60">{dayStats.healthy.count} Units</div>
        </div>

        <div className="bg-yellow-500/5 border border-yellow-500/20 p-6 rounded-[2rem] space-y-3">
          <div className="flex items-center justify-between">
             <span className="text-[10px] font-black uppercase text-yellow-500 tracking-widest">Shift {dayStats.shiftNum} Warning</span>
             <span className="text-xl font-black text-yellow-500">{dayStats.warning.pct}%</span>
          </div>
          <div className="h-2 w-full bg-yellow-500/10 rounded-full overflow-hidden">
             <motion.div initial={{ width: 0 }} animate={{ width: `${dayStats.warning.pct}%` }} className="h-full bg-yellow-500" />
          </div>
          <div className="text-[9px] font-bold text-muted-foreground uppercase opacity-60">{dayStats.warning.count} Units</div>
        </div>

        <div className="bg-orange-500/5 border border-orange-500/20 p-6 rounded-[2rem] space-y-3">
          <div className="flex items-center justify-between">
             <span className="text-[10px] font-black uppercase text-orange-500 tracking-widest">Shift {dayStats.shiftNum} Alert</span>
             <span className="text-xl font-black text-orange-500">{dayStats.alert.pct}%</span>
          </div>
          <div className="h-2 w-full bg-orange-500/10 rounded-full overflow-hidden">
             <motion.div initial={{ width: 0 }} animate={{ width: `${dayStats.alert.pct}%` }} className="h-full bg-orange-500" />
          </div>
          <div className="text-[9px] font-bold text-muted-foreground uppercase opacity-60">{dayStats.alert.count} Units</div>
        </div>

        <div className="bg-rose-500/5 border border-rose-500/20 p-6 rounded-[2rem] space-y-3">
          <div className="flex items-center justify-between">
             <span className="text-[10px] font-black uppercase text-rose-500 tracking-widest">Shift {dayStats.shiftNum} Critical</span>
             <span className="text-xl font-black text-rose-500">{dayStats.critical.pct}%</span>
          </div>
          <div className="h-2 w-full bg-rose-500/10 rounded-full overflow-hidden">
             <motion.div initial={{ width: 0 }} animate={{ width: `${dayStats.critical.pct}%` }} className="h-full bg-rose-500" />
          </div>
          <div className="text-[9px] font-bold text-muted-foreground uppercase opacity-60">{dayStats.critical.count} Units</div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Day Navigation Tabs (10 Day Horizon) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 h-fit scrollbar-hide">
          {dayTabs.map((day, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedDayTab(day.dayNum)}
              className={cn(
                "flex-1 min-w-[110px] flex flex-col items-center gap-1 p-4 rounded-[1.5rem] border-2 transition-all relative",
                selectedDayTab === day.dayNum 
                  ? "bg-card border-primary shadow-lg scale-[1.02]" 
                  : "bg-secondary/20 border-transparent hover:border-primary/20"
              )}
            >
              <span className={cn("text-[9px] font-black uppercase tracking-wider", selectedDayTab === day.dayNum ? "text-primary" : "text-muted-foreground opacity-40")}>
                {day.dayName}
              </span>
              <span className="text-sm font-black tracking-tighter">
                {day.shortDate}
              </span>
              {day.isToday && <div className="absolute -top-1 right-2 bg-primary text-[7px] font-black text-white px-2 py-0.5 rounded-full uppercase tracking-tighter">Live</div>}
            </button>
          ))}
        </div>

        <div className="bg-card border border-border rounded-[2.5rem] overflow-hidden shadow-sm">
          <div className="p-8 border-b border-border bg-secondary/10 flex items-center justify-between gap-8 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-2xl border border-primary/10">
                  <Calendar className="h-6 w-6 text-primary" />
              </div>
              <div className="flex flex-col">
                  <h2 className="text-2xl font-black uppercase tracking-tighter leading-none">
                    MAINTENANCE ROADMAP — {dayTabs.find(d => d.dayNum === selectedDayTab)?.date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                  </h2>
                  <span className="text-[9px] font-bold text-muted-foreground uppercase opacity-40 mt-1">
                      Synchronized telemetry for Road Day {selectedDayTab} Forecast Window
                  </span>
              </div>
            </div>

            <div className="flex items-center gap-6 flex-1 max-w-xl">
               {[1, 2, 3].map(s => {
                  const load = shiftLoads[s-1];
                  const cap = (capacities[`shift${s}` as keyof typeof capacities] || 5);
                  const pct = Math.min(100, (load / cap) * 100);
                  const isOver = load > cap;

                  return (
                    <div key={s} className="flex-1 space-y-1.5 min-w-[120px]">
                       <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-tighter">
                          <span className={isOver ? "text-rose-500" : "text-muted-foreground"}>Shift {s} Load</span>
                          <span className={isOver ? "text-rose-600" : "text-primary"}>{load} / {cap}</span>
                       </div>
                       <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                          <div 
                             className={cn("h-full transition-all duration-500", isOver ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]" : "bg-primary")} 
                             style={{ width: `${pct}%` }} 
                          />
                       </div>
                    </div>
                  );
               })}
            </div>
          </div>

          <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-left border-collapse relative">
              <thead className="sticky top-0 z-20 bg-card">
                <tr className="bg-secondary/5 border-b border-border">
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Machine ID</th>
                  {[1, 2, 3].map(s => (
                    <th key={s} className={cn(
                      "px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-center transition-colors",
                      overCapacityShifts[s-1] ? "text-rose-500 bg-rose-500/5 animate-pulse" : "text-muted-foreground"
                    )}>
                      Shift {s} {s === 1 ? '(06-14)' : s === 2 ? '(14-22)' : '(22-06)'}
                      {overCapacityShifts[s-1] && <div className="text-[7px] font-black mt-1 text-rose-500/60 uppercase tracking-tighter">EXCEEDS CAPACITY</div>}
                    </th>
                  ))}
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Urgency</th>
                  <th className="px-8 py-5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {allMachines.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-8 py-20 text-center text-muted-foreground text-xs font-black uppercase">
                      No Fleet Data Synchronized
                    </td>
                  </tr>
                ) : allMachines.map((m) => {
                  const isStopped = m.status === 'Stopped';
                  const s1 = getShiftRiskStatus(m, selectedDayTab, 0);
                  const s2 = getShiftRiskStatus(m, selectedDayTab, 1);
                  const s3 = getShiftRiskStatus(m, selectedDayTab, 2);

                  return (
                    <tr 
                      key={m.id} 
                      className={cn(
                        "group transition-all duration-300",
                        isStopped ? "bg-gray-50/50 grayscale-[0.5]" : "hover:bg-secondary/10"
                      )}
                    >
                      <td className="px-8 py-6">
                        <div className="flex flex-col gap-1">
                            <span className="font-black text-lg tracking-tighter">{m.id}</span>
                            {m.estimated_timestamp ? (() => {
                              const faultDate = new Date(m.estimated_timestamp);
                              const isPast = faultDate < new Date();
                              const isStalled = isPast && (!m.last_maintained_at || new Date(m.last_maintained_at) < faultDate);
                              const shiftHour = faultDate.getHours();
                              const shiftLabel = shiftHour >= 6 && shiftHour < 14 ? 'Shift 1 · 06:00-14:00'
                                : shiftHour >= 14 && shiftHour < 22 ? 'Shift 2 · 14:00-22:00'
                                : 'Shift 3 · 22:00-06:00';
                              return (
                                <div className={cn(
                                  "flex flex-col gap-0.5 px-2.5 py-1.5 rounded-lg border",
                                  isStalled ? "bg-rose-500/10 border-rose-500/30" : "bg-amber-500/10 border-amber-500/20"
                                )}>
                                  <span className={cn("text-[8px] font-black uppercase tracking-widest", isStalled ? "text-rose-500" : "text-amber-500")}>
                                    {isStalled ? '⚠ MACHINE STALLED' : '⏱ PREDICTED FAULT'}
                                  </span>
                                  <span className={cn("text-[11px] font-black tabular-nums", isStalled ? "text-rose-600" : "text-amber-600")}>
                                    {faultDate.toLocaleDateString([], { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                                  </span>
                                  <span className="text-[8px] text-muted-foreground font-bold uppercase opacity-70">{shiftLabel}</span>
                                </div>
                              );
                            })() : (
                              <span className="text-[9px] font-bold uppercase text-emerald-500 opacity-60">No Failure Predicted</span>
                            )}
                        </div>
                      </td>
                      <td className="px-8 py-6 text-center flex items-center justify-center">
                        {renderProbabilityCell(m, selectedDayTab, 0)}
                      </td>
                      <td className="px-8 py-6 text-center">
                        <div className="flex items-center justify-center">
                          {renderProbabilityCell(m, selectedDayTab, 1)}
                        </div>
                      </td>
                      <td className="px-8 py-6 text-center">
                        <div className="flex items-center justify-center">
                          {renderProbabilityCell(m, selectedDayTab, 2)}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div 
                          className={cn(
                            "inline-flex items-center gap-2 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase border shadow-sm",
                            Math.max(s1, s2, s3) === 3 ? "bg-rose-500/10 text-rose-500 border-rose-500/20" :
                            Math.max(s1, s2, s3) === 2 ? "bg-orange-500/10 text-orange-500 border-orange-500/20" :
                            Math.max(s1, s2, s3) === 1 ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" :
                            "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                          )}
                        >
                          {Math.max(s1, s2, s3) === 3 ? <AlertTriangle className="h-3.5 w-3.5 italic" /> : Math.max(s1, s2, s3) === 2 ? <Clock className="h-3.5 w-3.5" /> : Math.max(s1, s2, s3) === 1 ? <Clock className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                          {Math.max(s1, s2, s3) === 3 ? 'Critical' : Math.max(s1, s2, s3) === 2 ? 'Alert' : Math.max(s1, s2, s3) === 1 ? 'Warning' : 'Healthy'}
                        </div>
                      </td>

                      <td className="px-8 py-6">
                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleAction(m.id, 'Maintained')}
                            className="w-full p-2 bg-primary/10 hover:bg-primary hover:text-white rounded-lg transition-all flex items-center justify-center gap-1.5 mb-0.5 border border-primary/20" title="Log Maintenance">
                            <Zap className="h-2.5 w-2.5" /> <span className="text-[8px] font-black uppercase">Maintain</span>
                          </button>
                          <button 
                            onClick={() => handleAction(m.id, m.status === 'Stopped' ? 'Running' : 'Stopped')}
                            className={cn(
                              "w-full p-2 rounded-lg transition-all border flex items-center justify-center gap-1.5",
                              m.status === 'Stopped' 
                                ? "bg-emerald-500/10 hover:bg-emerald-500 hover:text-white border-emerald-500/20" 
                                : "bg-rose-500/10 hover:bg-rose-500 hover:text-white border-rose-500/20"
                            )} 
                            title={m.status === 'Stopped' ? "Set Running" : "Set Stopped"}
                          >
                            {m.status === 'Stopped' ? <Play className="h-2.5 w-2.5" /> : <Square className="h-2.5 w-2.5" />}
                            <span className="text-[8px] font-black uppercase">{m.status === 'Stopped' ? 'Start' : 'Stop'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="text-center opacity-20 text-[10px] font-black uppercase tracking-[0.5em] pt-8">
        © Advanced Recommendation Engine — Core Phase v1.2
      </div>
    </div>
  );
}
