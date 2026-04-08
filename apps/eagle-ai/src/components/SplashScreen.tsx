import { motion } from 'framer-motion';
import { useEffect } from 'react';

export default function SplashScreen({ onFinish }: { onFinish: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onFinish, 7000);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <motion.div 
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: "easeInOut" }}
      className="fixed inset-0 z-[100] bg-white text-[#0f172a] flex flex-col items-center justify-center overflow-hidden"
    >
      {/* Background Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] animate-pulse" />
      </div>

      <div className="relative flex flex-col items-center text-center">
        <div className="relative mb-8">
           <motion.div 
             initial={{ rotateY: -180, opacity: 0, scale: 0.8 }}
             animate={{ rotateY: 0, opacity: 1, scale: 1 }}
             transition={{ duration: 2.0, ease: "easeOut" }}
             className="h-56 w-56 relative"
             style={{ perspective: "1000px" }}
           >
              <img 
                src="/eagle-logo-removebg.png" 
                alt="Eagle AI" 
                className="h-full w-full object-contain relative z-10 drop-shadow-[0_10px_30px_rgba(0,0,0,0.1)]" 
              />
           </motion.div>
        </div>

        <div className="space-y-2">
          <h1 className="text-6xl font-black tracking-tighter uppercase">
            Eagle<span className="text-primary italic">AI</span>
          </h1>
          <p className="text-xs font-black tracking-[0.5em] text-muted-foreground uppercase opacity-60">
            Industrial Predictive Engine
          </p>
        </div>

        <motion.div
           initial={{ width: 0 }}
           animate={{ width: 240 }}
           transition={{ delay: 0.5, duration: 2.0, ease: "easeInOut" }}
           className="h-1 bg-secondary rounded-full mt-12 relative overflow-hidden"
        >
           <motion.div 
             initial={{ x: "-100%" }}
             animate={{ x: "100%" }}
             transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
             className="absolute inset-0 bg-gradient-to-r from-transparent via-primary to-transparent"
           />
        </motion.div>
      </div>

      <div className="absolute bottom-12 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
        Version 1.3.1 (ST-Edition)
      </div>
    </motion.div>
  );
}
