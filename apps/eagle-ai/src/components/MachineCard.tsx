import { Play, Square, Zap, Gauge, Calendar, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useMemo } from 'react';
import { useIndustrialState, type MachineData } from '@/hooks/useIndustrialState';

interface MachineCardProps {
  machine: MachineData;
  maintenanceHorizon: number;
  referenceDate?: string;
  onStatusUpdate: (id: string, status: string, timestamp?: string) => void;
}

// ────────────────────────────────────────────────────────────────────────────
// COLOR LOGIC (Front-end Only Filter)
// Aligned with User settings: Critical Threshold (e.g. 30%) and Healthy (e.g. 85%)
// ────────────────────────────────────────────────────────────────────────────

const getInterpolatedStatus = (prob: number, thresholds: { critical: number; healthy: number }) => {
  const p = prob * 100;
  const crit = thresholds.critical;
  const heal = thresholds.healthy;

  // 1. Critical Hard Limit
  if (p <= crit) return { 
    color: 'rgb(244 63 94)', 
    bg: 'rgba(244,63,94,0.1)', 
    border: 'rgba(244,63,94,0.2)',
    label: 'Critical'
  };

  // 2. Healthy Hard Limit
  if (p >= heal) return { 
    color: 'rgb(16 185 129)', 
    bg: 'rgba(16,185,129,0.1)', 
    border: 'rgba(16,185,129,0.2)',
    label: 'Optimal'
  };

  // 3. Risk Gradient (Yellow/Orange Zone)
  const range = heal - crit;
  const pos = (p - crit) / range;

  if (pos < 0.4) return { 
    color: 'rgb(249 115 22)', 
    bg: 'rgba(249,115,22,0.1)', 
    border: 'rgba(249,115,22,0.2)',
    label: 'High Risk'
  };
  
  return { 
    color: 'rgb(234 179 8)', 
    bg: 'rgba(234,179,8,0.1)', 
    border: 'rgba(234,179,8,0.2)',
    label: 'Warning'
  };
};

const SHIFT_LABEL: Record<number, string> = { 1: '06:00–14:00', 2: '14:00–22:00', 3: '22:00–06:00' };

