import { forwardRef, useId } from 'react';
import { WarningCircle } from '@phosphor-icons/react';

export const Textarea = forwardRef(function Textarea(
  { label, error, helper, hint, className = '', id, rows = 4, ...props },
  ref
) {
  const autoId = useId();
  const textareaId = id || autoId;
  const errorId = error ? `${textareaId}-error` : undefined;
  const helperId = helper && !error ? `${textareaId}-helper` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={textareaId} className="text-sm font-semibold text-foreground">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId || helperId}
        className={`min-h-24 w-full rounded-lg border bg-white px-4 py-3 text-base text-foreground shadow-sm transition-all duration-200 placeholder:text-muted-fg focus:border-primary focus:ring-4 focus:ring-primary/15 focus:outline-none disabled:bg-muted/50 ${
          error ? 'border-destructive focus:ring-destructive/15' : 'border-border'
        } ${className}`}
        {...props}
      />
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
