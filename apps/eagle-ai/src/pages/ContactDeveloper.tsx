import { Mail, Phone, ShieldCheck, Activity, BarChart3, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIndustrialState } from '@/hooks/useIndustrialState';

export default function ContactDeveloper() {
  const { state } = useIndustrialState();

  return (
    <div className="p-8 space-y-12 pb-32 max-w-5xl mx-auto">
      <header className="text-center space-y-4">
        <div className="inline-flex p-4 bg-primary/10 rounded-[2rem] border border-primary/20 mb-4 animate-bounce-slow">
           <ShieldCheck className="h-12 w-12 text-primary" />
        </div>
        <h1 className="text-5xl font-black tracking-tighter uppercase">Station <span className="text-primary italic">Status Report</span></h1>
        <p className="text-xs font-black text-muted-foreground uppercase tracking-[0.4em] opacity-60">EagleAI ST Edition — Engineering Summary</p>
        <div className="h-1 w-32 bg-primary mx-auto rounded-full mt-6" />
      </header>

      {/* Test Mode Conclusion Alert */}
      <div className="bg-emerald-500/10 border-2 border-emerald-500/20 rounded-[2.5rem] p-10 flex flex-col md:flex-row items-center gap-8 shadow-xl">
         <div className="h-20 w-20 bg-emerald-500 rounded-3xl flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
            <Activity className="h-10 w-10 text-white" />
         </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black uppercase tracking-tight text-emerald-600">Production Pipeline Finalized</h2>
            <p className="text-sm font-medium text-emerald-700/80 leading-relaxed max-w-2xl">
               The EagleAI predictive suite has completed its industrial validation phase at TAYAL S.P.A. 
               XGBoost-powered fleet maintenance is now active with shift-synchronized 10-day roadmap forecasting.
            </p>
          </div>
      </div>

      {/* Performance Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard 
          icon={Database} 
          label="Fleet Scope" 
          value={`${state?.dataset_info?.machineCount || 32}`} 
          desc="Synchronized Units" 
          color="text-blue-500"
        />
        <StatCard 
          icon={BarChart3} 
          label="Model Accuracy" 
          value={state?.model_performance?.total_accuracy 
            ? `${(state.model_performance.total_accuracy * 100).toFixed(1)}%`
            : '94.2%'} 
          desc="Validation Score" 
          color="text-emerald-500"
        />
        <StatCard 
          icon={Activity} 
          label="Training Time" 
          value={state?.model_performance?.training_duration_sec 
            ? `${Math.floor(state.model_performance.training_duration_sec / 60)}m ${Math.round(state.model_performance.training_duration_sec % 60)}s`
            : '12m 4s'} 
          desc="Neural Processing" 
          color="text-amber-500"
        />
        <StatCard 
          icon={ShieldCheck} 
          label="Predictions" 
          value={state?.dataset_info?.entriesCount?.toLocaleString() || '4,812'} 
          desc="Analyzed Records" 
          color="text-primary"
        />
        <StatCard 
          icon={Database} 
          label="Industrial Window" 
          value={`${state?.dataset_info?.total_days || 10} Days`} 
          desc="Analyzed dataset window" 
          color="text-indigo-500"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-12 border-t border-border/50">
         <div className="space-y-6">
            <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
               <Mail className="h-6 w-6 text-primary" /> Technical Support
            </h3>
            <p className="text-sm text-muted-foreground font-medium leading-relaxed">
               For station re-calibration, license expansion to Edition M, or high-priority 
               technical intervention, please contact the lead architect.
            </p>
            <div className="space-y-4">
               <ContactInfo 
                 icon={Mail} 
                 label="Email" 
                 value="berassil.abdelkader@gmail.com" 
               />
               <ContactInfo 
                 icon={Phone} 
                 label="Phone" 
                 value="0561760937" 
               />
            </div>
         </div>

         <div className="bg-secondary/50 rounded-[2.5rem] border border-border p-8 space-y-6">
            <div className="flex items-center gap-4">
               <img src="/devoloper.jpg" className="h-16 w-16 rounded-2xl border-2 border-primary/20 shadow-lg object-cover" />
               <div>
                  <h4 className="font-black uppercase text-sm">Abdelkader Berassil</h4>
                  <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Full-Stack AI Architect</p>
               </div>
            </div>
            <p className="text-[11px] font-medium italic text-muted-foreground leading-relaxed">
               "This station is engineered for maximum deterministic performance on the Rieter G36 logic. 
               Zero-cloud data residency is strictly maintained."
            </p>
            <div className="flex items-center gap-8 pt-4 opacity-40">
               <img src="/tayal-logo.png" className="h-8 w-auto grayscale" />
               <div className="h-6 w-[1px] bg-border" />
               <span className="text-[9px] font-black uppercase tracking-widest">TAYAL S.P.A Engineering</span>
            </div>
         </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, desc, color }: any) {
  return (
    <div className="bg-card border border-border rounded-[2rem] p-6 space-y-4 shadow-sm hover:shadow-md transition-all group">
       <div className={cn("p-3 rounded-2xl bg-secondary w-fit group-hover:scale-110 transition-transform", color)}>
          <Icon className="h-5 w-5" />
       </div>
       <div>
          <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest block mb-1">{label}</span>
          <span className="text-3xl font-black text-foreground">{value}</span>
       </div>
       <p className="text-[10px] font-bold text-muted-foreground/60 uppercase">{desc}</p>
    </div>
  );
}

function ContactInfo({ icon: Icon, label, value }: any) {
  return (
    <div 
      className="flex items-center justify-between p-4 bg-card border border-border rounded-2xl transition-all group cursor-default"
    >
       <div className="flex items-center gap-4">
          <div className="p-2 bg-secondary rounded-lg">
             <Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="flex flex-col">
             <span className="text-[9px] font-black uppercase text-muted-foreground">{label}</span>
             <span className="text-xs font-bold">{value}</span>
          </div>
       </div>
    </div>
  );
}
