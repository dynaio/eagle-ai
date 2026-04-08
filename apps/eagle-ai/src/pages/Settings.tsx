import { useState, useEffect } from 'react';
import { Save, Target, Shield, Layout, Database, Info, Trash2, RefreshCcw, Activity } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { IndustrialDialog } from '@/components/ui/IndustrialDialog';
import { useIndustrialState, IndustrialState } from '@/hooks/useIndustrialState';
import { DatabaseSettings } from '@/components/DatabaseSettings';

export default function Settings() {
  const { state, saveState, isLoading, baseUrl } = useIndustrialState();
  const [activeTab, setActiveTab] = useState('engine');
  
  const [config, setConfig] = useState({
    maintenanceHorizon: 336, 
    criticalThreshold: 24, 
    memoryLimit: 1024,
    updateInterval: 30,
    predictionIntervalWeeks: state?.settings?.prediction_interval_weeks || 1,
    maintenanceCapacity: state?.settings?.maintenance_capacity || { shift1: 5, shift2: 5, shift3: 5 },
    urgencyThresholds: state?.settings?.urgency_thresholds || { critical: 30, warning: 30, healthy: 40 },
    saturationHorizonDays: state?.settings?.saturation_horizon_days || 15,
    logoScale: parseFloat(localStorage.getItem('eagle_logo_scale') || '1.1'),
  });

  const [isRestarting, setIsRestarting] = useState(false);
  const [restartStatus, setRestartStatus] = useState<string | null>(null);

  const [dialog, setDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'alert' | 'confirm';
    variant: 'primary' | 'danger' | 'success';
    onConfirm?: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'alert',
    variant: 'primary'
  });

  useEffect(() => {
    if (state?.settings) {
      setConfig((prev: any) => ({
        ...prev,
        maintenanceHorizon: state.settings.default_maintenance_horizon_hours || 336,
        criticalThreshold: state.settings.critical_threshold_hours || 24,
        memoryLimit: state.settings.memory_limit_mb,
        updateInterval: state.settings.refresh_interval_minutes,
        predictionIntervalWeeks: state.settings.prediction_interval_weeks || 5,
        maintenanceCapacity: state.settings.maintenance_capacity || { shift1: 5, shift2: 5, shift3: 5 },
        urgencyThresholds: state.settings.urgency_thresholds || { critical: 30, warning: 30, healthy: 40 },
        saturationHorizonDays: state.settings.saturation_horizon_days || 15
      }));
    }
  }, [state]);

  const purgeCache = () => {
    setDialog({
      isOpen: true,
      title: 'Global Station Reset',
      message: 'Are you sure you want to purge all local preferences AND backend industrial state? This will require re-uploading datasets.',
      type: 'confirm',
      variant: 'danger',
      onConfirm: async () => {
        try {
          if (baseUrl) {
            await fetch(`${baseUrl}/eagle/purge`, { method: 'POST' });
          }
          localStorage.clear();
          window.location.reload();
        } catch (err) {
          console.error("Purge failed:", err);
          localStorage.clear();
          window.location.reload();
        }
      }
    });
  };

  const handleSave = async () => {
    setDialog({
      isOpen: true,
      title: 'Confirm Station Commit',
      message: 'Are you sure you want to commit these technical parameters to the industrial state and restart the inference cycle?',
      type: 'confirm',
      variant: 'primary',
      onConfirm: executeSave
    });
  };

  const executeSave = async () => {
    if (!state) return;

    if (config.criticalThreshold < 1 || config.criticalThreshold >= config.maintenanceHorizon) {
       setDialog({
         isOpen: true,
         title: 'Validation Error',
         message: `Critical Threshold must be between 1 and ${config.maintenanceHorizon - 1} hours.`,
         type: 'alert',
         variant: 'danger'
       });
       return;
    }

    const overLimit = Object.values(config.maintenanceCapacity).some((v: any) => v > 31);
    if (overLimit) {
      setDialog({
        isOpen: true,
        title: 'Validation Error',
        message: `Shift Maintenance Capacity cannot exceed 31 machines (Fleet Total).`,
        type: 'alert',
        variant: 'danger'
      });
      return;
    }

    localStorage.setItem('eagle_logo_scale', config.logoScale.toString());
    
    const newState: IndustrialState = {
      ...state,
      settings: {
        ...state.settings,
        default_maintenance_horizon_hours: config.maintenanceHorizon,
        critical_threshold_hours: config.criticalThreshold,
        memory_limit_mb: config.memoryLimit,
        refresh_interval_minutes: config.updateInterval,
        prediction_interval_weeks: config.predictionIntervalWeeks,
        maintenance_capacity: config.maintenanceCapacity,
        urgency_thresholds: config.urgencyThresholds,
        saturation_horizon_days: config.saturationHorizonDays
      }
    };

    const success = await saveState(newState);
    if (success) {
      setDialog({
        isOpen: true,
        title: 'ST-Edition Updated',
        message: 'All industrial parameters have been natively persisted to eagle-state.json.',
        type: 'alert',
        variant: 'success'
      });
    }
  };

  if (isLoading) return <div className="p-8 animate-pulse text-xs font-black uppercase tracking-widest flex items-center justify-center h-screen">Initializing Industrial Config...</div>;

  const tabs = [
    { id: 'engine', label: 'Prediction Engine', icon: Target },
    { id: 'fleet', label: 'Fleet Mastery', icon: Shield },
    { id: 'appearance', label: 'Appearance', icon: Layout },
    { id: 'bridge', label: 'Neural Bridge', icon: Database },
  ];

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* Sidebar Navigation */}
      <div className="w-72 bg-card border-r border-border flex flex-col p-6 space-y-8">
        <div className="space-y-1">
          <h1 className="text-[10px] font-black tracking-[0.4em] text-muted-foreground uppercase opacity-80">
            Station Control
          </h1>
          <div className="h-1 w-12 bg-primary rounded-full" />
        </div>

        <nav className="flex-1 space-y-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all group relative",
                activeTab === tab.id 
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]" 
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <tab.icon className={cn("h-4 w-4", activeTab === tab.id ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary")} />
              {tab.label}
              {activeTab === tab.id && (
                <motion.div 
                   layoutId="activeTabGlow"
                   className="absolute inset-0 bg-primary/20 blur-xl rounded-2xl -z-10"
                />
              )}
            </button>
          ))}
        </nav>

        <div className="pt-6 border-t border-border mt-auto">
           <button 
             onClick={handleSave}
             className="w-full py-4 bg-primary text-primary-foreground font-black uppercase text-xs rounded-2xl flex items-center justify-center gap-3 shadow-xl shadow-primary/10 hover:shadow-primary/30 transition-all active:scale-95"
           >
              <Save className="h-4 w-4" /> Commit All
           </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative overflow-y-auto custom-scrollbar bg-secondary/5">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="p-10 max-w-5xl"
          >
            {/* TAB: PREDICTION ENGINE */}
            {activeTab === 'engine' && (
              <div className="space-y-8">
                <SectionHeader icon={Target} title="Inference Engine Architecture" />
                <div className="bg-card border border-border rounded-[2rem] p-8 space-y-8 shadow-sm">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <SettingField label="Maintenance Risk Horizon" desc="Alert machines predicted to fail within this window (Hours).">
                      <input 
                         type="number" min="1" value={config.maintenanceHorizon} 
                         onChange={e => setConfig({...config, maintenanceHorizon: parseInt(e.target.value) || 1})}
                         className="w-full bg-secondary p-4 rounded-xl text-sm font-black border border-border focus:border-primary outline-none transition-all"
                      />
                    </SettingField>
                    <SettingField label="Critical Risk Threshold" desc="Highlight machines in RED if they fall below this window (Hours).">
                      <input 
                         type="number" min="1" max={config.maintenanceHorizon - 1} value={config.criticalThreshold} 
                         onChange={e => setConfig({...config, criticalThreshold: parseInt(e.target.value) || 1})}
                         className="w-full bg-secondary p-4 rounded-xl text-sm font-black border border-border focus:border-primary outline-none transition-all"
                      />
                    </SettingField>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <SettingField label="Prediction History Window" desc="Historical window for trend analysis (Weeks).">
                      <select 
                        value={config.predictionIntervalWeeks}
                        onChange={e => setConfig({...config, predictionIntervalWeeks: parseInt(e.target.value)})}
                        className="bg-secondary p-4 rounded-xl text-sm font-black w-full border border-border appearance-none cursor-pointer"
                      >
                        {[1, 2, 3, 4, 5].map(w => (
                          <option key={w} value={w}>{w} {w === 1 ? 'Week' : 'Weeks'}</option>
                        ))}
                      </select>
                    </SettingField>
                    <SettingField label="Cycle Refresh Interval" desc="How often the model recalculates fleet risk (Minutes).">
                      <select 
                        value={config.updateInterval}
                        onChange={e => setConfig({...config, updateInterval: parseInt(e.target.value)})}
                        className="bg-secondary p-4 rounded-xl text-sm font-black w-full border border-border appearance-none cursor-pointer"
                      >
                        <option value={5}>Every 5 Minutes</option>
                        <option value={15}>Every 15 Minutes</option>
                        <option value={30}>Every 30 Minutes (Default)</option>
                        <option value={60}>Every Hour</option>
                      </select>
                    </SettingField>
                  </div>

                  <SettingField label="Memory Control" desc="Max RAM for TTM Inference & Data Buffers (MB).">
                    <div className="grid grid-cols-4 gap-2">
                       {[512, 1024, 2048, 4096].map(m => (
                         <button 
                           key={m}
                           onClick={() => setConfig({...config, memoryLimit: m})}
                           className={cn(
                             "py-3 rounded-xl text-[10px] font-black uppercase border transition-all",
                             config.memoryLimit === m ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border hover:border-primary/30"
                           )}
                         >
                           {m} MB
                         </button>
                       ))}
                    </div>
                  </SettingField>


                </div>
              </div>
            )}

            {/* TAB: FLEET MASTERY */}
            {activeTab === 'fleet' && (
              <div className="space-y-8">
                <SectionHeader icon={Shield} title="Maintenance Logistics Management" />
                <div className="bg-card border border-border rounded-[2rem] p-8 space-y-8 shadow-sm">
                  <SettingField label="Shift Capacity Thresholds" desc="Max machines available for maintenance per 8-hour shift.">
                    <div className="grid grid-cols-3 gap-6">
                      {[1, 2, 3].map(s => (
                        <div key={s} className="space-y-3">
                          <label className="text-[10px] font-black uppercase text-muted-foreground opacity-60">Shift {s}</label>
                          <input 
                            type="number" min="1" max="31"
                            value={config.maintenanceCapacity[`shift${s}` as keyof typeof config.maintenanceCapacity]}
                            onChange={e => setConfig({...config, maintenanceCapacity: { ...config.maintenanceCapacity, [`shift${s}`]: Math.min(31, parseInt(e.target.value) || 1) }})}
                            className="w-full bg-secondary p-4 rounded-xl text-sm font-black border border-border focus:border-primary outline-none transition-all"
                          />
                        </div>
                      ))}
                    </div>
                  </SettingField>

                  <SettingField label="Saturation Warning Horizon" desc="Alert if any shift exceeds capacity within this window (Days).">
                    <div className="flex items-center gap-6 p-4 bg-secondary/30 rounded-2xl border border-border/50">
                      <input 
                        type="range" min="1" max="30" step="1" value={config.saturationHorizonDays} 
                        onChange={e => setConfig({...config, saturationHorizonDays: parseInt(e.target.value)})}
                        className="flex-1 accent-primary h-2 bg-secondary rounded-full appearance-none cursor-pointer" 
                      />
                      <span className="text-xl font-black min-w-[60px] text-center">{config.saturationHorizonDays}d</span>
                    </div>
                  </SettingField>
                </div>
              </div>
            )}

            {/* TAB: APPEARANCE */}
            {activeTab === 'appearance' && (
              <div className="space-y-8">
                <SectionHeader icon={Layout} title="Industrial UX Configuration" />
                <div className="bg-card border border-border rounded-[2rem] p-8 space-y-8 shadow-sm">
                  
                  <SettingField label="Risk Assessment Thresholds (%)" desc="Define what running probability constitutes Healthy vs Critical status.">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase text-rose-500">Critical Limit (%)</label>
                        <div className="relative group">
                          <input 
                            type="number" min="0" max={config.urgencyThresholds.healthy - 1} 
                            value={config.urgencyThresholds.critical}
                            onChange={e => {
                               const val = Math.min(config.urgencyThresholds.healthy - 1, Math.max(0, parseInt(e.target.value) || 0));
                               setConfig({ ...config, urgencyThresholds: { ...config.urgencyThresholds, critical: val } });
                            }}
                            className="w-full bg-secondary p-4 rounded-xl text-xl font-black border border-border focus:border-rose-500 outline-none transition-all group-hover:bg-secondary/80"
                          />
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black pointer-events-none opacity-40">Running Chance ≤ X</div>
                        </div>
                        <p className="text-[9px] text-muted-foreground italic">Machines with a running probability at or below this value will be marked as CRITICAL (Red).</p>
                      </div>

                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase text-emerald-500">Healthy Limit (%)</label>
                        <div className="relative group">
                          <input 
                            type="number" min={config.urgencyThresholds.critical + 1} max="100" 
                            value={config.urgencyThresholds.healthy}
                            onChange={e => {
                               const val = Math.min(100, Math.max(config.urgencyThresholds.critical + 1, parseInt(e.target.value) || 0));
                               setConfig({ ...config, urgencyThresholds: { ...config.urgencyThresholds, healthy: val } });
                            }}
                            className="w-full bg-secondary p-4 rounded-xl text-xl font-black border border-border focus:border-emerald-500 outline-none transition-all group-hover:bg-secondary/80"
                          />
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black pointer-events-none opacity-40">Running Chance ≥ X</div>
                        </div>
                        <p className="text-[9px] text-muted-foreground italic">Machines with a running probability at or above this value will be marked as HEALTHY (Green).</p>
                      </div>
                    </div>
                    <div className="p-4 bg-secondary/30 rounded-2xl border border-border/50 text-[10px] text-muted-foreground italic flex flex-wrap gap-x-4">
                      <span>• Critical: ≤ {config.urgencyThresholds.critical}%</span>
                      <span>• Warning/Alert: {config.urgencyThresholds.critical}% to {config.urgencyThresholds.healthy}%</span>
                      <span>• Healthy: ≥ {config.urgencyThresholds.healthy}%</span>
                    </div>
                  </SettingField>

                  <div className="h-px bg-border" />

                  <SettingField label="Interactive Asset Scale" desc="Adjust the scale of branded visual components.">
                    <div className="flex items-center gap-6 p-4 bg-secondary/30 rounded-2xl border border-border/50">
                      <input 
                        type="range" min="1" max="3" step="0.1" value={config.logoScale} 
                        onChange={e => setConfig({...config, logoScale: parseFloat(e.target.value)})}
                        className="flex-1 accent-primary h-2 bg-secondary rounded-full appearance-none cursor-pointer" 
                      />
                      <span className="text-xl font-black min-w-[60px] text-center">{config.logoScale}x</span>
                    </div>
                  </SettingField>

                  <SettingField label="Dashboard Monitoring Density" desc="Fleet cards per row on the main industrial dashboard.">
                      <div className="grid grid-cols-3 gap-4">
                         {[2, 3, 4].map(num => (
                           <button 
                             key={num}
                             onClick={() => {
                               localStorage.setItem('eagle_cards_per_row', num.toString());
                               window.dispatchEvent(new Event('storage')); 
                               setConfig((prev: any) => ({...prev})); 
                             }}
                             className={cn(
                               "py-4 rounded-xl text-xs font-black uppercase transition-all border",
                               (localStorage.getItem('eagle_cards_per_row') || '4') === num.toString() 
                                 ? "bg-primary text-primary-foreground border-primary shadow-lg" 
                                 : "bg-secondary border-border hover:border-primary/30"
                             )}
                           >
                             {num} Cards
                           </button>
                         ))}
                      </div>
                  </SettingField>
                </div>
              </div>
            )}

            {/* TAB: NEURAL BRIDGE */}
            {activeTab === 'bridge' && (
              <div className="space-y-8">
                  <div className="h-px bg-border my-8" />

                  <SectionHeader icon={Activity} title="Core Diagnostic Control" />
                  <div className="bg-rose-500/5 border border-rose-500/10 rounded-2xl p-6 space-y-4">
                    <div>
                      <h4 className="text-sm font-bold uppercase tracking-tight mb-1 text-rose-500">Neural Engine Recovery</h4>
                      <p className="text-[10px] text-muted-foreground font-medium">If the station loses connection to the industrial backend, use this override to force-restart the neural sidecar.</p>
                    </div>

                    <button 
                      onClick={async () => {
                        setIsRestarting(true);
                        setRestartStatus('Spawning fresh sidecar...');
                        try {
                          await invoke('restart_neural_engine');
                          setRestartStatus('Success! Engine online.');
                          setTimeout(() => {
                            window.location.reload();
                          }, 1500);
                        } catch (err: any) {
                          setRestartStatus(`Failed: ${err}`);
                          setIsRestarting(false);
                        }
                      }}
                      disabled={isRestarting}
                      className={cn(
                        "w-full py-4 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-3 transition-all active:scale-95 border",
                        isRestarting 
                          ? "bg-secondary text-muted-foreground border-border animate-pulse" 
                          : "bg-rose-500 text-white border-rose-600 shadow-lg shadow-rose-500/20 hover:shadow-rose-500/40"
                      )}
                    >
                      <RefreshCcw className={cn("h-4 w-4", isRestarting && "animate-spin")} />
                      {isRestarting ? restartStatus : "Force Restart Neural Engine"}
                    </button>
                    {restartStatus && !isRestarting && (
                      <p className="text-[10px] font-black uppercase text-rose-500 text-center">{restartStatus}</p>
                    )}
                  </div>

                  <DatabaseSettings />
                 
                  <div className="pt-8 border-t border-border flex flex-col gap-4">
                     <div className="flex items-center gap-4 text-rose-500/60 p-4 bg-rose-500/5 rounded-2xl border border-rose-500/10 italic text-[10px]">
                        <Info className="h-4 w-4 shrink-0" />
                        EagleAI operates in local-only mode. All data is persisted to eagle-state.json. 
                        Purging resets preferences but preserves industrial state.
                     </div>
                     <button 
                       onClick={purgeCache}
                       className="w-full py-4 bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-500 rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-3 transition-all active:scale-95 border border-rose-500/20 shadow-sm"
                     >
                        <Trash2 className="h-4 w-4" /> Purge Station Cache
                     </button>
                  </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <IndustrialDialog isOpen={dialog.isOpen} onClose={() => setDialog({ ...dialog, isOpen: false })} onConfirm={dialog.onConfirm} title={dialog.title} message={dialog.message} type={dialog.type} variant={dialog.variant}/>
    </div>
  );
}

function SectionHeader({ icon: Icon, title }: any) {
  return (
    <div className="flex items-center gap-2 mb-4">
       <Icon className="h-4 w-4 text-primary" />
       <h2 className="text-xs font-black uppercase tracking-[0.2em]">{title}</h2>
    </div>
  );
}

function SettingField({ label, desc, children }: any) {
  return (
    <div className="space-y-4 leading-none">
       <div>
         <h4 className="text-sm font-bold uppercase tracking-tight mb-1">{label}</h4>
         <p className="text-[10px] text-muted-foreground font-medium">{desc}</p>
       </div>
       {children}
    </div>
  );
}
