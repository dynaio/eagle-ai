import React, { useEffect } from 'react';
import { 
  LayoutDashboard, 
  Zap, 
  Settings, 
  Info, 
  Key, 
  ShieldAlert,
  Rocket,
  Bell,
  Hammer
} from 'lucide-react';
import { useLicense } from '@/hooks/useLicense';
import { cn } from '@/lib/utils';
import { NavLink } from 'react-router-dom';
import { useIndustrialState } from '@/hooks/useIndustrialState';
import { motion } from 'framer-motion';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Enforce Light Theme (Industrial Request)
  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);
  const { state, baseUrl, refetch } = useIndustrialState();
  const { status, daysRemaining, deploy, resetLicense, isExpired } = useLicense();
  const port = baseUrl?.split(':').pop();
  const [loading, setLoading] = React.useState(false);
  const telemetry = { ram: '1.2 GB', storage: '4.8 GB' };
  const [lastTotalCount, setLastTotalCount] = React.useState(0);
  const [lastProcessingState, setLastProcessingState] = React.useState(false);
  const [isBellOpen, setIsBellOpen] = React.useState(false);
  const [isPinned, setIsPinned] = React.useState(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const notifications = state?.notifications || [];
  const unreadCount = notifications.filter((n: any) => !n.read).length;

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audioRef.current.volume = 0.5;
    }
    // Play on any new incoming notification
    if (notifications.length > lastTotalCount) {
      const latest = notifications[0];
      if (latest?.type === 'success' && latest?.message?.includes('Roadmap updated')) {
        // Double alert for training completion
        audioRef.current.play().catch(() => {});
        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(() => {});
          }
        }, 800);
      } else {
        audioRef.current.play().catch(() => {});
      }
    }
    setLastTotalCount(notifications.length);
  }, [notifications.length, lastTotalCount]);

  // Telemetry display is static - no interval needed to avoid re-render spam

  const handleDeploy = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 2000));
    deploy();
    setLoading(false);
  };

  const isTestHidden = localStorage.getItem('eagle_test_mode_hidden') === 'true';
  const isContactHidden = localStorage.getItem('eagle_contact_hidden') === 'true';
  const isDeployDisabled = localStorage.getItem('eagle_hide_deploy') === 'true';

  // Auto-refresh when processing completes
  React.useEffect(() => {
    if (lastProcessingState && !state?.is_processing) {
      console.log("[EagleAI] Training complete. Auto-refreshing UI...");
      refetch();
    }
    setLastProcessingState(state?.is_processing || false);
  }, [state?.is_processing, lastProcessingState, refetch]);

  const navItems = isExpired 
    ? [
        { name: 'ABOUT', path: '/about', icon: Info },
        ...(!isContactHidden ? [{ name: 'Contact Developer', path: '/contact', icon: ShieldAlert }] : [])
      ]
    : [
        { name: 'DASHBOARD', path: '/', icon: LayoutDashboard },
        { name: 'MAINTENANCE', path: '/maintenance', icon: Zap },
        { name: 'REPAIR', path: '/repair', icon: Hammer },
        { name: 'UPDATE DATA', path: '/data', icon: Rocket },
        { name: 'SETTINGS', path: '/settings', icon: Settings },
        { name: 'ABOUT', path: '/about', icon: Info },
      ].filter(Boolean);

  // Add Contact Developer only if not active/permanent (and not hidden)
  if (!isExpired && status !== 'permanent' && status !== 'active' && !isContactHidden) {
    navItems.splice(4, 0, { name: 'Contact Developer', path: '/contact', icon: ShieldAlert });
  }

  // Add Activate App if not permanent
  if (!isExpired && status !== 'permanent') {
    navItems.splice(navItems.length - 1, 0, { name: 'ACTIVATE APP', path: '/license', icon: Key });
  }

  // Add Test Mode only if not hidden and not expired
  if (!isExpired && !isTestHidden) {
    navItems.push({ name: 'TEST MODE', path: '/test-mode', icon: ShieldAlert });
  }

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 bg-card border-r border-border flex flex-col flex-shrink-0 z-50">
        <div className="p-6 flex flex-col items-center border-b border-border">
          <div className="relative group/logo cursor-pointer mb-4">
             <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full scale-0 group-hover/logo:scale-150 transition-transform duration-700" />
             <img 
               src="/eagle-logo-removebg.png" 
               alt="Eagle AI" 
               className="h-20 w-auto relative z-10 transition-all duration-[1200ms] ease-in-out group-hover/logo:[transform:rotateY(360deg)_scale(1.5)]" 
             />
          </div>
          <h1 className="text-xl font-black tracking-tighter text-primary">EAGLEAI <span className="text-foreground">ST-Edition</span></h1>
          <p className="text-[10px] text-muted-foreground font-semibold mt-1 tracking-[0.2em] uppercase opacity-70">G36 Predictive Engine</p>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => 
                cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative",
                  isActive 
                    ? "bg-primary/20 text-primary border border-primary/30 shadow-sm" 
                    : "hover:bg-secondary text-muted-foreground hover:text-foreground border border-transparent"
                )
              }
            >
              <item.icon className="h-5 w-5" />
              <span className="text-xs font-black uppercase tracking-tight">{item.name}</span>
            </NavLink>
          ))}
        </nav>

        {/* License Box */}
        <div className="p-4 m-4 bg-secondary/30 rounded-2xl border border-border flex flex-col gap-3 shadow-inner">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">System Integrity</span>
            {status === 'active' || status === 'permanent' ? (
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
            ) : status === 'not_deployed' ? (
              <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse outline outline-offset-2 outline-amber-500/20" />
            ) : (
              <div className="h-2 w-2 rounded-full bg-rose-500" />
            )}
          </div>
          
          {status === 'not_deployed' && !isDeployDisabled ? (
            <div className="flex flex-col gap-2">
               <span className="text-[10px] font-black text-amber-500 uppercase tracking-tighter">INDUSTRIAL EVALUATION</span>
               <button 
                 onClick={handleDeploy}
                 disabled={loading}
                 className="w-full py-2.5 bg-primary text-primary-foreground text-[10px] font-black rounded-xl hover:bg-primary/90 flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 disabled:opacity-50 uppercase"
               >
                 {loading ? (
                   <div className="h-3 w-3 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                 ) : (
                   <><Rocket className="h-3 w-3" /> Initialize Deploy</>
                 )}
               </button>
            </div>
          ) : status === 'not_deployed' && isDeployDisabled ? (
             <div className="text-[10px] font-black text-muted-foreground uppercase opacity-40 italic">Station Awaiting Deployment</div>
          ) : status === 'active' ? (
             <div className="flex flex-col">
               <div className="flex justify-between items-end mb-1">
                 <span className="text-[10px] font-black text-emerald-500 uppercase">{daysRemaining} DAYS REMAINING</span>
                 <span className="text-[8px] font-bold opacity-40">180D CYCLE</span>
               </div>
               <div className="w-full bg-emerald-500/10 h-1.5 rounded-full overflow-hidden border border-emerald-500/10">
                  <div 
                    className="h-full bg-emerald-500 rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(16,185,129,0.5)]" 
                    style={{ width: `${(daysRemaining! / 185) * 100}%` }}
                  />
               </div>
             </div>
          ) : status === 'permanent' ? (
             <div className="flex items-center gap-2 text-primary">
                <ShieldAlert className="h-4 w-4" />
                <span className="text-[10px] font-black uppercase tracking-tighter">Enterprise Activated</span>
             </div>
          ) : (
             <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-rose-500">
                  <ShieldAlert className="h-4 w-4" />
                  <span className="text-[10px] font-black uppercase tracking-tighter text-rose-500">Evaluation Expired</span>
                </div>
                <button 
                  onClick={resetLicense}
                  className="text-[8px] font-black uppercase text-muted-foreground hover:text-primary transition-colors mt-1"
                >
                  Reset Framework Mode
                </button>
             </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-background via-background/95 to-secondary/30">
        <header className="h-16 border-b border-border flex items-center justify-between px-8 bg-card/50 backdrop-blur-md sticky top-0 z-40">
           <div className="flex items-center gap-4">
             <div className="h-8 w-[2px] bg-primary/30 rounded-full hidden md:block" />
             <h2 className="text-xs font-black text-muted-foreground uppercase tracking-[0.3em]">Rieter G36 Station Control</h2>
           </div>
           
           <div className="flex items-center gap-6">
              <div className="flex items-center gap-8 mr-4">
                {/* Notification Bell */}
                <div 
                  className="relative cursor-pointer" 
                  onMouseEnter={() => setIsBellOpen(true)}
                  onMouseLeave={() => {
                    if (!isPinned) setIsBellOpen(false);
                  }}
                  onClick={() => {
                    if (isPinned) setIsBellOpen(false);
                    setIsPinned(!isPinned);
                  }}
                >
                  <div className={cn(
                    "p-2 rounded-xl bg-secondary border border-border transition-all duration-300",
                    (unreadCount > 0) || isBellOpen ? "text-primary shadow-[0_0_15px_rgba(var(--primary),0.2)]" : "text-muted-foreground opacity-40"
                   )}>
                    <Bell className={cn("h-5 w-5", state?.is_processing && "animate-bounce")} />
                  </div>
                  {(unreadCount > 0) && (
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1 h-4 w-4 bg-rose-500 rounded-full flex items-center justify-center border-2 border-background"
                    >
                      <span className="text-[8px] font-black text-white leading-none">
                        {unreadCount}
                      </span>
                    </motion.div>
                  )}
                  
                  {/* Notification Dropdown (FIFO last 10) */}
                  <div className={cn(
                    "absolute top-full right-0 mt-4 w-80 bg-card border border-border rounded-2xl shadow-2xl transition-all duration-300 z-50 p-4",
                    isBellOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
                  )}>
                    <div className="flex items-center justify-between mb-4 border-b border-border pb-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Pulse Notifications</span>
                      <button 
                        onClick={async () => {
                          if (baseUrl) {
                            try { await fetch(`${baseUrl}/eagle/notifications/clear`, { method: 'POST' }); } catch(e){}
                            refetch();
                          }
                        }}
                        className="text-[9px] font-bold text-primary hover:underline"
                      >
                        Clear All
                      </button>
                    </div>
                    <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
                      {notifications.length > 0 ? (
                        notifications.map((n: any) => (
                          <div key={n.id} className={cn("flex flex-col gap-1 p-2 rounded-lg", !n.read ? "bg-primary/5 border-l-2 border-primary" : "opacity-60")}>
                            <div className="flex items-center justify-between">
                              <span className={cn(
                                "text-[9px] font-black uppercase",
                                n.type === 'error' ? "text-rose-500" : n.type === 'success' ? "text-emerald-500" : "text-primary"
                              )}>{n.type}</span>
                              <span className="text-[8px] font-medium opacity-40">{new Date(n.timestamp).toLocaleTimeString()}</span>
                            </div>
                            <p className="text-[11px] font-bold leading-tight line-clamp-2">{n.message}</p>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-[10px] font-bold text-muted-foreground uppercase opacity-40 italic">No Active Alerts</div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Neural Engine Progress Indicator */}
                <div className={cn(
                  "flex items-center gap-2 px-4 py-1.5 rounded-full border transition-all duration-500",
                  state?.is_processing 
                    ? "bg-emerald-500/10 border-emerald-500/20 animate-pulse" 
                    : "bg-secondary/40 border-border opacity-40 grayscale"
                )}>
                  <div className={cn(
                    "h-2 w-2 rounded-full",
                    state?.is_processing ? "bg-emerald-500 animate-ping" : "bg-muted-foreground"
                  )} />
                  <span className={cn(
                    "text-[10px] font-black uppercase tracking-tighter",
                    state?.is_processing ? "text-emerald-500" : "text-muted-foreground"
                  )}>
                    {state?.is_processing ? "Neural Engine Training..." : "Engine Idle"}
                  </span>
                </div>

                <div className="flex flex-col items-end border-l border-border/50 pl-8">
                  <span className="text-[9px] font-black text-muted-foreground uppercase opacity-40">RAM Allocation</span>
                  <span className="text-xs font-black text-foreground tracking-tighter">{telemetry.ram}</span>
                </div>
                <div className="flex flex-col items-end border-l border-border/50 pl-8">
                  <span className="text-[9px] font-black text-muted-foreground uppercase opacity-40">Total Storage</span>
                  <span className="text-xs font-black text-foreground tracking-tighter">{telemetry.storage}</span>
                </div>
                <div className="flex flex-col items-end border-l border-border/50 pl-8">
                  <span className="text-[9px] font-black text-muted-foreground uppercase opacity-40">Local Feed</span>
                  <span className="text-xs font-black text-emerald-500 tracking-tighter">PORT-{port || '...'} (ALIVE)</span>
                </div>
              </div>
               <div className="h-10 w-10 rounded-2xl bg-secondary border border-border flex items-center justify-center shadow-sm overflow-hidden group/toplogo">
                  <img 
                    src="/eagle-logo-removebg.png" 
                    className="h-6 w-6 opacity-40 transition-transform duration-[2000ms] ease-in-out animate-[rotatePeriodic_60s_ease-in-out_infinite]" 
                    alt="System" 
                  />
               </div>
           </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar relative">
          {children}
          
          <div className="mt-20 pb-10 px-8 opacity-40">
             <div className="h-[1px] w-full bg-border mb-4" />
             <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] text-center max-w-4xl mx-auto leading-relaxed">
               Industrial Note: Predictions are based on historical machine registry and telemetry. system is under evaluation. results must be validated by on-site technicians before maintenance.
             </p>
          </div>
        </div>
      </main>
    </div>
  );
}
