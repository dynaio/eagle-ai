import { useMemo } from 'react';
import { 
  Wrench, 
  ShieldAlert, 
  TrendingDown,
  TrendingUp,
  Zap,
  LayoutDashboard,
  Target,
  Database
} from 'lucide-react';
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, 
  ResponsiveContainer, XAxis, YAxis, Tooltip,
  AreaChart, Area, CartesianGrid
} from 'recharts';
import { motion } from 'framer-motion';
import { useIndustrialState } from '@/hooks/useIndustrialState';
import { cn } from '@/lib/utils';

export default function Repair() {
  const { state } = useIndustrialState();

  const appSettings = useMemo(() => ({
    criticalThreshold: state?.settings?.urgency_thresholds?.critical || 30,
    healthyThreshold: state?.settings?.urgency_thresholds?.healthy || 85,
    riskHorizon: state?.settings?.saturation_horizon_days || 10,
    capacity: state?.settings?.maintenance_capacity || { shift1: 5, shift2: 5, shift3: 5 }
  }), [state]);

  const critLimit = appSettings.criticalThreshold / 100;

  // ─── 10-DAY CAPACITY VS LOAD DATA ──────────────────────────────────────────
  const timelineData = useMemo(() => {
    if (!state?.machines_data) return [];
    
    const dailyCap = appSettings.capacity.shift1 + appSettings.capacity.shift2 + appSettings.capacity.shift3;
    const days = [];
    
    // Aligned with Dashboard logic: Day 1-10
    for (let d = 1; d <= 10; d++) {
      let dailyLoad = 0;
      state.machines_data.forEach(m => {
        const dayPreds = m.maintenance?.weekly_predictions?.filter(p => p.day === d) || [];
        if (dayPreds.some(p => p.probability <= critLimit)) {
          dailyLoad++;
        }
      });

      days.push({
        day: `Day ${d}`,
        load: dailyLoad,
        capacity: dailyCap,
        saturation: (dailyLoad / dailyCap) * 100,
        isOver: dailyLoad > dailyCap
      });
    }
    return days;
  }, [state, critLimit, appSettings.capacity]);

  const fleetStressIndex = useMemo(() => {
    if (timelineData.length === 0) return 0;
    const avgSaturation = timelineData.reduce((acc, d) => acc + d.saturation, 0) / timelineData.length;
    return avgSaturation;
  }, [timelineData]);

  const peakDay = useMemo(() => {
    if (timelineData.length === 0) return null;
    return [...timelineData].sort((a, b) => b.load - a.load)[0];
  }, [timelineData]);

  const fleetMetrics = useMemo(() => {
    if (!state?.machines_data) return [];
    // Map machines to radar data (normalized 0-100)
    return state.machines_data.slice(0, 8).map(m => ({
      subject: m.machine_id,
      health: (m.maintenance?.next_shift_probability || 0) * 100,
      efficiency: m.performance?.efficiency_pct || 0,
      stability: 100 - ((m.performance?.endsdown_count || 0) / 10 * 100), // Scaled stability
      fullMark: 100,
    }));
  }, [state]);

  const criticalUnitsCount = state?.machines_data?.filter(m => (m.maintenance?.next_shift_probability || 1.0) <= critLimit).length || 0;

  if (!state) return null;

  return (
    <div className="p-8 space-y-8 pb-32 max-w-7xl mx-auto">
      <header className="flex flex-col gap-2">
        <h1 className="text-sm font-black tracking-[0.4em] text-muted-foreground uppercase opacity-80 flex items-center gap-2">
          <Wrench className="h-4 w-4 text-primary" /> REPAIR STATION STATION — COMMAND CENTER
        </h1>
        <div className="h-1 w-32 bg-primary rounded-full mt-1" />
      </header>

      {/* Top Level Command KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         <KPICard 
           title="Fleet Stress" 
           value={`${fleetStressIndex.toFixed(2)}%`}
           desc="Avg 10-Day Saturation"
           icon={Zap}
           color="text-amber-500"
         />
         <KPICard 
           title="Resource Peak" 
           value={peakDay ? `${peakDay.load} Units` : 'N/A'}
           desc={peakDay ? `Predicted at ${peakDay.day}` : 'Calibrating...'}
           icon={TrendingDown}
           color={peakDay?.isOver ? "text-rose-500" : "text-amber-500"}
         />
         <KPICard 
           title="Immediate Repair" 
           value={criticalUnitsCount.toString()}
           desc="Units Below Threshold"
           icon={ShieldAlert}
           color={criticalUnitsCount > 0 ? "text-rose-500" : "text-emerald-500"}
         />
         <KPICard 
           title="G36 Efficiency" 
           value="94.25%"
           desc="Fleet Stability Index"
           icon={TrendingUp}
           color="text-emerald-500"
         />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* 10-DAY LOAD BALANCER (MAIN CHART) */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="lg:col-span-8 bg-card border border-border rounded-[2.5rem] p-8 space-y-8 shadow-sm relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-12 opacity-[0.02] pointer-events-none group-hover:opacity-[0.05] transition-opacity">
            <LayoutDashboard className="h-64 w-64 rotate-12" />
          </div>

          <div className="flex justify-between items-start relative z-10">
            <div className="space-y-1">
               <h3 className="text-2xl font-black uppercase tracking-tight">10-Day Predictive Load Balancer</h3>
               <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">Maintenance Resource Forecasting vs. Capacity Limits</p>
            </div>
            <div className="flex items-center gap-6">
                <div className="flex flex-col items-end">
                  <span className="text-[9px] font-black text-muted-foreground uppercase opacity-40">System State</span>
                  <span className="text-[11px] font-black text-emerald-500 uppercase tracking-widest">Neural Link Active</span>
                </div>
            </div>
          </div>

          <div className="h-[400px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorCap" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="rgba(16,185,129,0.1)" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="rgba(16,185,129,0)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.05} />
                <XAxis 
                  dataKey="day" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 900, fill: 'currentColor', opacity: 0.4 }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 900, fill: 'currentColor', opacity: 0.4 }} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(23, 23, 23, 0.8)', 
                    backdropFilter: 'blur(10px)',
                    borderRadius: '1.5rem', 
                    border: '1px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
                    fontSize: '11px',
                    fontWeight: 900,
                    textTransform: 'uppercase'
                  }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="load" 
                  name="Maintenance Load"
                  stroke="hsl(var(--primary))" 
                  strokeWidth={4}
                  fillOpacity={1} 
                  fill="url(#colorLoad)" 
                />
                <Area 
                  type="stepAfter" 
                  dataKey="capacity" 
                  name="Fleet Capacity"
                  stroke="rgba(16,185,129,0.3)" 
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorCap)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex gap-8 pt-4 border-t border-border/50 relative z-10">
             <div className="flex-1 space-y-4">
                <div className="flex items-center justify-between">
                   <h4 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Fleet Integrity Buffer</h4>
                   <span className="text-[10px] font-black text-emerald-500 uppercase italic">Nominal Operability</span>
                </div>
                <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                   <motion.div 
                     initial={{ width: 0 }} 
                     animate={{ width: `${100 - (fleetStressIndex/2)}%` }} 
                     className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" 
                   />
                </div>
             </div>
             <div className="flex-1 space-y-4">
                <div className="flex items-center justify-between">
                   <h4 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Neural Link Fidelity</h4>
                   <span className="text-[10px] font-black text-primary uppercase italic">Synchronized</span>
                </div>
                <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                   <motion.div 
                     initial={{ width: 0 }} 
                     animate={{ width: "98.5%" }} 
                     className="h-full bg-primary shadow-[0_0_10px_rgba(var(--primary),0.3)]" 
                   />
                </div>
             </div>
          </div>
        </motion.div>

        {/* SIDEBAR: FLEET PROFILE & STRESS MAP */}
        <div className="lg:col-span-4 space-y-8">
           {/* Radar Chart: Fleet Health Distribution */}
           <motion.div 
             initial={{ opacity: 0, x: 20 }}
             animate={{ opacity: 1, x: 0 }}
             className="bg-card border border-border rounded-[2.5rem] p-8 space-y-6 shadow-sm group overflow-hidden"
           >
              <div className="flex items-center justify-between">
                 <h3 className="text-xl font-black uppercase tracking-tight">Health Radar</h3>
                 <Target className="h-5 w-5 text-primary opacity-40 ml-auto" />
              </div>
              
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={fleetMetrics}>
                    <PolarGrid strokeOpacity={0.05} />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 8, fontWeight: 900, fill: 'currentColor', opacity: 0.6 }} />
                    <Radar
                      name="Health Signature"
                      dataKey="health"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.2}
                      strokeWidth={3}
                    />
                    <Radar
                      name="Efficiency"
                      dataKey="efficiency"
                      stroke="#10b981"
                      fill="#10b981"
                      fillOpacity={0.1}
                      strokeWidth={2}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              <div className="flex justify-center gap-4 pt-2">
                 <div className="px-3 py-1 bg-primary/10 border border-primary/20 rounded-full flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <span className="text-[9px] font-black uppercase text-primary">Health</span>
                 </div>
                 <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="text-[9px] font-black uppercase text-emerald-500">Efficiency</span>
                 </div>
              </div>
           </motion.div>

           {/* Saturation Warning Banner */}
           <motion.div 
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             className={cn(
               "p-8 rounded-[2.5rem] border flex flex-col justify-between h-[280px] relative overflow-hidden",
               fleetStressIndex > 80 ? "bg-rose-500 shadow-[0_20px_40px_rgba(244,63,94,0.3)] border-rose-600" : "bg-primary shadow-[0_20px_40px_rgba(var(--primary),0.3)] border-primary/50"
             )}
           >
              <div className="absolute -bottom-8 -right-8 opacity-20 transform rotate-12">
                 <Zap className="h-48 w-48 text-white" />
              </div>

              <div className="space-y-4 relative z-10">
                 <div className="h-12 w-12 bg-white/20 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/20">
                    <ShieldAlert className="h-6 w-6 text-white" />
                 </div>
                 <div className="space-y-1">
                    <h4 className="text-xl font-black uppercase tracking-tight text-white leading-none">
                      {fleetStressIndex > 80 ? "Critical Resource Saturation" : "Optimal Fleet Balance"}
                    </h4>
                    <p className="text-[10px] font-bold text-white/80 uppercase tracking-widest">
                      {fleetStressIndex > 80 ? "Maintenance backlog imminent. Reallocate shifts." : "Neural Forecast within Capacity Margins."}
                    </p>
                 </div>
              </div>

              <div className="pt-6 border-t border-white/20 relative z-10">
                 <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] font-black text-white/60 uppercase tracking-widest">Average Stress Velocity</span>
                    <span className="text-[11px] font-black text-white">{Math.round(fleetStressIndex)}%</span>
                 </div>
                 <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }} 
                      animate={{ width: `${fleetStressIndex}%` }} 
                      className="h-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]" 
                    />
                 </div>
              </div>
           </motion.div>
        </div>
      </div>

      {/* FOOTER: DATA FIDELITY NOTE */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8">
          <div className="bg-secondary/20 border border-border/50 rounded-[2rem] p-8 flex items-center gap-6 group">
             <div className="p-4 bg-card rounded-2xl border border-border group-hover:border-primary/50 transition-colors shadow-sm">
                <Database className="h-6 w-6 text-muted-foreground opacity-40 group-hover:text-primary transition-colors" />
             </div>
             <div className="space-y-1">
                <h4 className="text-xs font-black uppercase tracking-widest">Synchronized G36 Telemetry</h4>
                <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-60 leading-relaxed">
                  Deep integration with Spider Web live data feeds. Forecast generated from XGBoost Predictive Cluster.
                </p>
             </div>
          </div>
          <div className="bg-secondary/20 border border-border/50 rounded-[2rem] p-8 flex items-center gap-6 group">
             <div className="p-4 bg-card rounded-2xl border border-border group-hover:border-primary/50 transition-colors shadow-sm">
                <Target className="h-6 w-6 text-muted-foreground opacity-40 group-hover:text-primary transition-colors" />
             </div>
             <div className="space-y-1">
                <h4 className="text-xs font-black uppercase tracking-widest">Capacity Safeguard Active</h4>
                <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-60 leading-relaxed">
                  Real-time monitoring of maintenance bandwidth. Total theoretical throughput fixed at {appSettings.capacity.shift1 + appSettings.capacity.shift2 + appSettings.capacity.shift3} units/day.
                </p>
             </div>
          </div>
      </div>
    </div>
  );
}

function KPICard({ title, value, desc, icon: Icon, color }: any) {
  return (
    <div className="bg-card border border-border p-6 rounded-[2rem] shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
      <div className="absolute -bottom-4 -right-4 p-4 opacity-[0.03] group-hover:opacity-10 transition-opacity">
        <Icon className="h-20 w-20 scale-110 rotate-12" />
      </div>
      <div className="flex items-start justify-between relative z-10">
        <div>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1 opacity-60">{title}</p>
          <p className={cn("text-3xl font-black tracking-tighter", color)}>{value}</p>
          <p className="text-[9px] font-bold mt-2 opacity-50 uppercase leading-none">{desc}</p>
        </div>
        <div className={cn("p-2.5 rounded-2xl bg-secondary shadow-inner border border-border/50", color)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
