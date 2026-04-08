import { useState, useEffect } from 'react';
import { ShieldAlert, Rocket, RefreshCw, Save, Trash2 } from 'lucide-react';
import { useLicense } from '@/hooks/useLicense';
import { useIndustrialState } from '@/hooks/useIndustrialState';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';
import { IndustrialDialog } from '@/components/ui/IndustrialDialog';

export default function TestMode() {
   const { status, daysRemaining, deploy, resetLicense } = useLicense();
   const { baseUrl } = useIndustrialState();
   const [trialDays, setTrialDays] = useState(180);
   const [machines, setMachines] = useState<any[]>([]);
   const [isUpdating, setIsUpdating] = useState(false);
   const [sessionId] = useState(() => localStorage.getItem('eagle_session_id') || uuidv4());

   const isTestHidden = localStorage.getItem('eagle_test_mode_hidden') === 'true';
   const isContactHidden = localStorage.getItem('eagle_contact_hidden') === 'true';
   const isDeployDisabled = localStorage.getItem('eagle_hide_deploy') === 'true';

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

   const handleToggleVisibility = (key: string, label: string, current: boolean) => {
      if (!current) {
         setDialog({
            isOpen: true,
            title: `Hide ${label}`,
            message: `Are you sure you want to hide the ${label}? This will require a manual localStorage reset or a full station cache purge to restore.`,
            type: 'confirm',
            variant: 'danger',
            onConfirm: () => {
               localStorage.setItem(key, 'true');
               window.location.reload();
            }
         });
      } else {
         localStorage.setItem(key, 'false');
         window.location.reload();
      }
   };

   useEffect(() => {
      if (baseUrl) fetchMachines();
   }, [baseUrl]);

   const fetchMachines = async (delay = 0) => {
      if (!baseUrl) return;
      if (delay > 0) await new Promise(r => setTimeout(r, delay));
      try {
         const res = await fetch(`${baseUrl}/eagle/machines?t=${Date.now()}`, {
            headers: { 'X-Session-ID': sessionId }
         });
         const data = await res.json();
         // Safety check: ensure data is an array
         setMachines(Array.isArray(data) ? data : []);
      } catch (err) {
         console.error('[TestMode] Fetch failed:', err);
         setMachines([]);
      }
   };

   const handleManualUpdate = async (machineId: string, days: number) => {
      if (!baseUrl) return;
      try {
         await fetch(`${baseUrl}/eagle/machine/update-hours`, {
            method: 'POST',
            headers: {
               'Content-Type': 'application/json',
               'X-Session-ID': sessionId
            },
            body: JSON.stringify({ machine_id: machineId, hours: days * 24 })
         });
         fetchMachines(300); // Add 300ms propagation delay
         window.dispatchEvent(new CustomEvent('eagle-refresh'));
      } catch (err) {
         console.error(err);
      }
   };

   const handleRandomizeFleet = async () => {
      if (!baseUrl) return;
      setIsUpdating(true);
      try {
         await fetch(`${baseUrl}/eagle/test/randomize_fleet`, {
            method: 'POST',
            headers: { 'X-Session-ID': sessionId }
         });
         fetchMachines(500); // Extra delay for full fleet write
         window.dispatchEvent(new CustomEvent('eagle-refresh'));
      } catch (err) {
         console.error(err);
      }
      setIsUpdating(false);
   };

   return (
      <div className="p-8 space-y-12 pb-32 max-w-6xl mx-auto">
         <header className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
               <div className="p-3 bg-rose-500/10 rounded-2xl border border-rose-500/10">
                  <ShieldAlert className="h-6 w-6 text-rose-500" />
               </div>
               <h1 className="text-3xl font-black uppercase tracking-tighter">Industrial <span className="text-rose-500">Test Orchestrator</span></h1>
            </div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest opacity-60 ml-1">EAGLEAI ST v1.3.1 — Industrial Backend</p>
            <div className="h-1 w-32 bg-rose-500 rounded-full mt-2" />
         </header>

         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Trial Lifecycle Control */}
            <section className="lg:col-span-1 bg-card border-2 border-border rounded-[2.5rem] p-8 space-y-8 shadow-xl h-fit">
               <div className="space-y-2">
                  <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                     <Rocket className="h-5 w-5 text-primary" /> Lifecycle Overrides
                  </h2>
               </div>

               <div className="space-y-6">
                  <div className="space-y-4">
                     <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Evaluation Duration (Days)</label>
                        <input
                           type="number"
                           min="0"
                           value={trialDays}
                           onChange={(e) => setTrialDays(Math.max(0, Number(e.target.value)))}
                           className="w-full bg-secondary border border-border rounded-xl px-5 py-3 text-sm font-black focus:border-primary/50 outline-none"
                        />
                     </div>

                     <button
                        onClick={() => deploy(trialDays)}
                        className="w-full py-4 bg-primary text-primary-foreground text-[10px] font-black rounded-xl uppercase hover:bg-primary/90 transition-all active:scale-95 shadow-md flex items-center justify-center gap-2"
                     >
                        <Save className="h-4 w-4" /> Apply Evaluation Lifecycle
                     </button>
                  </div>

                  <div className="flex flex-col gap-3">
                     <button
                        onClick={resetLicense}
                        className="w-full py-4 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-2xl text-[10px] font-black uppercase hover:bg-rose-500/20 transition-all flex items-center justify-center gap-3"
                     >
                        <Trash2 className="h-4 w-4" /> Reset Deployment State
                     </button>

                     <div className="p-4 bg-secondary/50 rounded-2xl border border-border flex items-center justify-between">
                        <div className="flex flex-col">
                           <span className="text-[10px] font-black uppercase">Current Trial Status</span>
                           <span className={cn("text-xs font-black", status === 'active' ? 'text-emerald-500' : 'text-muted-foreground')}>
                              {status === 'active' ? `${daysRemaining} DAYS REMAINING` : status.toUpperCase()}
                           </span>
                        </div>
                        {status === 'active' && (
                           <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        )}
                     </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-border">
                     <h3 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">Visibility Controls</h3>
                     <div className="grid grid-cols-1 gap-3">
                        <VisibilityToggle
                           label="Test Mode Nav"
                           active={isTestHidden}
                           onToggle={() => handleToggleVisibility('eagle_test_mode_hidden', 'Test Mode Navigation', isTestHidden)}
                        />
                        <VisibilityToggle
                           label="Contact Developer"
                           active={isContactHidden}
                           onToggle={() => handleToggleVisibility('eagle_contact_hidden', 'Support Module', isContactHidden)}
                        />
                        <VisibilityToggle
                           label="Trial Deploy Trigger"
                           active={isDeployDisabled}
                           onToggle={() => handleToggleVisibility('eagle_hide_deploy', 'Deployment Trigger', isDeployDisabled)}
                        />
                     </div>
                  </div>
               </div>
            </section>

            {/* Fleet Manual Override */}
            <section className="lg:col-span-2 bg-card border-2 border-border rounded-[2.5rem] p-8 space-y-6 shadow-xl relative overflow-hidden">
               <div className="flex items-center justify-between">
                  <div className="space-y-1">
                     <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                        <RefreshCw className="h-5 w-5 text-amber-500" /> Fleet Manual Override
                     </h2>
                     <p className="text-[9px] font-bold text-muted-foreground uppercase opacity-60">Direct hour injection for machine horizons</p>
                  </div>
                  <button
                     onClick={handleRandomizeFleet}
                     disabled={isUpdating}
                     className="px-6 py-3 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-amber-600 transition-all disabled:opacity-50"
                  >
                     <RefreshCw className={cn("h-4 w-4", isUpdating && "animate-spin")} /> Randomize Horizon
                  </button>
               </div>

               <div className="overflow-y-auto max-h-[600px] custom-scrollbar border border-border rounded-2xl">
                  <table className="w-full text-left border-collapse">
                     <thead className="sticky top-0 bg-secondary z-10">
                        <tr className="border-b border-border">
                           <th className="px-6 py-4 text-[9px] font-black uppercase text-muted-foreground">Machine ID</th>
                           <th className="px-6 py-4 text-[9px] font-black uppercase text-muted-foreground">Urgency Status</th>
                           <th className="px-6 py-4 text-[9px] font-black uppercase text-muted-foreground">Remaining Window (Days)</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-border/30">
                        {machines.map((m) => {
                           const hours = m.maintenance?.hours_remaining || 0;
                           const days = Math.floor(hours / 24);
                           const isCritical = days < 5;
                           const isWarning = days >= 5 && days < 10;

                           return (
                              <tr key={m.machine_id} className="hover:bg-secondary/10 transition-colors">
                                 <td className="px-6 py-4 font-black text-sm">{m.machine_id}</td>
                                 <td className="px-6 py-4">
                                    <div className={cn(
                                       "inline-flex px-3 py-1 rounded-lg text-[8px] font-black uppercase border",
                                       isCritical ? "bg-rose-500/10 text-rose-500 border-rose-500/20" :
                                          isWarning ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                                             "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                    )}>
                                       {isCritical ? 'Critical' : isWarning ? 'Warning' : 'Optimal'}
                                    </div>
                                 </td>
                                 <td className="px-6 py-4">
                                    <input
                                       type="number"
                                       min="0"
                                       key={`${m.machine_id}-${m.maintenance?.hours_remaining}`}
                                       defaultValue={days}
                                       onBlur={(e) => {
                                          const val = Math.max(0, Number(e.target.value));
                                          handleManualUpdate(m.machine_id, val);
                                       }}
                                       className="w-20 bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs font-black focus:border-primary/50 outline-none"
                                    />
                                 </td>
                              </tr>
                           );
                        })}
                     </tbody>
                  </table>
               </div>
            </section>
         </div>

         <div className="bg-secondary/30 border border-border p-8 rounded-[2rem] text-center space-y-2">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.5em]">Engineering Safeguard</p>
            <p className="text-[9px] font-bold text-muted-foreground/60 leading-relaxed max-w-2xl mx-auto italic uppercase">
               CAUTION: These controls bypass industrial safety protocols and are intended for R&D validation only.
               Modifying the trial clock may affect the deterministic TTM model inference in a production environment.
            </p>
         </div>

         <IndustrialDialog
            isOpen={dialog.isOpen}
            onClose={() => setDialog({ ...dialog, isOpen: false })}
            onConfirm={dialog.onConfirm}
            title={dialog.title}
            message={dialog.message}
            type={dialog.type}
            variant={dialog.variant}
         />
      </div>
   );
}

function VisibilityToggle({ label, active, onToggle }: any) {
   return (
      <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-2xl border border-border hover:border-primary/20 transition-all group">
         <span className="text-[10px] font-black uppercase text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
         <button
            onClick={onToggle}
            className={cn(
               "relative w-12 h-6 rounded-full transition-all duration-300 shadow-inner",
               active ? "bg-rose-500" : "bg-card border border-border"
            )}
         >
            <div className={cn(
               "absolute top-1 w-4 h-4 rounded-full transition-all duration-300 shadow-md",
               active ? "left-7 bg-white" : "left-1 bg-muted-foreground"
            )} />
         </button>
      </div>
   );
}
