/**
 * Badge status — bukan warna saja (a11y §5.7 poin 5): ikon + teks.
 * Soft UI: background lembut + ring-inset halus agar teks tetap kontras.
 * Varian: Draft, HQ, Gratis, Proses, Gagal, Lunas, dsb.
 */
const TONES = {
  default: 'bg-muted text-muted-fg ring-muted',
  draft: 'bg-muted text-muted-fg ring-muted',
  paid: 'bg-success/15 text-success ring-success/25',
  hq: 'bg-success/15 text-success ring-success/25',
  gratis: 'bg-success/15 text-success ring-success/25',
  proses: 'bg-warning/15 text-warning ring-warning/25',
  pending: 'bg-warning/15 text-warning ring-warning/25',
  gagal: 'bg-destructive/15 text-destructive ring-destructive/25',
  failed: 'bg-destructive/15 text-destructive ring-destructive/25',
  expire: 'bg-destructive/15 text-destructive ring-destructive/25',
  cancel: 'bg-destructive/15 text-destructive ring-destructive/25',
  lunas: 'bg-success/15 text-success ring-success/25',
  settlement: 'bg-success/15 text-success ring-success/25',
  selesai: 'bg-primary/15 text-primary ring-primary/25',
  info: 'bg-primary/15 text-primary ring-primary/25',
};

export function Badge({ tone = 'default', icon: Icon, children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide ring-1 ring-inset ${
        TONES[tone] || TONES.default
      } ${className}`}
    >
      {Icon ? <Icon size={12} weight="bold" aria-hidden /> : null}
      {children}
    </span>
  );
}