export const MachineCard: React.FC<MachineCardProps> = ({ machine, maintenanceHorizon, referenceDate, onStatusUpdate }) => {
  const { state } = useIndustrialState();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [maintDate, setMaintDate] = useState({
    day: new Date().getDate(),
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    hour: new Date().getHours(),
    minute: new Date().getMinutes()
  });

  const isStopped = machine.status === 'Stopped';

  const currentShift = useMemo(() => {
    if (!machine.maintenance.weekly_predictions?.length) return null;
    
    // STRICT FIX: Use the passed referenceDate (dataset anchor) or fallback to machine's own info
    const baseDateStr = referenceDate || machine.maintenance.prediction_date;
    const baseDate = baseDateStr ? new Date(baseDateStr) : new Date();
    baseDate.setHours(0,0,0,0);
    
    const now = new Date();
    const nowDate = new Date(now);
    nowDate.setHours(0,0,0,0);
    
    // Aligned with Dashboard and Maintenance logic
    const dayDiff = Math.round((nowDate.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24));
    const hour = now.getHours();
    const shiftNum = hour < 6 || hour >= 22 ? 3 : hour < 14 ? 1 : 2;
    
    return machine.maintenance.weekly_predictions.find(s => s.day === dayDiff && s.shift === shiftNum) || null;
  }, [machine.maintenance.weekly_predictions, machine.maintenance.prediction_date, referenceDate]);

  const currentShiftNum = new Date().getHours() < 6 || new Date().getHours() >= 22 ? 3 : new Date().getHours() < 14 ? 1 : 2;
  const runningProb = currentShift?.probability ?? machine.maintenance.next_shift_probability ?? 1.0;
  
  // Default: critical=30, healthy=85
  const thresholds = state?.settings?.urgency_thresholds || { critical: 30, healthy: 85 };
  
  const statusInfo = getInterpolatedStatus(runningProb, {
    critical: parseInt(thresholds.critical?.toString() ?? '30'),
    healthy: parseInt(thresholds.healthy?.toString() ?? '85')
  });

  const isNotPredicted = !currentShift;
  const statusColor  = isStopped ? '#9ca3af' : isNotPredicted ? '#64748b' : statusInfo.color;
  const statusBg     = isStopped ? 'transparent' : isNotPredicted ? 'rgba(100,116,139,0.1)' : statusInfo.bg;
  const statusBorder = isStopped ? 'rgba(156,163,175,0.3)' : isNotPredicted ? 'rgba(100,116,139,0.2)' : statusInfo.border;
  
  // Re-derive flags for existing JSX logic
  const isCritical = !isStopped && statusInfo.label === 'Critical';
  const isAlert    = !isStopped && statusInfo.label === 'High Risk';

  const faultInfo = useMemo(() => {
    const cf = machine.maintenance.critical_failure;
    if (!cf?.estimated_timestamp) return null;
    const dt = new Date(cf.estimated_timestamp);
    const shiftNum = cf.shift ?? 1;
    return {
      date: dt,
      dateStr: dt.toLocaleDateString([], { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }),
      shiftNum,
      shiftTime: SHIFT_LABEL[shiftNum] ?? '06:00–14:00',
      confidence: cf.confidence ?? 0,
      isPast: dt < new Date(),
    };
  }, [machine.maintenance.critical_failure]);

  const handleAction = (status: string) => {
    const now = new Date();
    setMaintDate({
      day: now.getDate(),
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      hour: now.getHours(),
      minute: now.getMinutes()
    });
    setPendingAction(status);
  };

  const confirmAction = () => {
    if (pendingAction) {
      const timeStr = `${String(maintDate.hour).padStart(2, '0')}:${String(maintDate.minute).padStart(2, '0')}`;
      const timestampStr = `${maintDate.year}-${String(maintDate.month).padStart(2, '0')}-${String(maintDate.day).padStart(2, '0')} ${timeStr}`;
      onStatusUpdate(machine.machine_id, pendingAction, timestampStr);
      setPendingAction(null);
    }
  };

  return (
    <div
      className={cn(
        'bg-card border-2 border-border/40 rounded-[2.5rem] p-8 hover:border-primary/60 transition-all group shadow-[0_8px_40px_rgba(0,0,0,0.15)] hover:shadow-primary/10 relative overflow-hidden min-h-[440px] flex flex-col justify-between',
        isStopped && 'opacity-80 grayscale-[0.3]'
      )}
    >
      {/* Pending action overlay */}
      <AnimatePresence>
        {pendingAction && (
          <motion.div
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(8px)' }}
            exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            className="absolute inset-0 z-50 bg-background/80 flex flex-col items-center justify-center p-6 text-center"
          >
            <Calendar className="h-10 w-10 text-primary mb-2" />
            <h4 className="text-sm font-black uppercase tracking-widest mb-1">Set Event Time</h4>
            <p className="text-[10px] font-bold text-muted-foreground uppercase mb-4 italic">
              Log {pendingAction} for {machine.machine_id}
            </p>
            
            <div className="space-y-3 w-full mb-6">
               <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase text-muted-foreground">Day</label>
                    <select 
                      value={maintDate.day}
                      onChange={(e) => setMaintDate({...maintDate, day: parseInt(e.target.value)})}
                      className="bg-secondary border border-border/50 rounded-xl px-2 py-2 text-xs font-bold w-full"
                    >
                      {[...Array(31)].map((_, i) => <option key={i+1} value={i+1}>{String(i+1).padStart(2, '0')}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase text-muted-foreground">Month</label>
                    <select 
                      value={maintDate.month}
                      onChange={(e) => setMaintDate({...maintDate, month: parseInt(e.target.value)})}
                      className="bg-secondary border border-border/50 rounded-xl px-2 py-2 text-xs font-bold w-full"
                    >
                      {[...Array(12)].map((_, i) => <option key={i+1} value={i+1}>{new Date(2000, i).toLocaleString('default', { month: 'short' })}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase text-muted-foreground">Year</label>
                    <select 
                      value={maintDate.year}
                      onChange={(e) => setMaintDate({...maintDate, year: parseInt(e.target.value)})}
                      className="bg-secondary border border-border/50 rounded-xl px-2 py-2 text-xs font-bold w-full"
                    >
                      {[2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase text-muted-foreground">Hour</label>
                    <select 
                      value={maintDate.hour}
                      onChange={(e) => setMaintDate({...maintDate, hour: parseInt(e.target.value)})}
                      className="bg-secondary border border-border/50 rounded-xl px-2 py-2 text-xs font-bold w-full"
                    >
                      {[...Array(24)].map((_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase text-muted-foreground">Minute</label>
                    <select 
                      value={maintDate.minute}
                      onChange={(e) => setMaintDate({...maintDate, minute: parseInt(e.target.value)})}
                      className="bg-secondary border border-border/50 rounded-xl px-2 py-2 text-xs font-bold w-full"
                    >
                      {[...Array(60)].map((_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}</option>)}
                    </select>
                  </div>
               </div>
            </div>

            <div className="flex gap-2 w-full">
              <button
                onClick={() => setPendingAction(null)}
                className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest border border-border rounded-xl hover:bg-secondary transition-colors"
              >Cancel</button>
              <button
                onClick={confirmAction}
                className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest bg-primary text-primary-foreground rounded-xl shadow-lg active:scale-95 transition-all"
              >Confirm</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status bar (right edge) */}
      <div
        className={cn('absolute top-0 right-0 w-2.5 h-full transition-all duration-700', !isStopped && isCritical && 'animate-pulse')}
        style={{ backgroundColor: statusColor }}
      />

      {/* ── TOP: Machine ID + Status ── */}
      <div>
        <div className="flex justify-between items-start mb-6">
          <div className="space-y-1">
            <h3 className="font-black text-3xl tracking-tighter uppercase leading-none">{machine.machine_id}</h3>
            <div className="flex items-center gap-2">
              <div
                className={cn('h-2.5 w-2.5 rounded-full', !isStopped && isCritical && 'animate-pulse shadow-lg')}
                style={{ backgroundColor: statusColor, boxShadow: isStopped ? 'none' : `0 0 12px ${statusColor}` }}
              />
              <span className="text-xs font-black uppercase text-muted-foreground tracking-[0.2em]">{machine.status}</span>
            </div>
          </div>
          <div
            className="h-14 w-14 rounded-2xl flex items-center justify-center transition-all shadow-sm border"
            style={{ backgroundColor: statusBg, color: statusColor, borderColor: statusBorder }}
          >
            {isStopped ? <Square className="h-8 w-8 text-gray-400" /> : <Gauge className="h-8 w-8" />}
          </div>
        </div>

        {/* ── Performance Metrics (Predicted for Current Shift) ── */}
        <div className="grid grid-cols-2 gap-y-5 mb-6">
          <div className="flex flex-col">
            <span className="text-[9px] font-black opacity-40 uppercase tracking-widest mb-1">Efficiency</span>
            <span className="text-4xl font-black tracking-tighter tabular-nums">
              {isNotPredicted ? '---' : (currentShift?.EfficiencySpindle ?? machine.performance.efficiency_pct).toFixed(2)}%
            </span>
            <span className="text-[9px] font-bold text-muted-foreground mt-0.5">{isNotPredicted ? 'Outside Horizon' : 'Predicted Efficiency'}</span>
          </div>

          <div className="flex flex-col items-end text-right">
            <span className="text-[9px] font-black opacity-40 uppercase tracking-widest mb-1">Endsdown</span>
            <span className="text-4xl font-black tracking-tighter tabular-nums">
              {isNotPredicted ? '---' : Math.round(currentShift?.Endsdown ?? machine.performance.endsdown_count)}
            </span>
            <span className="text-[9px] font-bold text-muted-foreground mt-0.5">{isNotPredicted ? 'Signal Pending' : 'Forecasted Count'}</span>
          </div>

          <div className="flex flex-col">
            <span className="text-[9px] font-black opacity-40 uppercase tracking-widest mb-1">Production</span>
            <span className="text-2xl font-black tracking-tight tabular-nums">
              {isNotPredicted ? '---' : (currentShift?.Productionkg_per_min ?? machine.performance.production_kg).toFixed(2)}
            </span>
            <span className="text-[9px] font-bold text-muted-foreground mt-0.5">{isNotPredicted ? 'Recalibration Required' : 'kg / min (Predicted)'}</span>
          </div>

          {/* ── EXPECTED FAULT DATE ── */}
          {faultInfo ? (
            <div className="flex flex-col items-end text-right">
              <span className={cn(
                'text-[9px] font-black uppercase tracking-widest mb-1 flex items-center gap-1',
                faultInfo.isPast ? 'text-rose-500' : isCritical ? 'text-rose-500' : isAlert ? 'text-orange-500' : 'text-yellow-500'
              )}>
                <AlertTriangle className="h-3 w-3" />
                {faultInfo.isPast ? 'URGENT INTERVENTION' : 'FAULT DATE'}
              </span>
              <span className={cn(
                'text-xl font-black tracking-tight tabular-nums leading-tight',
                faultInfo.isPast ? 'text-rose-600' : isCritical ? 'text-rose-500' : isAlert ? 'text-orange-600' : 'text-yellow-600'
              )}>
                {new Date().toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
              <div className={cn(
                'mt-1 px-2 py-0.5 rounded border text-[8px] font-black uppercase',
                faultInfo.isPast ? 'bg-rose-500/10 border-rose-500/20 text-rose-500'
                  : isCritical ? 'bg-rose-500/10 border-rose-500/20 text-rose-500'
                  : isAlert ? 'bg-orange-500/10 border-orange-500/20 text-orange-600'
                  : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-600'
              )}>
                Forecast Target: Today
              </div>
              {faultInfo.isPast && (
                <div className="text-[7px] font-black text-rose-400 uppercase mt-1 tracking-tighter italic">
                  Critical since {faultInfo.dateStr}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-end text-right">
              <span className="text-[9px] font-black opacity-40 uppercase tracking-widest mb-1 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Fault Date
              </span>
              <span className="text-sm font-black text-emerald-500 opacity-70">No Failure</span>
              <span className="text-[9px] font-bold text-muted-foreground mt-0.5">Predicted</span>
            </div>
          )}
        </div>

        {/* ── Timeline row: running since / stopped / maintained ── */}
        <div className="mb-6 space-y-1.5 pt-4 border-t border-border/20">
          {machine.status === 'Running' && machine.last_run_start && (
            <div className="flex justify-between text-[9px] font-black opacity-60 uppercase tracking-wider">
              <span>Running Since</span>
              <span className="text-foreground">{new Date(machine.last_run_start).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
            </div>
          )}
          {isStopped && machine.last_stop_time && (
            <div className="flex justify-between text-[9px] font-black text-gray-500 uppercase tracking-wider">
              <span>Last Stopped</span>
              <span>{new Date(machine.last_stop_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
            </div>
          )}
          {machine.last_maintenance_time && (
            <div className="flex justify-between text-[9px] font-black opacity-40 uppercase tracking-wider">
              <span>Last Maint</span>
              <span>{new Date(machine.last_maintenance_time).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
            </div>
          )}
          {/* Running probability for current shift */}
          <div className="flex justify-between text-[9px] font-black uppercase tracking-wider">
            <span className="opacity-40">Run Probability</span>
            <span style={{ color: statusColor }}>{isNotPredicted ? 'N/A' : `${(runningProb * 100).toFixed(2)}%`}</span>
          </div>
        </div>
      </div>

      {/* ── BOTTOM: Forecast + Controls ── */}
      <div className="space-y-4">
        {machine.maintenance.weekly_predictions && machine.maintenance.weekly_predictions.length > 0 && (
          <div className="pt-4 border-t border-border/20">
            <ForecastSection 
              machineId={machine.machine_id} 
              predictions={machine.maintenance.weekly_predictions} 
              currentShiftNum={currentShiftNum}
              baseDateStr={referenceDate || machine.maintenance.prediction_date}
              settings={state?.settings}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleAction(isStopped ? 'Running' : 'Stopped')}
            className={cn(
              'py-5 rounded-[1.5rem] flex flex-col items-center justify-center gap-2 transition-all border text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 group/btn',
              isStopped 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500 hover:text-white' 
                : 'bg-rose-500/10 border-rose-500/30 text-rose-600 hover:bg-rose-500 hover:text-white'
            )}
          >
            {isStopped ? (
              <><Play className="h-5 w-5 animate-pulse" /> START MACHINE</>
            ) : (
              <><Square className="h-5 w-5" /> STOP MACHINE</>
            )}
          </button>
          
          <button
            onClick={() => handleAction('Maintained')}
            className="py-5 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-[1.5rem] flex flex-col items-center justify-center gap-2 transition-all border border-primary/30 text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95"
          >
            <Zap className="h-5 w-5" /> LOG MAINT
          </button>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between items-center px-1">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40">Cycle Wear</span>
            <span className={cn('text-[9px] font-black uppercase tracking-tighter', isCritical ? 'text-rose-500' : 'text-muted-foreground')}>
              {Math.round(Math.min(100, (1 - (machine.maintenance.hours_remaining / maintenanceHorizon)) * 100))}% Consumed
            </span>
          </div>
          <div className="w-full bg-border/20 h-2.5 rounded-full overflow-hidden border border-border/10">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (1 - (machine.maintenance.hours_remaining / maintenanceHorizon)) * 100)}%` }}
              transition={{ duration: 1.5, ease: 'easeOut' }}
              style={{
                backgroundColor: statusColor,
                boxShadow: isStopped ? 'none' : `0 0 10px ${statusColor}44`
              }}
              className="h-full rounded-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Inline Forecast Mini-Section ───────────────────────────────────────────
function ForecastSection({ machineId, predictions, currentShiftNum, baseDateStr, settings }: { machineId: string; predictions: any[]; currentShiftNum: number; baseDateStr: string; settings: any }) {
  const todayShifts = useMemo(() => {
    // Determine the absolute day offset for 'today' (consistent with parent logic)
    const baseDate = new Date(baseDateStr);
    baseDate.setHours(0,0,0,0);
    const now = new Date();
    const nowDate = new Date(now);
    nowDate.setHours(0,0,0,0);
    const dayDiff = Math.round((nowDate.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24));
    
    return predictions.filter(p => p.day === dayDiff);
  }, [predictions, baseDateStr]);

  if (todayShifts.length === 0) return (
     <div className="flex items-center justify-center p-4 bg-secondary/20 rounded-2xl border border-dashed border-border/50">
        <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Today's Roadmap Pending</span>
     </div>
  );

  return (
    <div className="space-y-3 mb-4 mt-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-primary">Today's Forecast</span>
        <span className="text-[8px] font-black opacity-30 uppercase tracking-widest italic">Industrial Day Cycle</span>
      </div>

      {/* Shift cells for today only */}
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3].map(sNum => {
          const sData = todayShifts.find((s: any) => s.shift === sNum);
          const isActive = sNum === currentShiftNum;
          
          if (!sData) return (
            <div key={sNum} className="p-3 rounded-2xl border border-border/10 bg-secondary/10 flex flex-col items-center justify-center gap-0.5 opacity-20">
               <span className="text-[8px] font-bold opacity-60 uppercase">Sh {sNum}</span>
               <div className="h-1 w-1 rounded-full bg-muted-foreground" />
            </div>
          );

          const prob = sData.probability;
          const p = prob * 100;
          
          const thresholds = settings?.urgency_thresholds || { healthy: 85, critical: 30 };
          const crit = parseInt(thresholds.critical?.toString() ?? '30');
          const heal = parseInt(thresholds.healthy?.toString() ?? '85');

          const isCrit = p <= crit;
          const isHeal = p >= heal;
          
          let bg = 'bg-emerald-500/10 border-emerald-500/20';
          let textColor = 'text-emerald-500';
          let shadowColor = 'rgba(16,185,129,0.3)';

          if (isCrit) {
            bg = 'bg-rose-500/10 border-rose-500/20';
            textColor = 'text-rose-500';
            shadowColor = 'rgba(244,63,94,0.3)';
          } else if (!isHeal) {
            bg = 'bg-orange-500/10 border-orange-500/20';
            textColor = 'text-orange-500';
            shadowColor = 'rgba(249,115,22,0.3)';
          }
          
          return (
            <div 
              key={`${machineId}-s-${sNum}`} 
              className={cn(
                'p-3 rounded-2xl border flex flex-col items-center justify-center gap-0.5 transition-all relative overflow-hidden',
                bg,
                isActive && 'scale-105 border-primary shadow-[0_4px_15px_-3px_var(--tw-shadow-color)]'
              )}
              style={isActive ? { '--tw-shadow-color': shadowColor } as any : {}}
            >
              {isActive && (
                <div className="absolute top-0 right-0 p-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                </div>
              )}
              <span className={cn('text-[9px] font-black uppercase tracking-tight', isActive ? 'text-primary' : 'opacity-60')}>Shift {sNum}</span>
              <span className={cn('text-lg font-black tracking-tighter', textColor)}>{p.toFixed(2)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
