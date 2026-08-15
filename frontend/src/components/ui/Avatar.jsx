/** Avatar — inisial dari nama user, tanpa gambar (backend MVP tidak punya upload avatar). */
export function Avatar({ name = '?', size = 'md', className = '' }) {
  const initials = String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('') || '?';

  const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-lg' };
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-cta-gradient font-bold text-white shadow-glow-primary ring-2 ring-white ${
        sizes[size] || sizes.md
      } ${className}`}
    >
      {initials}
    </span>
  );
}
