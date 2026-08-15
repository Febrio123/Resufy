import { useRef } from 'react';
import { motion } from 'framer-motion';

/**
 * Tabs — pill beranimasi (layoutId), mobile: scroll horizontal.
 * Soft UI: container lembut, tab aktif dengan tint gradient.
 * a11y §5.7: role=tablist + aria-selected + roving tabindex + navigasi
 * ArrowLeft/ArrowRight/Home/End (dev pass §12).
 */
export function Tabs({ tabs, active, onChange, className = '' }) {
  const tabRefs = useRef([]);

  const handleKeyDown = (e, index) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const count = tabs.length;
    const next =
      e.key === 'ArrowLeft'
        ? (index - 1 + count) % count
        : e.key === 'ArrowRight'
          ? (index + 1) % count
          : e.key === 'Home'
            ? 0
            : count - 1;
    tabRefs.current[next]?.focus();
    onChange(tabs[next].value);
  };

  return (
    <div
      role="tablist"
      aria-label="Tab navigasi"
      className={`flex gap-1 overflow-x-auto rounded-xl bg-slate-100/80 p-1.5 ring-1 ring-inset ring-border/60 ${className}`}
    >
      {tabs.map((tab, index) => {
        const isActive = active === tab.value;
        return (
          <button
            key={tab.value}
            ref={(el) => (tabRefs.current[index] = el)}
            role="tab"
            tabIndex={isActive ? 0 : -1}
            aria-selected={isActive}
            onClick={() => onChange(tab.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={`relative flex h-11 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-primary ${
              isActive ? 'text-primary' : 'text-muted-fg hover:text-foreground'
            }`}
          >
            {isActive && (
              <motion.span
                layoutId="tab-pill"
                className="absolute inset-0 rounded-lg bg-white shadow-md ring-1 ring-black/5"
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                aria-hidden
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              {tab.icon && (
                <span
                  className={`grid h-6 w-6 place-items-center rounded-md ${
                    isActive ? 'bg-cta-gradient text-white' : 'bg-muted text-muted-fg'
                  }`}
                >
                  <tab.icon size={14} weight="bold" aria-hidden />
                </span>
              )}
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
