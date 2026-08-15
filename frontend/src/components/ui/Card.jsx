/**
 * Card — surface putih + border lembut + elevation konsisten (Soft UI).
 * `hoverable`: hover lift (-1px) + shadow membesar + border primary tipis.
 */
export function Card({ className = '', padded = true, hoverable = false, ...props }) {
  return (
    <div
      className={`rounded-xl border border-border bg-surface shadow-sm transition-[box-shadow,transform,border-color] duration-200 ${
        padded ? 'p-4 md:p-6' : ''
      } ${hoverable ? 'hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-md' : ''} ${className}`}
      {...props}
    />
  );
}
