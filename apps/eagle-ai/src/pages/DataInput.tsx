import { useState, useRef } from 'react';
import { Upload, Clock, Activity, FileType, Database, Zap, ShieldCheck, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { IndustrialDialog } from '@/components/ui/IndustrialDialog';
import { useIndustrialState } from '@/hooks/useIndustrialState';
import { cn } from '@/lib/utils';

export default function DataInput() {
  const { state, saveState, baseUrl } = useIndustrialState();
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [sessionId] = useState(() => localStorage.getItem('eagle_session_id') || uuidv4());

  const [dialog, setDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: 'primary' | 'danger' | 'success';
  }>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'primary'
  });

  const isSpiderWebActive = state?.settings?.database_settings?.spider_web_active || false;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isSpiderWebActive) return;
    const file = e.target.files?.[0];
    if (!file || !baseUrl) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${baseUrl}/data/handler`, {
        method: 'POST',
        headers: {
          'X-Session-ID': sessionId
        },
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        window.dispatchEvent(new Event('eagle-refresh'));
        setDialog({
          isOpen: true,
          title: 'Knowledge Ingested',
          message: `Success: ${file.name} has been processed and saved as ${data.saved_as}. Total ${data.rows} rows synchronized.`,
          variant: 'success'
        });
      } else {
        const error = await res.json();
        setDialog({
          isOpen: true,
          title: 'Ingestion Failed',
          message: `System Error: ${error.detail || 'Unknown data format'}`,
          variant: 'danger'
        });
      }
    } catch (err) {
      console.error(err);
      setDialog({
        isOpen: true,
        title: 'Network Error',
        message: 'Could not establish connection with the industrial backend server.',
        variant: 'danger'
      });
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleSpiderWeb = async () => {
    if (!state) return;
    const newStatus = !isSpiderWebActive;
    
    setLoading(true);
    
    // If activating, we should ideally verify if configuration exists
    if (newStatus) {
      const config = state.settings?.database_settings;
      if (!config?.host || !config?.username) {
        setDialog({
          isOpen: true,
          title: 'Configuration Missing',
          message: 'Neural bridge cannot be established without valid host and identity credentials. Please configure Spider Web in Settings.',
          variant: 'danger'
        });
        setLoading(false);
        return;
      }
    }

    const newState = {
      ...state,
      settings: {
        ...state.settings,
        database_settings: {
          db_type: state.settings.database_settings?.db_type || 'SQL Server',
          host: state.settings.database_settings?.host || 'localhost',
          username: state.settings.database_settings?.username || '',
          password: state.settings.database_settings?.password || '',
          update_interval: state.settings.database_settings?.update_interval || 30,
          selected_tables: state.settings.database_settings?.selected_tables || [],
          spider_web_active: newStatus
        }
      }
    };
    
    const success = await saveState(newState as any);
    if (success) {
      setDialog({
        isOpen: true,
        title: newStatus ? 'Protocol Acknowledged' : 'Link Deactivated',
        message: newStatus 
          ? 'SUCCESS: The Spider Web neural bridge is now active. All industrial telemetry will be synchronized automatically. Manual ingestion is locked.' 
          : 'NOTICE: The live link has been severed. Manual dataset ingestion protocols have been restored.',
        variant: 'success'
      });
    } else {
      setDialog({
        isOpen: true,
        title: 'Neural Sync Failure',
        message: 'CRITICAL: Failed to commit the protocol change to the local state engine. Please check your connection.',
        variant: 'danger'
      });
    }
    setLoading(false);
  };

  const triggerFileBrowser = () => {
    if (isSpiderWebActive) return;
    fileInputRef.current?.click();
  };

  return (
    <>
      <div className="p-8 space-y-8 pb-32 max-w-5xl mx-auto">
        <div className="flex flex-col gap-2">
          <h1 className="text-sm font-black tracking-[0.4em] text-muted-foreground uppercase opacity-80">
            KNOWLEDGE UPDATE & TELEMETRY INGESTION
          </h1>
          <div className="h-1 w-32 bg-primary rounded-full mt-1" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Manual Import Section */}
          <div className="lg:col-span-2 space-y-6">
             <div className="px-2">
                <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Manual Source Ingest</h2>
             </div>
              <motion.div 
                whileHover={isSpiderWebActive ? {} : { borderColor: 'rgb(16 185 129 / 0.5)', boxShadow: '0 25px 50px -12px rgb(16 185 129 / 0.15)' }}
                className={cn(
                  "relative overflow-hidden bg-card border-2 rounded-[2.5rem] p-8 flex flex-col gap-6 transition-all duration-300",
                  isSpiderWebActive 
                    ? "border-border/30 cursor-not-allowed opacity-40 grayscale" 
                    : "border-dashed border-border cursor-pointer hover:border-emerald-500/50 active:scale-[0.98]"
                )}
                onClick={triggerFileBrowser}
              >
                {isSpiderWebActive && (
                  <div className="absolute inset-0 bg-background/20 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center p-6 text-center">
                     <div className="bg-rose-500/10 border border-rose-500/20 px-6 py-3 rounded-2xl flex items-center gap-3 animate-pulse shadow-xl shadow-rose-500/10">
                        <AlertCircle className="h-5 w-5 text-rose-500" />
                        <span className="text-[10px] font-black uppercase text-rose-500 tracking-tighter">Ingest Locked (Live DB Active)</span>
                     </div>
                  </div>
                )}

                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept=".csv,.xlsx,.xls" 
                  onChange={handleFileSelect}
                  disabled={isSpiderWebActive}
                />
                
                <div className="flex items-start justify-between">
                   <div className={cn("p-4 rounded-2xl transition-all", isSpiderWebActive ? "bg-muted" : "bg-emerald-500/10")}>
                      <Upload className={cn("h-6 w-6", isSpiderWebActive ? "text-muted-foreground" : "text-emerald-500")} />
                   </div>
                   <div className={cn(
                     "px-3 py-1 rounded-full text-[8px] font-black uppercase border",
                     isSpiderWebActive ? "bg-secondary text-muted-foreground" : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-sm"
                   )}>
                      {isSpiderWebActive ? 'Manual Locked' : 'Local Workspace'}
                   </div>
                </div>

                <div className="space-y-1">
                   <h3 className="text-xl font-black tracking-tight uppercase">Import Shift Dataset</h3>
                   <p className="text-[10px] text-muted-foreground font-medium leading-relaxed opacity-80">
                     Synchronize G36 station metrics via specialized .CSV or Rieter-formatted Excel workbooks. High-fidelity ingestion engine.
                   </p>
                </div>

                <div className={cn(
                  "w-full py-4 text-[10px] font-black uppercase rounded-2xl shadow-xl transition-all duration-500 text-center flex items-center justify-center gap-2",
                  isSpiderWebActive 
                    ? "bg-secondary text-muted-foreground opacity-50" 
                    : "bg-emerald-500 text-emerald-foreground hover:bg-emerald-600 shadow-emerald-500/20"
                )}>
                   {loading && !isSpiderWebActive ? (
                     <div className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                   ) : <FileType className="h-4 w-4" />}
                   Browse Workspace
                </div>
              </motion.div>
          </div>

          {/* Connection Status & Live Link */}
          <div className="space-y-6">
             <div className="px-2">
                <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Connection Cluster</h2>
             </div>
             
             {/* Dynamic DB Connector (Spider Web) */}
             <div className={cn(
               "relative overflow-hidden bg-card border-2 p-8 rounded-[2.5rem] flex flex-col gap-6 shadow-sm transition-all",
               isSpiderWebActive ? "border-emerald-500/50 shadow-emerald-500/10" : "border-border"
             )}>
                <div className="absolute -top-12 -right-12 h-32 w-32 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
                
                <div className="flex items-start justify-between">
                   <div className={cn("p-4 rounded-2xl transition-all", isSpiderWebActive ? "bg-emerald-500/10" : "bg-secondary")}>
                      <Database className={cn("h-6 w-6", isSpiderWebActive ? "text-emerald-500" : "text-primary")} />
                   </div>
                   <div className={cn(
                     "px-3 py-1 rounded-full text-[8px] font-black uppercase border",
                     isSpiderWebActive ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-secondary text-muted-foreground"
                   )}>
                      {isSpiderWebActive ? 'Active Link' : 'Standby'}
                   </div>
                </div>

                <div className="space-y-1">
                   <h3 className="text-lg font-black tracking-tight uppercase">Spider Web DB</h3>
                   <p className="text-[10px] text-muted-foreground font-medium leading-relaxed">
                     Automated industrial telemetry sync via specialized Spider Web protocol.
                   </p>
                </div>

                <button 
                  onClick={toggleSpiderWeb}
                  disabled={loading}
                  className={cn(
                    "w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 active:scale-95",
                    isSpiderWebActive 
                      ? "bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500 hover:text-white" 
                      : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white"
                  )}
                >
                   {loading && isSpiderWebActive ? (
                     <div className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                   ) : isSpiderWebActive ? (
                     <Zap className="h-4 w-4" />
                   ) : (
                     <Activity className="h-4 w-4" />
                   )}
                   {isSpiderWebActive ? 'Sever Connection' : 'Establish Live Link'}
                </button>
             </div>

             {/* Status Card */}
             <div className="bg-secondary/30 border border-border/50 p-6 rounded-[2.5rem] space-y-4">
                <div className="flex items-center gap-4">
                   <div className="p-3 bg-secondary rounded-xl">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                   </div>
                    <div className="flex flex-col">
                       <span className="text-[9px] font-black text-muted-foreground uppercase opacity-60 font-mono">Telemetry Last Sync</span>
                       <span className="text-sm font-black tracking-tighter">
                         {state?.last_updated ? new Date(state.last_updated).toLocaleString(undefined, { 
                           month: 'short', day: 'numeric', year: 'numeric', 
                           hour: '2-digit', minute: '2-digit' 
                         }) : 'Disconnected'}
                       </span>
                    </div>
                </div>

                {isSpiderWebActive ? (
                   <div className="flex items-center gap-3 p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/20">
                      <ShieldCheck className="h-4 w-4 text-emerald-500" />
                      <span className="text-[9px] font-black uppercase text-emerald-500">Integrity Check Optimal</span>
                   </div>
                ) : (
                   <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-xl border border-primary/20">
                      <Activity className="h-4 w-4 text-primary" />
                      <span className="text-[9px] font-black uppercase text-primary">Awaiting Feed Ingress</span>
                   </div>
                )}
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <IntegrationStub title="ERP Direct Connector" icon={Zap} />
            <IntegrationStub title="ShiftLog AI Ingest" icon={FileType} />
            <IntegrationStub title="Legacy DB Bridge" icon={Database} />
        </div>
      </div>

      <IndustrialDialog 
        isOpen={dialog.isOpen}
        onClose={() => setDialog({ ...dialog, isOpen: false })}
        title={dialog.title}
        message={dialog.message}
        variant={dialog.variant}
      />
    </>
  );
}

function IntegrationStub({ title, icon: Icon }: any) {
  return (
    <div className="p-5 bg-card border border-border rounded-3xl flex items-center justify-between opacity-30 grayscale pointer-events-none group">
       <div className="flex items-center gap-4">
         <div className="p-2 bg-secondary rounded-xl">
           <Icon className="h-4 w-4" />
         </div>
         <h3 className="text-[10px] font-black uppercase tracking-widest">{title}</h3>
       </div>
       <span className="text-[8px] font-black bg-secondary p-1 px-3 rounded-full opacity-50 uppercase tracking-tighter">Encrypted Port</span>
    </div>
  );
}
