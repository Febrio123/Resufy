import { forwardRef, useId } from 'react';
import { WarningCircle } from '@phosphor-icons/react';

/**
 * Input — label SELALU terlihat, error inline di bawah field + aria (a11y §5.7).
 * Touch target h-12 (48px), focus ring primary.
 */
export const Input = forwardRef(function Input(
  { label, error, helper, hint, labelHidden = false, icon: Icon, className = '', id, ...props },
  ref
) {
  const autoId = useId();
  const inputId = id || autoId;
  const errorId = error ? `${inputId}-error` : undefined;
  const helperId = helper && !error ? `${inputId}-helper` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className={labelHidden ? 'sr-only' : 'text-sm font-semibold text-foreground'}
        >
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon
            size={18}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-fg"
            aria-hidden
          />
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error)}
          aria-describedby={errorId || helperId}
          className={`h-12 w-full rounded-lg border bg-white text-base text-foreground shadow-sm transition-all duration-200 placeholder:text-muted-fg focus:border-primary focus:ring-4 focus:ring-primary/15 focus:outline-none disabled:cursor-not-allowed disabled:bg-muted/50 ${
            Icon ? 'pl-11' : 'pl-4'
          } pr-4 ${
            error ? 'border-destructive focus:ring-destructive/15' : 'border-border'
          } ${className}`}
          {...props}
        />
      </div>
      {error ? (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
          <WarningCircle size={16} className="mt-0.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      ) : helper ? (
        <p id={helperId} className="text-sm text-muted-fg">
          {helper}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-fg">{hint}</p>
      ) : null}
    </div>
  );
});
