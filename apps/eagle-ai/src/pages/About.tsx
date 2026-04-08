import { Cpu, Globe, Rocket, Mail, Phone, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useLicense } from '@/hooks/useLicense';
import React from 'react';

export default function About() {
  const { status, deploy } = useLicense();
  const [loading, setLoading] = React.useState(false);
  const scaleFactor = parseFloat(localStorage.getItem('eagle_logo_scale') || '1.5');

  const handleDeploy = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 2000));
    deploy();
    setLoading(false);
  };

  return (
    <div className="p-8 space-y-12 pb-32 max-w-6xl mx-auto relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 pointer-events-none opacity-5">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/20 blur-[100px] rounded-full" />
        <div className="absolute animate-pulse bottom-0 left-0 w-[300px] h-[300px] bg-primary/10 blur-[80px] rounded-full" />
      </div>

      <div className="flex flex-col gap-2 text-center items-center relative z-10">
        <motion.div 
          initial={{ opacity: 0, scale: 0.8, rotateY: -180 }}
          animate={{ opacity: 1, scale: 1, rotateY: 0 }}
          transition={{ duration: 2.5, ease: "easeOut" }}
          whileHover={{ 
            scale: scaleFactor,
            rotateY: 360,
            transition: { duration: 1.2, ease: "easeInOut" }
          }}
          className="cursor-pointer mb-6 preserve-3d"
          style={{ perspective: "1200px" }}
        >
          <img 
            src="/eagle-logo-removebg.png" 
            alt="Eagle AI" 
            className="h-48 w-auto drop-shadow-[0_20px_50px_rgba(0,0,0,0.25)] filter contrast-125" 
          />
        </motion.div>
        
        <div className="space-y-4 max-w-3xl px-6">
          <h1 className="text-6xl font-black tracking-tighter text-foreground leading-none">
            EAGLEAI <span className="text-primary italic text-4xl">ST-Edition</span>
          </h1>
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-[0.4em] leading-relaxed opacity-60">
            Intelligent Predictive Preventive Maintenance for Industrial Stations<br/> 
            <span className="text-primary/70">-- Standard Type Multi-Machine Fleet -- Version 1.3.1</span>
          </h2>
        </div>
        
        <div className="h-1 w-48 bg-gradient-to-r from-transparent via-primary to-transparent rounded-full mt-8 shadow-[0_0_20px_rgba(var(--primary),0.2)]" />
      </div>

      {/* Tayal Branding */}
      <div className="flex items-center justify-center gap-12 py-8 opacity-70 hover:opacity-100 transition-all duration-700">
         <img src="/tayal-logo.png" alt="Tayal S.P.A" className="h-16 w-auto" />
         <div className="h-12 w-[1px] bg-border" />
         <div className="flex flex-col">
            <span className="text-xs font-black uppercase tracking-[0.3em]">Engined for</span>
            <span className="text-xl font-black tracking-tighter">TAYAL S.P.A</span>
            <span className="text-[10px] font-bold text-muted-foreground uppercase italic opacity-60 text-right">Algerian Textile</span>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="space-y-6">
          <Section icon={Rocket} title="Eagle Framework Mission" />
          <p className="text-sm text-muted-foreground leading-relaxed font-medium">
            The Eagle Framework is a local-first, AI-powered predictive maintenance suite designed to revolutionize industrial uptime.
            By combining high-performance Polars data processing with time-series foundation models like TinyTimeMixer, we deliver 
            unprecedented accuracy for Rieter G36 machine fleets.
          </p>
          
          <div className="flex gap-4">
             <div className="flex-1 bg-secondary p-4 rounded-2xl border border-border shadow-sm">
                <span className="text-[10px] font-black uppercase text-muted-foreground mb-1 block">Station Latency</span>
                <span className="text-xl font-black text-primary">0 ms</span>
                <p className="text-[10px] font-bold opacity-60">Edge Computing Only</p>
             </div>
             <div className="flex-1 bg-secondary p-4 rounded-2xl border border-border shadow-sm">
                <span className="text-[10px] font-black uppercase text-muted-foreground mb-1 block">Data Residency</span>
                <span className="text-xl font-black text-primary italic lowercase">Local</span>
                <p className="text-[10px] font-bold opacity-60">Zero Cloud Exposure</p>
             </div>
          </div>
        </div>

        <div className="space-y-6">
           <Section icon={Cpu} title="Industrial AI Stack" />
           <p className="text-sm text-muted-foreground leading-relaxed font-medium">
             The **ST Edition** is specialized for Rieter G36 Machines. It features optimized inference paths 
             for Spinning Machine dynamics and shift-level predictive analysis.
           </p>
           
           <div className="space-y-3">
             <FutureItem title="Edition M (Multi-Type)" color="text-amber-500" hoverDesc="Hybrid fleet orchestration for mixed-brand spinning machines." />
             <FutureItem title="Edition A (Autonomous)" color="text-blue-500" hoverDesc="Self-healing neural loops with automated torque adjustment." />
             <FutureItem title="Edition U (Unlimited)" color="text-emerald-500" hoverDesc="Unlimited G36 station clusters with global edge synchronization." />
             <FutureItem title="Edition F (Foundry)" color="text-rose-500" hoverDesc="High-temperature hardened inference for smelting and foundry telemetry." />
           </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-primary/10 rounded-lg flex items-center justify-center">
            <ShieldCheck className="h-4 w-4 text-primary" />
          </div>
          <h2 className="text-xs font-black uppercase tracking-widest">Available Framework Editions</h2>
        </div>
        <div className="h-1 w-24 bg-primary/20 rounded-full" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <EditionCard 
          title="ST-Edition" 
          desc="Standard industrial deployment for single-fleet monitoring and basic telemetry." 
          active 
          hoverDesc="The base engine optimized for Rieter G36 stations, featuring core TTM inference and native state management."
        />
        <EditionCard 
          title="PRO-Edition" 
          desc="Advanced multi-horizon predictive engine with automated shift rotation analysis." 
          hoverDesc="Unlocks full model fine-tuning adapters, multi-tenant database support, and high-fidelity CSV/Excel ingestion pipelines."
        />
        <EditionCard 
          title="ENTERPRISE" 
          desc="High-availability cluster management with neural drift detection and API bridges." 
          hoverDesc="Maximum performance with distributed inference, unlimited fleet scaling, and 24/7 dedicated industrial support."
        />
      </div>

      {/* Developer Card */}
      <div className="bg-card border-2 border-border/40 rounded-[2.5rem] p-10 shadow-[0_20px_50px_rgba(0,0,0,0.05)] flex flex-col md:flex-row items-center gap-10 relative overflow-hidden group/devcard">
         <div className="absolute top-0 right-0 p-8 opacity-5 group-hover/devcard:rotate-12 transition-transform duration-700">
            <Globe className="h-48 w-48" />
         </div>
         
         <div className="h-40 w-40 rounded-[2rem] border-4 border-primary/20 overflow-hidden shrink-0 shadow-2xl relative z-10 transition-all duration-700 hover:scale-110 cursor-help peer">
            <img src="/devoloper.jpg" alt="Abdelkader Berassil" className="h-full w-full object-cover" />
            
            {/* Developer Bio Overlay */}
            <div className="absolute inset-0 bg-primary/90 opacity-0 group-hover/devcard:opacity-100 transition-opacity duration-500 flex flex-col justify-center p-6 text-center">
               <h3 className="text-[10px] font-black uppercase text-primary-foreground mb-2 border-b border-primary-foreground/30 pb-2">Technical Bio</h3>
               <p className="text-[10px] font-bold text-primary-foreground leading-relaxed italic">
                 "Architect of the Eagle G36 Neural Bridge. Specializing in high-performance industrial telemetry and edge-AI integration."
               </p>
            </div>
         </div>
         
         <div className="flex-1 space-y-4 relative z-10">
            <div>
              <h2 className="text-3xl font-black uppercase tracking-tight">Abdelkader Berassil</h2>
              <p className="text-xs font-black uppercase text-primary tracking-[0.2em] opacity-80">Full-Stack Architect & Industrial AI Expert</p>
            </div>
            
            <p className="text-xs text-muted-foreground font-medium leading-relaxed italic pr-12">
              "Developing next-generation zero-latency AI engines for the global textile industry, 
              ensuring 100% uptime through predictive intelligence."
            </p>
            
            <div className="flex flex-wrap gap-4 pt-4 border-t border-border/50">
               <ContactItem icon={Mail} text="berassil.abdelkader@gmail.com" />
               <ContactItem icon={Phone} text="0561760937" />
            </div>
         </div>
      </div>

      {/* Production Deploy Trigger (Only in Test Mode and if NOT hidden) */}
      {status === 'not_deployed' && localStorage.getItem('eagle_hide_deploy') !== 'true' && (
        <div className="flex flex-col items-center gap-4 py-8 bg-primary/5 rounded-[3rem] border-2 border-dashed border-primary/20 animate-pulse-slow">
           <div className="flex flex-col items-center text-center px-8">
              <ShieldCheck className="h-10 w-10 text-primary mb-2" />
              <h3 className="text-xl font-black uppercase tracking-widest text-primary">Ready for Production?</h3>
              <p className="text-xs font-bold text-muted-foreground uppercase mt-1">Activate the full 180-day industrial deployment cycle</p>
           </div>
           <button 
             onClick={handleDeploy}
             disabled={loading}
             className="px-12 py-4 bg-primary text-primary-foreground font-black text-sm rounded-2xl hover:bg-primary/90 transition-all active:scale-95 shadow-xl shadow-primary/20 flex items-center gap-3 disabled:opacity-50"
           >
             {loading ? <div className="h-5 w-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : <><Rocket className="h-5 w-5" /> INITIALIZE 180-DAY DEPLOYMENT</>}
           </button>
        </div>
      )}

      <div className="text-center opacity-40 text-[10px] font-black uppercase tracking-[0.5em] pt-12 space-y-2">
        <div>© 2026 RIETER G36 INTEGRATION — ALL RIGHTS RESERVED</div>
        <div className="text-primary italic">Engineered for TAYAL S.P.A Textile Intelligence</div>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title }: any) {
  return (
    <div className="flex items-center gap-4">
       <div className="h-12 w-12 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/10">
         <Icon className="h-6 w-6 text-primary" />
       </div>
       <h2 className="text-xl font-black uppercase tracking-tight">{title}</h2>
    </div>
  );
}

