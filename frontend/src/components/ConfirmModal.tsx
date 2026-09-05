import React, { useState, useEffect } from 'react';
import { X, AlertCircle, HelpCircle, CheckCircle2 } from 'lucide-react';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  type?: 'alert' | 'confirm' | 'prompt';
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'blue' | 'emerald' | 'red';
  promptPlaceholder?: string;
  initialPromptValue?: string;
  onConfirm: (promptValue?: string) => void;
  onClose: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  type = 'alert',
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  confirmVariant = 'blue',
  promptPlaceholder = 'Enter remarks...',
  initialPromptValue = '',
  onConfirm,
  onClose,
}) => {
  const [inputValue, setInputValue] = useState(initialPromptValue);

  useEffect(() => {
    if (isOpen) {
      setInputValue(initialPromptValue);
    }
  }, [isOpen, initialPromptValue]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && type !== 'prompt') {
      onConfirm();
    }
  };

  const getConfirmButtonClasses = () => {
    switch (confirmVariant) {
      case 'emerald':
        return 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20';
      case 'red':
        return 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/20';
      case 'blue':
      default:
        return 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20';
    }
  };

  const getIcon = () => {
    switch (confirmVariant) {
      case 'emerald':
        return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
      case 'red':
        return <AlertCircle className="w-5 h-5 text-red-400" />;
      case 'blue':
      default:
        return <HelpCircle className="w-5 h-5 text-blue-400" />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="p-4 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-slate-800 rounded-lg border border-slate-700">
              {getIcon()}
            </div>
            <h3 className="text-sm font-bold text-white tracking-tight">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-300 leading-relaxed">{message}</p>

          {type === 'prompt' && (
            <div>
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={promptPlaceholder}
                rows={3}
                autoFocus
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-blue-500 placeholder-slate-500 resize-none"
              />
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-slate-800/60 border-t border-slate-700 flex items-center justify-end space-x-2">
          {type !== 'alert' && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition-colors"
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            onClick={() => onConfirm(type === 'prompt' ? inputValue : undefined)}
            className={`px-4 py-2 text-xs font-semibold rounded-xl shadow transition-all ${getConfirmButtonClasses()}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
