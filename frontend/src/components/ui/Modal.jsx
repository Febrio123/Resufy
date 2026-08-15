import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from '@phosphor-icons/react';

const SIZES = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl' };

/**
 * Modal — spesifikasi §5.6: backdrop black/40, fokus trap (Tab/Shift+Tab loop),
 * Esc/backdrop menutup, role=dialog + aria-modal. Fokus dikembalikan ke elemen
 * pembuka saat ditutup. Mobile-first: bottom sheet → centered di sm+.
 */
export function Modal({
  open,
  onClose,
  title,
  size = 'md',
  hideClose = false,
  labelledBy,
  children,
}) {
  const reduced = useReducedMotion();
  const panelRef = useRef(null);
  const restoreFocusRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const onKey = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
        return;
      }
      // Focus trap: Tab/Shift+Tab berputar di dalam panel (a11y §5.6)
      if (e.key === 'Tab' && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    restoreFocusRef.current = document.activeElement;
    const raf = requestAnimationFrame(() => panelRef.current?.focus());
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      cancelAnimationFrame(raf);
      restoreFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  const motionVariants = reduced
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        initial: { opacity: 0, y: 24, scale: 0.98 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 24, scale: 0.98 },
      };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4">
          <motion.div
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            aria-label={labelledBy ? undefined : title}
            tabIndex={-1}
            className={`relative max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-surface p-5 shadow-xl ring-1 ring-black/5 outline-none sm:rounded-2xl md:p-6 ${
              SIZES[size] || SIZES.md
            }`}
            initial={motionVariants.initial}
            animate={motionVariants.animate}
            exit={motionVariants.exit}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {title && (
              <div className="mb-4 flex items-start justify-between gap-4">
                <h2 id={labelledBy} className="text-lg font-bold text-foreground">
                  {title}
                </h2>
                {!hideClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Tutup dialog"
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-muted-fg hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <X size={20} aria-hidden />
                  </button>
                )}
              </div>
            )}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
