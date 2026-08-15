import { CircleNotch } from '@phosphor-icons/react';

export function Spinner({ size = 20, className = '', label = 'Memuat…' }) {
  return (
    <span role="status" aria-label={label} className={`inline-flex ${className}`}>
      <CircleNotch size={size} className="animate-spin" weight="bold" aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}
