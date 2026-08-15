/**
 * StatusDot — titik warna semantik + label teks (bukan warna saja, a11y §5.7).
 */
const DOTS = {
  success: 'bg-success',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
  muted: 'bg-muted-fg',
  primary: 'bg-primary',
};

export function StatusDot({ tone = 'muted', label, pulse = false, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="relative flex h-2.5 w-2.5">
        {pulse && (
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${DOTS[tone] || DOTS.muted}`}
            aria-hidden
          />
        )}
        <span
          className={`relative inline-flex h-2.5 w-2.5 rounded-full ${DOTS[tone] || DOTS.muted}`}
          aria-hidden
        />
      </span>
      {label && <span className="text-sm text-muted-fg">{label}</span>}
    </span>
  );
}
