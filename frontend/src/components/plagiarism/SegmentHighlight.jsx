import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowSquareOut, LinkSimple } from '@phosphor-icons/react';

/**
 * SegmentHighlight — highlight PRESISI frasa terindikasi plagiasi.
 * Kontrak backend: `text.slice(start, end) === phrase.text`.
 * - `text` tersedia & `phrases.length > 0` → tiap rentang {start,end} di-<mark>
 *   (rentang overlap digabung, offset di-clamp ke batas teks).
 * - `text` kosong (dokumen lama, fallback `textSnippet`) ATAU tanpa frasa tapi
 *   `score >= 0.15` / ada sumber → seluruh teks di-<mark> (perilaku lama).
 * - Klik/Enter/Space pada mark → popover daftar sumber (title + url + Buka ↗ +
 *   snippet singkat; BUKAN konten penuh sumber — etika). Escape/klik lagi menutup.
 * Zero manual SVG; warna hanya dari token Soft UI (warning).
 */
function mergeRanges(phrases, len) {
  const ranges = phrases
    .map((p) => {
      const start = Math.max(0, Math.min(p.start ?? 0, len));
      const end = Math.min(len, Math.max(p.end ?? start, start));
      return { start, end };
    })
    .filter((r) => r.end > r.start)
    .sort((a, b) => a.start - b.start);
  const merged = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else merged.push({ ...r });
  }
  return merged;
}

function SourcePopover({ sources, onClose }) {
  return (
    <motion.div
      role="dialog"
      aria-label="Sumber kemiripan"
      className="absolute bottom-full left-0 z-20 mb-2 w-72 max-w-full rounded-lg border border-border bg-surface p-3 shadow-lg"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.15 }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-fg">
        Kemiripan dengan {sources.length} sumber
      </p>
      <ul className="max-h-44 space-y-2 overflow-y-auto">
        {sources.map((src, i) => (
          <li key={i} className="text-xs">
            <a
              href={src.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-1.5 font-semibold text-primary hover:underline"
            >
              <LinkSimple size={12} className="mt-0.5 shrink-0" aria-hidden />
              <span className="line-clamp-2">{src.title || src.url}</span>
              <ArrowSquareOut size={12} className="mt-0.5 shrink-0" aria-hidden />
            </a>
            {src.snippet && <p className="mt-0.5 line-clamp-2 text-muted-fg">{src.snippet}</p>}
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

function HighlightedRun({ content, start, end, sources, open, onToggle, onClose, index }) {
  return (
    <span className="relative">
      <mark
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Teks terindikasi mirip dengan ${sources.length} sumber — tekan untuk rincian`}
        onClick={() => sources.length > 0 && onToggle(index)}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && sources.length > 0) {
            e.preventDefault();
            onToggle(index);
          } else if (e.key === 'Escape') {
            onClose();
          }
        }}
        className="cursor-pointer rounded-sm bg-warning/30 px-0.5 py-0.5 leading-relaxed focus-visible:ring-2 focus-visible:ring-warning"
      >
        {content.slice(start, end)}
      </mark>
      <AnimatePresence>
        {open && sources.length > 0 && <SourcePopover sources={sources} onClose={onClose} />}
      </AnimatePresence>
    </span>
  );
}

export function SegmentHighlight({ text, textSnippet, phrases = [], sources = [], score = 0 }) {
  const [openIndex, setOpenIndex] = useState(null);
  const content = text || textSnippet || '';

  if (!content) return null;

  const hasPhrases = Boolean(text) && phrases.length > 0;
  const highlightWhole = !hasPhrases && (score >= 0.15 || sources.length > 0);
  const ranges = hasPhrases ? mergeRanges(phrases, content.length) : [];

  const close = () => setOpenIndex(null);
  const toggle = (i) => setOpenIndex((v) => (v === i ? null : i));

  let nodes;
  if (ranges.length > 0) {
    nodes = [];
    let cursor = 0;
    ranges.forEach((r, i) => {
      if (r.start > cursor) nodes.push(<span key={`t${i}`}>{content.slice(cursor, r.start)}</span>);
      nodes.push(
        <HighlightedRun
          key={`m${i}`}
          content={content}
          start={r.start}
          end={r.end}
          sources={sources}
          open={openIndex === i}
          onToggle={toggle}
          onClose={close}
          index={i}
        />,
      );
      cursor = r.end;
    });
    if (cursor < content.length) nodes.push(<span key="tail">{content.slice(cursor)}</span>);
  } else if (highlightWhole) {
    nodes = [
      <HighlightedRun
        key="m0"
        content={content}
        start={0}
        end={content.length}
        sources={sources}
        open={openIndex === 0}
        onToggle={toggle}
        onClose={close}
        index={0}
      />,
    ];
  } else {
    nodes = content;
  }

  return <div className="whitespace-pre-wrap leading-relaxed text-foreground">{nodes}</div>;
}
