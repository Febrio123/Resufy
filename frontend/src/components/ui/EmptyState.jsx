/**
 * EmptyState — ilustrasi soft (lingkaran gradient + ikon), judul, deskripsi,
 * CTA. Dipakai di dashboard, riwayat kosong, hasil tanpa sumber.
 */
export function EmptyState({ icon: Icon, title, description, action, className = '' }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-gradient-to-b from-surface to-primary-50/40 px-6 py-12 text-center ${className}`}
    >
      <div className="relative">
        <span className="absolute inset-0 -translate-x-2 translate-y-2 rounded-full bg-primary/10 blur-lg" aria-hidden />
        <span className="relative grid h-20 w-20 place-items-center rounded-full bg-cta-gradient shadow-glow-primary">
          <span className="absolute inset-1 rounded-full bg-white/15" aria-hidden />
          {Icon && <Icon size={34} className="relative text-white" aria-hidden />}
        </span>
      </div>
      <h3 className="text-lg font-extrabold text-foreground">{title}</h3>
      {description && <p className="max-w-sm text-sm text-muted-fg">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
