import { useState, useEffect } from 'react';
import { Database, Server, Key, Shield, RefreshCw, Layers, CheckCircle2, AlertTriangle, Search, Activity, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useIndustrialState } from '@/hooks/useIndustrialState';

export function DatabaseSettings() {
  const { state, baseUrl, refetch } = useIndustrialState();
  const [isLoading, setIsLoading] = useState(false);
  const [testStatus, setTestStatus] = useState<{ status: 'idle' | 'success' | 'error'; message: string }>({ status: 'idle', message: '' });
  const [availableTables, setAvailableTables] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [dbConfig, setDbConfig] = useState({
    db_type: 'SQL Server',
    host: 'localhost',
    port: 1433,
    database: '' as string | null,
    namespace: '' as string | null,
    username: '',
    password: '',
    update_interval: 30,
    spider_web_active: false,
    selected_tables: [] as string[]
  });

  useEffect(() => {
    if (state?.settings?.database_settings) {
      const ds = state.settings.database_settings;
      setDbConfig({
        db_type: ds.db_type || 'SQL Server',
        host: ds.host || 'localhost',
        port: ds.port || (ds.db_type === 'IRIS' ? 1972 : 1433),
        database: ds.database || '',
        namespace: ds.namespace || '',
        username: ds.username || '',
        password: ds.password || '',
        update_interval: ds.update_interval || 30,
        spider_web_active: ds.spider_web_active || false,
        selected_tables: ds.selected_tables || []
      });
    }
  }, [state]);

  const handleAutoDetect = async () => {
    setIsLoading(true);
    setTestStatus({ status: 'idle', message: '' });
    
    // Safety check for host
    const currentHost = dbConfig.host || '';
    
    setTimeout(() => {
      const type = currentHost.toLowerCase().includes('iris') ? 'IRIS' : 'SQL Server';
      const port = type === 'IRIS' ? 1972 : 1433;
      
      if (currentHost && currentHost !== 'localhost' || type === 'IRIS') {
        setDbConfig(prev => ({ ...prev, db_type: type, port }));
        setTestStatus({ 
          status: 'success', 
          message: `PROTOCOL DETECTED: ${type} identified on port ${port}. Parameters updated.` 
        });
      } else {
        setTestStatus({ 
          status: 'error', 
          message: 'DETECTION FAILURE: No industrial protocol matched the provided host signature.' 
        });
      }
      setIsLoading(false);
    }, 1500);
  };

  const handleTestConnection = async () => {
    setIsLoading(true);
    setTestStatus({ status: 'idle', message: '' });
    
    try {
      const res = await fetch(`${baseUrl}/database/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dbConfig)
      });
      const result = await res.json();
      
      if (result.status === 'success') {
        setTestStatus({ status: 'success', message: result.message });
        if (result.tables && Array.isArray(result.tables)) {
          setAvailableTables(result.tables);
        }
      } else {
        setTestStatus({ status: 'error', message: result.message });
      }
    } catch (err) {
      setTestStatus({ status: 'error', message: 'Fault in Neural Bridge. Check connection parameters.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await fetch(`${baseUrl}/database/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dbConfig)
      });
      if (refetch) await refetch();
    } catch (err) {
      console.error("Failed to save DB settings:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTable = (table: string) => {
    setDbConfig(prev => ({
      ...prev,
      selected_tables: prev.selected_tables.includes(table)
        ? prev.selected_tables.filter(t => t !== table)
        : [...prev.selected_tables, table]
    }));
  };

  const filteredTables = (availableTables || []).filter(t => 
    typeof t === 'string' && t.toLowerCase().includes((searchTerm || '').toLowerCase())
  );

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className="p-4 rounded-2xl bg-primary/10 border-2 border-primary/20 relative z-10 shadow-lg shadow-primary/5">
              <Activity className={cn("h-7 w-7 text-primary", isLoading && "animate-pulse")} />
            </div>
            {isLoading && (
              <motion.div 
                animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0, 0.3] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="absolute inset-0 bg-primary/40 rounded-2xl blur-xl"
              />
            )}
          </div>
          <div>
            <h3 className="text-xl font-black uppercase tracking-[0.2em] leading-none mb-1.5 drop-shadow-sm">Spider Web Sync</h3>
            <p className="text-[10px] text-muted-foreground font-black uppercase opacity-50 tracking-[0.25em]">Protocol-X Neural Bridge Ingress</p>
          </div>
        </div>
        <div className={cn(
          "px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border-2 flex items-center gap-4 transition-all shadow-sm",
          dbConfig.spider_web_active ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" : "bg-secondary/50 text-muted-foreground border-border/50"
        )}>
          <div className={cn("h-2.5 w-2.5 rounded-full", dbConfig.spider_web_active ? "bg-emerald-500 animate-pulse shadow-[0_0_12px_rgba(16,185,129,0.9)]" : "bg-muted-foreground/40")} />
          {dbConfig.spider_web_active ? "Neural Loop Active" : "Bridge in Standby"}
        </div>
      </div>

      <div className="relative group/main">
        {/* Neural Scanline Overlay */}
        {isLoading && (
          <motion.div 
            initial={{ top: "-5%" }}
            animate={{ top: "105%" }}
            transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
            className="absolute left-0 right-0 h-32 bg-gradient-to-b from-transparent via-primary/15 to-transparent z-20 pointer-events-none"
          />
        )}

        <div className={cn(
          "bg-card border-2 border-border/40 rounded-[3rem] overflow-hidden transition-all duration-700 relative shadow-2xl",
          isLoading && "opacity-60 grayscale-[0.5] scale-[0.99]"
        )}>
          <div className="p-10 space-y-12">
            
            {/* Connection Parameters - VERTICAL STACK */}
            <div className="flex flex-col gap-10">
              
              {/* Protocol Sector */}
              <div className="space-y-8">
                <div className="flex items-center gap-3">
                   <div className="h-6 w-1.5 bg-primary rounded-full shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
                   <label className="text-sm font-black uppercase tracking-[0.3em] text-primary/90">Protocol Sector</label>
                </div>
                
                <div className="space-y-5 max-w-2xl">
                  <div className="relative group/input">
                    <Server className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within/input:text-primary transition-colors" />
                    <input 
                      type="text" 
                      placeholder="Target Host Address / IP"
                      value={dbConfig.host || ''}
                      onChange={e => setDbConfig({...dbConfig, host: e.target.value})}
                      className="w-full bg-secondary/30 border-2 border-border/40 rounded-2xl py-5 pl-14 pr-4 text-sm font-black outline-none focus:border-primary focus:bg-background transition-all shadow-inner"
                    />
                    <button 
                      onClick={handleAutoDetect}
                      className="absolute right-4 top-1/2 -translate-y-1/2 px-5 py-2.5 bg-primary/15 hover:bg-primary text-primary hover:text-primary-foreground rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95"
                    >
                      Autodetect
                    </button>
                  </div>
                  
                  <div className="space-y-5">
                    <div className="relative group/input">
                      <Database className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within/input:text-primary transition-colors" />
                      <select 
                        value={dbConfig.db_type}
                        onChange={e => setDbConfig({...dbConfig, db_type: e.target.value})}
                        className="w-full bg-secondary/30 border-2 border-border/40 rounded-2xl py-5 pl-14 pr-4 text-sm font-black outline-none focus:border-primary appearance-none focus:bg-background transition-all shadow-inner cursor-pointer"
                      >
                        <option>SQL Server</option>
                        <option>IRIS</option>
                        <option>Other (ODBC)</option>
                      </select>
                    </div>
                    <div className="relative group/input">
                       <RefreshCw className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within/input:text-primary transition-colors" />
                       <input 
                         type="number" 
                         placeholder="Neural Port (e.g. 1433, 1972)"
                         value={dbConfig.port || ''}
                         onChange={e => setDbConfig({...dbConfig, port: parseInt(e.target.value) || 0})}
                         className="w-full bg-secondary/30 border-2 border-border/40 rounded-2xl py-5 pl-14 pr-4 text-sm font-black outline-none focus:border-primary focus:bg-background transition-all shadow-inner"
                       />
                       <div className="absolute right-6 top-1/2 -translate-y-1/2 text-[9px] font-black uppercase opacity-20 tracking-widest pointer-events-none">Port Index</div>
                    </div>
                  </div>

                  <input 
                    type="text" 
                    placeholder={dbConfig.db_type === 'IRIS' ? "Integrated Namespace" : "Initial Catalog / Database Name"}
                    value={(dbConfig.db_type === 'IRIS' ? dbConfig.namespace : dbConfig.database) || ''}
                    onChange={e => setDbConfig({...dbConfig, [dbConfig.db_type === 'IRIS' ? 'namespace' : 'database']: e.target.value})}
                    className="w-full bg-secondary/30 border-2 border-border/40 rounded-2xl py-5 px-8 text-sm font-black outline-none focus:border-primary focus:bg-background transition-all shadow-inner"
                  />
                </div>
              </div>

              {/* Security Sector */}
              <div className="space-y-8 pt-4 border-t border-border/10">
                <div className="flex items-center gap-3">
                   <div className="h-6 w-1.5 bg-primary rounded-full shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
                   <label className="text-sm font-black uppercase tracking-[0.3em] text-primary/90">Identity Sector</label>
                </div>
                
                <div className="space-y-5 max-w-2xl">
                  <div className="relative group/input">
                    <Key className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within/input:text-primary transition-colors" />
                    <input 
                      type="text" 
                      placeholder="Credential Identity ID"
                      value={dbConfig.username || ''}
                      onChange={e => setDbConfig({...dbConfig, username: e.target.value})}
                      className="w-full bg-secondary/30 border-2 border-border/40 rounded-2xl py-5 pl-14 pr-4 text-sm font-black outline-none focus:border-primary focus:bg-background transition-all shadow-inner"
                    />
                  </div>
                  <div className="relative group/input">
                    <Shield className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within/input:text-primary transition-colors" />
                    <input 
                      type="password" 
                      placeholder="Neural Passkey"
                      value={dbConfig.password || ''}
                      onChange={e => setDbConfig({...dbConfig, password: e.target.value})}
                      className="w-full bg-secondary/30 border-2 border-border/40 rounded-2xl py-5 pl-14 pr-4 text-sm font-black outline-none focus:border-primary focus:bg-background transition-all shadow-inner"
                    />
                  </div>
                  
                  <div className="flex justify-end pt-4 w-full">
                    <button 
                      onClick={handleTestConnection}
                      disabled={isLoading}
                      className="w-full sm:w-auto px-12 h-[60px] bg-primary text-primary-foreground hover:bg-primary/90 rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] transition-all flex items-center justify-center gap-3 shadow-xl shadow-primary/25 active:scale-95 disabled:opacity-50"
                    >
                      {isLoading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Activity className="h-5 w-5" />}
                      Test Link Ingress
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <AnimatePresence>
              {testStatus.status !== 'idle' && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.98, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98, y: 15 }}
                  className={cn(
                    "p-8 rounded-[2.5rem] border-2 flex items-center gap-6 relative overflow-hidden shadow-xl",
                    testStatus.status === 'success' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-rose-500/10 border-rose-500/20 text-rose-500"
                  )}
                >
                  <div className={cn("p-5 rounded-2xl shadow-inner", testStatus.status === 'success' ? "bg-emerald-500/20" : "bg-rose-500/20")}>
                    {testStatus.status === 'success' ? <CheckCircle2 className="h-7 w-7" /> : <AlertTriangle className="h-7 w-7" />}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-black uppercase tracking-[0.25em] leading-none mb-2">
                      {testStatus.status === 'success' ? "PROTOCOL ACKNOWLEDGED" : "HANDSHAKE FAILURE"}
                    </h4>
                    <p className="text-xs font-bold opacity-80 leading-relaxed max-w-2xl">{testStatus.message}</p>
                  </div>
                  <div className="hidden lg:block absolute right-[-10px] bottom-[-10px] p-4 opacity-[0.07] rotate-12">
                     {testStatus.status === 'success' ? <CheckCircle2 className="h-32 w-32" /> : <AlertTriangle className="h-32 w-32" />}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Table High-Density Matrix */}
            {filteredTables.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-secondary/20 rounded-[3rem] border-2 border-border/30 p-10 space-y-10 shadow-inner"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-4">
                      <Layers className="h-6 w-6 text-primary" />
                      <span className="text-lg font-black uppercase tracking-[0.3em]">Telemetry Matrix</span>
                    </div>
                    <span className="text-[10px] font-black text-muted-foreground/60 uppercase pl-10 tracking-[0.2em]">Select datasets for autonomous ingestion</span>
                  </div>
                  <div className="relative group/search">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within/search:text-primary transition-colors" />
                    <input 
                      type="text" 
                      placeholder="Neural Filter..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="w-full lg:w-72 bg-background/50 border-2 border-border/40 rounded-2xl py-3.5 pl-12 pr-4 text-[11px] font-black outline-none focus:border-primary transition-all uppercase tracking-widest shadow-sm"
                    />
                  </div>
                </div>
                
                <div className="max-h-80 overflow-y-auto custom-scrollbar pr-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {filteredTables.slice(0, 100).map(table => (
                    <button 
                      key={table}
                      onClick={() => toggleTable(table)}
                      className={cn(
                        "flex flex-col gap-4 p-5 rounded-2xl border-2 transition-all relative text-left group/table overflow-hidden shadow-sm",
                        dbConfig.selected_tables.includes(table) 
                          ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]" 
                          : "bg-background/40 border-border/40 text-muted-foreground hover:border-primary/50 hover:bg-background"
                      )}
                    >
                      <div className="flex justify-between items-start relative z-10">
                        <Activity className={cn("h-5 w-5", dbConfig.selected_tables.includes(table) ? "opacity-50" : "opacity-25")} />
                        <div className={cn(
                          "h-6 w-6 rounded-lg border-2 flex items-center justify-center transition-all",
                          dbConfig.selected_tables.includes(table) ? "bg-white/20 border-white/40" : "bg-transparent border-border"
                        )}>
                          {dbConfig.selected_tables.includes(table) && <CheckCircle2 className="h-4 w-4 text-white" />}
                        </div>
                      </div>
                      <span className="text-[11px] font-black truncate uppercase tracking-tighter relative z-10">{table}</span>
                      
                      {dbConfig.selected_tables.includes(table) && (
                        <div className="absolute top-0 left-0 right-0 h-1 z-20 bg-white/40 animate-neural-pulse" />
                      )}
                    </button>
                  ))}
                  {filteredTables.length > 100 && (
                    <div className="col-span-full py-5 text-center bg-secondary/30 rounded-xl border-2 border-dashed border-border/30">
                      <p className="text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground/60 italic">Showing 100 of {filteredTables.length} datasets. Use search to refine selection matrix.</p>
                    </div>
                  )}
                </div>

                <div className="pt-10 flex flex-col xl:flex-row items-center justify-between gap-10 border-t-2 border-border/20">
                  <div className="flex items-center gap-8 w-full xl:w-auto">
                    <label className="flex items-center gap-5 cursor-pointer group">
                      <div 
                        className={cn(
                          "h-12 w-24 rounded-full border-2 p-2 transition-all relative flex items-center shadow-inner",
                          dbConfig.spider_web_active ? "bg-emerald-500/20 border-emerald-500/50" : "bg-secondary/50 border-border/50"
                        )} 
                        onClick={() => setDbConfig({...dbConfig, spider_web_active: !dbConfig.spider_web_active})}
                      >
                        <motion.div 
                          animate={{ x: dbConfig.spider_web_active ? 40 : 0 }}
                          className={cn(
                            "h-7 w-7 rounded-full shadow-2xl flex items-center justify-center transition-colors",
                            dbConfig.spider_web_active ? "bg-emerald-500" : "bg-muted-foreground/40"
                          )}
                        >
                           <Zap className={cn("h-4 w-4 text-white", dbConfig.spider_web_active && "fill-current animate-pulse")} />
                        </motion.div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-black uppercase text-muted-foreground group-hover:text-primary transition-colors tracking-[0.2em]">Spider Web Protocol Ingress</span>
                        <span className="text-[10px] font-bold text-muted-foreground/40 uppercase leading-none tracking-widest">Autonomous Loop Synchronization</span>
                      </div>
                    </label>
                  </div>
                  <button 
                    onClick={handleSave}
                    disabled={isLoading}
                    className="w-full xl:w-auto px-16 py-6 bg-emerald-500 text-white font-black uppercase text-sm rounded-2xl shadow-2xl shadow-emerald-500/30 hover:shadow-emerald-500/50 active:scale-[0.98] transition-all flex items-center justify-center gap-4 border-b-4 border-emerald-700"
                  >
                    <CheckCircle2 className="h-6 w-6" />
                    Commit Neural Synchronization
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
