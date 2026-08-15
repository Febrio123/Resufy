import { motion, useReducedMotion } from 'framer-motion';
import { Check, CircleNotch, X } from '@phosphor-icons/react';

export const PLAGIARISM_STEPS = [
  { key: 'upload', label: 'Mengunggah' },
  { key: 'extract', label: 'Mengekstrak teks' },
  { key: 'search', label: 'Mencari sumber' },
  { key: 'score', label: 'Menghitung skor' },
];

/**
 * ProgressSteps — indikator bertahap (wireframe 4.6): titik + label.
 * `activeIndex` = langkah yang sedang berjalan (0..n-1); `done` = semua selesai;
 * `failed` = proses gagal.
 */
export function ProgressSteps({ steps = PLAGIARISM_STEPS, activeIndex = 0, done = false, failed = false }) {
  const reduced = useReducedMotion();

  return (
    <ol className="flex flex-col gap-3" aria-label="Tahap pemeriksaan">
      {steps.map((step, i) => {
        const isDone = done || i < activeIndex;
        const isActive = !done && !failed && i === activeIndex;
        const isFailed = failed && i === activeIndex;

        return (
          <li key={step.key} className="flex items-center gap-3">
            <span
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold ring-2 ring-offset-2 ${
                isDone
                  ? 'bg-success/15 text-success ring-success/20 ring-offset-white'
                  : isFailed
                    ? 'bg-destructive/15 text-destructive ring-destructive/20 ring-offset-white'
                    : isActive
                      ? 'bg-cta-gradient text-white shadow-glow-primary ring-primary/20 ring-offset-white'
                      : 'bg-muted text-muted-fg ring-transparent ring-offset-white'
              }`}
              aria-hidden
            >
              {isDone ? (
                <Check size={16} weight="bold" />
              ) : isFailed ? (
                <X size={16} weight="bold" />
              ) : isActive ? (
                <CircleNotch size={16} className="animate-spin" weight="bold" />
              ) : (
                i + 1
              )}
            </span>
            <motion.span
              className={`text-sm font-medium ${
                isDone || isActive ? 'text-foreground' : 'text-muted-fg'
              }`}
              animate={isActive && !reduced ? { opacity: [0.6, 1] } : undefined}
              transition={{ duration: 0.8, repeat: Infinity, repeatType: 'reverse' }}
            >
              {step.label}
            </motion.span>
          </li>
        );
      })}
    </ol>
  );
}
