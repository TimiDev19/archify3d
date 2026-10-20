'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

type DialogOptions = { title: string; description: string; confirmLabel?: string; danger?: boolean };
type DialogState = DialogOptions & { kind: 'confirm' | 'prompt'; initialValue?: string; placeholder?: string };
type DialogContextValue = { confirm: (options: DialogOptions) => Promise<boolean>; prompt: (options: DialogOptions & { initialValue?: string; placeholder?: string }) => Promise<string | null> };
const DialogContext = createContext<DialogContextValue | null>(null);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [value, setValue] = useState('');
  const resolveRef = useRef<((result: boolean | string | null) => void) | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const reducedMotion = useReducedMotion();
  const close = useCallback((result: boolean | string | null) => {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setDialog(null);
    previousFocus.current?.focus();
  }, []);
  const confirm = useCallback((options: DialogOptions) => new Promise<boolean>(resolve => {
    previousFocus.current = document.activeElement as HTMLElement;
    resolveRef.current = result => resolve(result === true);
    setDialog({ ...options, kind: 'confirm' });
  }), []);
  const prompt = useCallback((options: DialogOptions & { initialValue?: string; placeholder?: string }) => new Promise<string | null>(resolve => {
    previousFocus.current = document.activeElement as HTMLElement;
    resolveRef.current = result => resolve(typeof result === 'string' ? result : null);
    setValue(options.initialValue ?? '');
    setDialog({ ...options, kind: 'prompt' });
  }), []);
  useEffect(() => {
    if (!dialog) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { close(null); return; }
      if (event.key === 'Tab') {
        const container = document.querySelector<HTMLElement>('.app-dialog');
        const items = container?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)');
        if (!items?.length) return;
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onKey);
    const timer = window.setTimeout(() => document.getElementById(dialog.kind === 'prompt' ? 'app-dialog-input' : 'app-dialog-confirm')?.focus(), 30);
    return () => { window.removeEventListener('keydown', onKey); window.clearTimeout(timer); };
  }, [dialog, close]);

  return <DialogContext.Provider value={{ confirm, prompt }}>
    {children}
    <AnimatePresence>
      {dialog && <motion.div className="app-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) close(null); }} initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <motion.section className="app-dialog" role={dialog.danger ? 'alertdialog' : 'dialog'} aria-modal="true" aria-labelledby="app-dialog-title" aria-describedby="app-dialog-description" initial={reducedMotion ? false : { opacity: 0, y: 12, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: .98 }}>
          <div className={`app-dialog-icon ${dialog.danger ? 'danger' : ''}`}><AlertTriangle size={20}/></div>
          <h2 id="app-dialog-title">{dialog.title}</h2><p id="app-dialog-description">{dialog.description}</p>
          {dialog.kind === 'prompt' && <input id="app-dialog-input" className="input" value={value} placeholder={dialog.placeholder} maxLength={80} onChange={event => setValue(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && value.trim()) close(value.trim()); }} />}
          <div className="app-dialog-actions"><button className="btn" type="button" onClick={() => close(null)}>Cancel</button><button id="app-dialog-confirm" className={`btn ${dialog.danger ? 'danger-button' : 'primary'}`} type="button" disabled={dialog.kind === 'prompt' && !value.trim()} onClick={() => close(dialog.kind === 'prompt' ? value.trim() : true)}>{dialog.confirmLabel ?? (dialog.kind === 'prompt' ? 'Save' : 'Confirm')}</button></div>
        </motion.section>
      </motion.div>}
    </AnimatePresence>
  </DialogContext.Provider>;
}

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) throw new Error('useDialog must be used inside DialogProvider');
  return context;
}
