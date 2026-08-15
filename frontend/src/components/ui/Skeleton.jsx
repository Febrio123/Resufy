/**
 * Skeleton loading — shimmer halus (Soft UI), untuk fetch list/detail >300ms.
 * Bukan spinner untuk konten (a11y "Loading States").
 */
export function Skeleton({ className = '' }) {
  return <div aria-hidden className={`shimmer rounded-lg ${className}`} />;
}

export function CardSkeleton() {
  return (
    <div
      className="space-y-3 rounded-xl border border-border bg-surface p-4 shadow-sm"
      aria-busy="true"
      aria-label="Memuat konten"
    >
      <div className="flex items-center gap-3">
        <Skeleton className="h-11 w-11 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-full" />
        </div>
      </div>
      <Skeleton className="h-11 w-28 rounded-lg" />
    </div>
  );
}

export function ListSkeleton({ count = 3 }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Memuat daftar">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export function PageLoader({ label = 'Memuat…' }) {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 bg-bg px-4">
      <div
        className="h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary"
        role="status"
        aria-label={label}
      />
      <p className="text-sm text-muted-fg">{label}</p>
    </div>
  );
}
