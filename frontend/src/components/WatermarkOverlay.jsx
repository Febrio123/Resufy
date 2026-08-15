import { COPY } from '../utils/constants';

/**
 * WatermarkOverlay — tiga lapis pembeda preview vs final (03-ui-ux-design.md §6.2):
 * overlay diagonal "PREVIEW — BERWATERMARK" semi-transparan + pointer-events-none
 * (TIDAK menghalangi interaksi). Dipakai di atas iframe PDF preview.
 */
export function WatermarkOverlay({ label = COPY.previewWatermark, dense = false }) {
  const positions = dense
    ? [
        { x: '-50%', y: '-120%' },
        { x: '-20%', y: '-50%' },
        { x: '-80%', y: '-50%' },
        { x: '-50%', y: '20%' },
        { x: '-20%', y: '90%' },
        { x: '-80%', y: '90%' },
      ]
    : [
        { x: '-50%', y: '-110%' },
        { x: '-50%', y: '10%' },
        { x: '-50%', y: '130%' },
      ];

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {positions.map((pos, i) => (
        <span
          key={i}
          className="absolute left-1/2 top-1/2 whitespace-nowrap text-xl font-extrabold uppercase tracking-widest text-destructive/25 md:text-3xl"
          style={{ transform: `translate(${pos.x}, ${pos.y}) rotate(-30deg)` }}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

/** Banner merah eksplisit — "ini PREVIEW, bukan file final". */
export function PreviewBanner({ text }) {
  return (
    <div
      role="note"
      className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      <span aria-hidden className="mt-0.5 shrink-0 font-extrabold">
        ⚠
      </span>
      <p>
        {text ||
          'Ini versi PREVIEW ber-watermark, bukan file final. Unduh versi HQ untuk dikirim ke rekruter.'}
      </p>
    </div>
  );
}
