import { useId } from 'react';

export function Checkbox({ label, checked, onChange, className = '', id, ...props }) {
  const autoId = useId();
  const checkboxId = id || autoId;
  return (
    <label
      htmlFor={checkboxId}
      className={`flex min-h-11 cursor-pointer select-none items-center gap-2.5 ${className}`}
    >
      <input
        id={checkboxId}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-5 w-5 shrink-0 rounded border-border accent-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
        {...props}
      />
      <span className="text-sm font-medium text-foreground">{label}</span>
    </label>
  );
}
