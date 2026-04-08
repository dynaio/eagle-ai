import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface IndustrialDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title: string;
  message: string;
  type?: 'alert' | 'confirm';
  variant?: 'primary' | 'danger' | 'success';
}

export const IndustrialDialog: React.FC<IndustrialDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = 'alert',
  variant = 'primary'
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/60 backdrop-blur-md"
            onClick={onClose}
          />
          
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-card border-2 border-border p-10 rounded-[3rem] shadow-2xl max-w-md w-full space-y-6 relative z-10 overflow-hidden"
          >
            {/* Visual Accent */}
            <div className={cn(
              "absolute top-0 left-0 w-2 h-full opacity-50",
              variant === 'danger' ? "bg-rose-500" : variant === 'success' ? "bg-emerald-500" : "bg-primary"
            )} />

            <div className="flex items-start justify-between">
              <div className={cn(
                "p-3 rounded-2xl flex items-center justify-center",
                variant === 'danger' ? "bg-rose-500/10 text-rose-500" : variant === 'success' ? "bg-emerald-500/10 text-emerald-500" : "bg-primary/10 text-primary"
              )}>
                {variant === 'danger' ? <AlertTriangle className="h-6 w-6" /> : <Info className="h-6 w-6" />}
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-secondary rounded-xl transition-colors opacity-40 hover:opacity-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2 text-center pb-2">
              <h2 className="text-2xl font-black uppercase tracking-tight leading-none">{title}</h2>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">System Notification</p>
            </div>

            <p className="text-sm font-medium text-muted-foreground leading-relaxed text-center px-4">
              {message}
            </p>

            <div className="flex gap-3 pt-4">
              {type === 'confirm' && (
                <button
                  onClick={onClose}
                  className="flex-1 py-4 text-xs font-black uppercase tracking-widest border border-border rounded-2xl hover:bg-secondary transition-all"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={() => {
                  if (onConfirm) onConfirm();
                  if (type === 'alert') onClose();
                }}
                className={cn(
                  "flex-1 py-4 text-xs font-black uppercase tracking-widest rounded-2xl shadow-xl active:scale-95 transition-all text-white",
                  variant === 'danger' ? "bg-rose-500 shadow-rose-500/20" : variant === 'success' ? "bg-emerald-500 shadow-emerald-500/20" : "bg-primary shadow-primary/20"
                )}
              >
                {type === 'confirm' ? 'Confirm Action' : 'Acknowledge'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
