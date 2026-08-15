import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CheckCircle, Info, WarningCircle, X } from '@phosphor-icons/react';

const ToastContext = createContext(null);
export function useToast() {
  return useContext(ToastContext);
}

let idSeq = 0;

const TOAST_STYLES = {
  success: {
    icon: CheckCircle,
    iconClass: 'text-success',
    label: 'Berhasil',
  },
  error: {
    icon: WarningCircle,
    iconClass: 'text-destructive',
    label: 'Gagal',
  },
  info: {
    icon: Info,
    iconClass: 'text-info',
    label: 'Info',
  },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const reduced = useReducedMotion();

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (type, message) => {
      const id = ++idSeq;
      setToasts((prev) => [...prev.slice(-3), { id, type, message }]);
      window.setTimeout(() => dismiss(id), 5000);
      return id;
    },
    [dismiss]
  );

  const api = useMemo(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[120] flex flex-col items-center gap-2 px-4 md:inset-x-auto md:right-4 md:top-4 md:bottom-auto md:items-end md:px-0"
      >
        <AnimatePresence>
          {toasts.map((toast) => {
            const style = TOAST_STYLES[toast.type] || TOAST_STYLES.info;
            const Icon = style.icon;
            return (
              <motion.div
                key={toast.id}
                role="status"
                className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-border bg-surface p-4 shadow-lg"
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.97 }}
                animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.97 }}
                transition={{ duration: 0.2 }}
              >
                <Icon size={22} className={`mt-0.5 shrink-0 ${style.iconClass}`} weight="bold" aria-hidden />
                <p className="flex-1 text-sm text-foreground">{toast.message}</p>
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  aria-label="Tutup notifikasi"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-muted-fg hover:bg-muted hover:text-foreground"
                >
                  <X size={16} aria-hidden />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
