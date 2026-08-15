import { useCallback, useRef, useState } from 'react';
import { CloudArrowUp, FileArrowUp, X, WarningCircle } from '@phosphor-icons/react';
import { formatFileSize } from '../utils/format';

/** Infer MIME dari ekstensi nama file — fallback saat `file.type` kosong (beberapa browser/OS). */
const EXT_MIME_MAP = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  txt: 'text/plain',
};

const mimeFromName = (name) => {
  const ext = String(name || '').split('.').pop().toLowerCase();
  return EXT_MIME_MAP[ext] || '';
};

/**
 * Dropzone — §5.6: border-2 dashed, drag-over highlight, validasi inline,
 * ikon upload, info format/ukuran. Mobile: tap untuk memilih file.
 */
export function Dropzone({
  accept = '',
  acceptLabel = '',
  maxSize,
  onFile,
  hint,
  label = 'Pilih file atau seret ke sini',
  className = '',
  disabled = false,
  capture,
}) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');

  const validate = useCallback(
    (file) => {
      if (!file) return false;
      const allowed = String(accept || '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const okType =
        allowed.length === 0 ||
        allowed.some((t) => {
          if (t.startsWith('.')) return file.name.toLowerCase().endsWith(t);
          if (t.endsWith('/*')) {
            // wildcard kategori, mis. `image/*` — cocokkan prefix MIME (file.type
            // berisi nilai konkret spt 'image/jpeg', BUKAN 'image/*').
            const cat = t.split('/')[0];
            const type = file.type || mimeFromName(file.name);
            return type.startsWith(`${cat}/`);
          }
          return (file.type || mimeFromName(file.name)) === t;
        });
      if (!okType) {
        setError(`Format file tidak didukung. Gunakan: ${acceptLabel || accept}`);
        return false;
      }
      if (maxSize && file.size > maxSize) {
        setError(`Ukuran file maksimal ${formatFileSize(maxSize)}`);
        return false;
      }
      setError('');
      return true;
    },
    [accept, acceptLabel, maxSize]
  );

  const handleFiles = useCallback(
    (fileList) => {
      const files = Array.from(fileList || []);
      if (!files.length) return;
      const file = files[0];
      if (validate(file)) onFile?.(file);
    },
    [onFile, validate]
  );

  return (
    <div className="flex flex-col gap-2">
      <div
        role="button"
        tabIndex={0}
        aria-label={label}
        aria-disabled={disabled}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!disabled) handleFiles(e.dataTransfer.files);
        }}
        className={`flex min-h-44 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-all duration-200 ${
          dragOver
            ? 'border-primary bg-primary-50 shadow-lg'
            : 'border-border bg-gradient-to-b from-surface to-primary-50/30 shadow-sm hover:border-primary/50 hover:shadow-md'
        } ${disabled ? 'cursor-not-allowed opacity-50' : ''} ${className}`}
      >
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-cta-gradient text-white shadow-glow-primary">
          <CloudArrowUp size={30} aria-hidden />
        </span>
        <p className="text-sm font-bold text-foreground">{label}</p>
        {hint && <p className="text-xs text-muted-fg">{hint}</p>}
        {acceptLabel && (
          <p className="rounded-full bg-white px-3 py-1 text-xs font-medium text-muted-fg shadow-sm ring-1 ring-inset ring-border">
            {acceptLabel}
            {maxSize ? ` · maks ${formatFileSize(maxSize)}` : ''}
          </p>
        )}
        <span className="inline-flex items-center gap-2 rounded-lg bg-cta-gradient px-4 py-2 text-sm font-semibold text-white shadow-glow-primary">
          <FileArrowUp size={16} aria-hidden /> Pilih File
        </span>
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept={accept}
          capture={capture}
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      {error && (
        <p role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
          <WarningCircle size={16} className="mt-0.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

/** File yang sudah dipilih — tampil + tombol ganti/hapus. */
export function SelectedFile({ file, onClear, onReplace }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 shadow-sm">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-cta-gradient text-white shadow-glow-primary">
        <FileArrowUp size={22} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{file.name}</p>
        <p className="text-xs text-muted-fg">{formatFileSize(file.size)}</p>
      </div>
      {onReplace && (
        <button
          type="button"
          onClick={onReplace}
          className="h-11 rounded-md px-3 text-sm font-semibold text-primary hover:bg-primary-100"
        >
          Ganti
        </button>
      )}
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label={`Hapus ${file.name}`}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-muted-fg hover:bg-muted hover:text-destructive"
        >
          <X size={18} aria-hidden />
        </button>
      )}
    </div>
  );
}
