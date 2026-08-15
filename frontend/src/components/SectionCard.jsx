import { useId } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CaretDown } from '@phosphor-icons/react';
import { Card } from './ui/Card';

/**
 * SectionCard — accordion collapsible untuk editor CV multi-section
 * (wireframe 4.4: satu section terbuka pada satu waktu).
 */
export function SectionCard({ number, title, icon: Icon, open, onToggle, badge, children }) {
  const contentId = useId();
  const reduced = useReducedMotion();

  return (
    <Card className="overflow-hidden" padded={false}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={contentId}
        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-primary"
      >
        {Icon && (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary-100 text-primary">
            <Icon size={18} weight="bold" aria-hidden />
          </span>
        )}
        <span className="flex-1 text-sm font-bold text-foreground">
          {number}. {title}
        </span>
        {badge}
        <CaretDown
          size={18}
          className={`shrink-0 text-muted-fg transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={contentId}
            initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduced ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border"
          >
            <div className="space-y-4 p-4 md:p-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
