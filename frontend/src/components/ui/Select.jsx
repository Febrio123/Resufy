import { forwardRef, useId } from 'react';
import { CaretDown, WarningCircle } from '@phosphor-icons/react';

export const Select = forwardRef(function Select(
  { label, error, helper, className = '', id, options, placeholder, children, ...props },
  ref
) {
  const autoId = useId();
  const selectId = id || autoId;
  const errorId = error ? `${selectId}-error` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-sm font-semibold text-foreground">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          aria-invalid={Boolean(error)}
          aria-describedby={errorId}
          className={`h-12 w-full appearance-none rounded-lg border bg-white pl-4 pr-10 text-base text-foreground shadow-sm transition-all duration-200 focus:border-primary focus:ring-4 focus:ring-primary/15 focus:outline-none disabled:bg-muted/50 ${
            error ? 'border-destructive focus:ring-destructive/15' : 'border-border'
          } ${className}`}
          {...props}
        >
          {placeholder && !props.value && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label ?? opt.value}
                </option>
              ))
            : children}
        </select>
        <CaretDown
          size={16}
          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-fg"
          aria-hidden
        />
      </div>
      {error ? (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
          <WarningCircle size={16} className="mt-0.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      ) : helper ? (
        <p className="text-sm text-muted-fg">{helper}</p>
      ) : null}
    </div>
  );
});
