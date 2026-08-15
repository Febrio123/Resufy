import { PRICE_LABEL, COPY } from '../../utils/constants';

/**
 * PriceTag — format baku "Rp2.000" (tanpa spasi), font extrabold accent oranye,
 * disertai label "sekali bayar, tanpa langganan" (03-ui-ux-design.md §6.5).
 * Soft UI: angka dalam pill lembut agar lebih menonjol.
 */
export function PriceTag({ label = PRICE_LABEL, note = COPY.onceOnly, className = '' }) {
  return (
    <div className={`flex flex-col items-center gap-1.5 ${className}`}>
      <span className="inline-flex items-baseline gap-1.5 rounded-2xl bg-accent/10 px-5 py-2.5 ring-1 ring-inset ring-accent/20">
        <span className="text-4xl font-extrabold tabular-nums text-accent drop-shadow-sm">
          {label}
        </span>
      </span>
      {note && <span className="text-xs font-medium text-muted-fg">{note}</span>}
    </div>
  );
}
