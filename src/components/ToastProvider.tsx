'use client';

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Check, CircleAlert, Info, X } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';
type ToastItem = { id: number; message: string; kind: ToastKind };
type ToastContextValue = { toast: (message: string, kind?: ToastKind) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const dismiss = useCallback((id: number) => setItems(current => current.filter(item => item.id !== id)), []);
  const toast = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = ++nextId.current;
    setItems(current => [...current.slice(-3), { id, message, kind }]);
    window.setTimeout(() => dismiss(id), 5000);
  }, [dismiss]);

  return <ToastContext.Provider value={{ toast }}>
    {children}
    <div className="toast-stack" aria-label="Notifications" aria-live="polite" aria-relevant="additions">
      {items.map(item => <div key={item.id} className={`toast toast-${item.kind}`} role={item.kind === 'error' ? 'alert' : 'status'}>
        <span className="toast-icon" aria-hidden="true">{item.kind === 'success' ? <Check size={17}/> : item.kind === 'error' ? <CircleAlert size={17}/> : <Info size={17}/>}</span>
        <span className="toast-message">{item.message}</span>
        <button className="toast-dismiss" type="button" onClick={() => dismiss(item.id)} aria-label="Dismiss notification"><X size={16}/></button>
      </div>)}
    </div>
  </ToastContext.Provider>;
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context.toast;
}