function FutureItem({ title, color, hoverDesc }: { title: string, color: string, hoverDesc?: string }) {
  const [isHovered, setIsHovered] = React.useState(false);
  
  return (
    <div 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="flex items-center justify-between p-4 bg-secondary/30 rounded-2xl border border-border/50 group hover:bg-secondary transition-all cursor-help relative overflow-hidden"
    >
       <span className="text-xs font-black uppercase tracking-widest opacity-70">{title}</span>
       <span className={cn("text-[8px] font-black px-2 py-0.5 rounded border border-current opacity-40 group-hover:opacity-100", color)}>STAGED</span>
       
       {/* Future Edition Tooltip */}
       <div className={cn(
         "absolute inset-0 bg-secondary flex items-center px-4 transition-all duration-500 transform translate-y-full opacity-0",
         isHovered && "translate-y-0 opacity-100"
       )}>
         <p className="text-[9px] font-bold text-muted-foreground italic leading-tight">
           {hoverDesc}
         </p>
       </div>
    </div>
  );
}

function ContactItem({ icon: Icon, text }: any) {
  return (
    <div className="flex items-center gap-2 bg-secondary/50 px-4 py-2 rounded-xl text-xs font-bold border border-border/50 text-foreground/80">
       <Icon className="h-3.5 w-3.5 text-primary" />
       {text}
    </div>
  );
}

