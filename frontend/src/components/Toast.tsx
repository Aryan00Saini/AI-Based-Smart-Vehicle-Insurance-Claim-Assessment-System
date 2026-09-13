import React from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type?: 'success' | 'warning' | 'info';
}

interface ToastProps {
  toast: ToastMessage | null;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
  if (!toast) return null;

  return (
    <div
      id="toastNotification"
      className="fixed bottom-6 right-6 z-[80] flex items-center gap-3 px-4 py-3 rounded-xl bg-[#131929]/95 backdrop-blur-xl border border-cyan-400/40 text-white shadow-[0_10px_35px_rgba(0,0,0,0.6)] animate-in fade-in slide-in-from-bottom-5 duration-200"
    >
      {toast.type === 'warning' ? (
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
      ) : toast.type === 'info' ? (
        <Info className="w-5 h-5 text-blue-400 shrink-0" />
      ) : (
        <CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0" />
      )}
      <div>
        <div className="text-xs font-bold text-white tracking-wide">{toast.title}</div>
        <div className="text-[11px] text-slate-400 font-mono">{toast.message}</div>
      </div>
      <button
        onClick={onClose}
        className="ml-2 text-slate-400 hover:text-white p-1 rounded transition-colors"
        aria-label="Close notification"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