function EditionCard({ title, desc, active = false, hoverDesc }: { title: string, desc: string, active?: boolean, hoverDesc?: string }) {
  const [isHovered, setIsHovered] = React.useState(false);
  
  return (
    <div 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "p-6 rounded-[2rem] border-2 transition-all duration-500 relative group overflow-hidden cursor-help",
        active 
          ? "bg-primary text-primary-foreground border-primary shadow-xl scale-105 z-10" 
          : "bg-card border-border hover:border-primary/40 text-foreground"
      )}
    >
      {active && (
        <div className="absolute top-4 right-4 h-2 w-2 rounded-full bg-primary-foreground animate-ping" />
      )}
      <h3 className="text-sm font-black uppercase tracking-widest mb-2">{title}</h3>
      <p className="text-[10px] opacity-70 font-medium leading-relaxed">{desc}</p>
      
      {/* Hover Description Tooltip Overlay */}
      <div className={cn(
        "absolute inset-0 bg-primary flex flex-col justify-center p-6 transition-all duration-500 transform translate-y-full opacity-0 pointer-events-none",
        isHovered && "translate-y-0 opacity-100"
      )}>
         <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-primary-foreground border-b border-primary-foreground/20 pb-2">Technical Intel</h3>
         <p className="text-[11px] font-bold text-primary-foreground/90 leading-relaxed italic">
           "{hoverDesc}"
         </p>
      </div>
    </div>
  );
}
