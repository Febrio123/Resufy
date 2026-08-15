import { useState } from 'react';
import { Plus, X } from '@phosphor-icons/react';

/**
 * ChipsInput — input kata kunci bertambah (skill, tech stack): ketik + Enter/Plus
 * untuk menambah, klik X untuk menghapus. Duplikat ditolak (case-insensitive).
 */
export function ChipsInput({ label, chips = [], onChange, disabled = false, placeholder = 'Ketik lalu tekan Enter…' }) {
  const [value, setValue] = useState('');

  const addChip = () => {
    const chip = value.trim();
    if (!chip) return;
    if (chips.some((c) => c.toLowerCase() === chip.toLowerCase())) {
      setValue('');
      return;
    }
    onChange([...chips, chip]);
    setValue('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addChip();
    } else if (e.key === 'Backspace' && value === '' && chips.length > 0) {
      onChange(chips.slice(0, -1));
    }
  };

  return (
    <div>
      {label && <label className="mb-1.5 block text-sm font-semibold text-foreground">{label}</label>}
      {chips.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5" aria-label={`${label || 'Daftar'}: ${chips.join(', ')}`}>
          {chips.map((chip) => (
            <li key={chip} className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-3 py-1 text-sm font-semibold text-primary ring-1 ring-inset ring-primary/20">
              {chip}
              {!disabled && (
                <button
                  type="button"
                  aria-label={`Hapus ${chip}`}
                  onClick={() => onChange(chips.filter((c) => c !== chip))}
                  className="grid h-5 w-5 -m-1.5 place-items-center rounded-full p-1.5 hover:bg-primary-100"
                >
                  <X size={12} weight="bold" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          aria-label={label}
          className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm shadow-sm transition-all duration-200 focus:border-primary focus:ring-4 focus:ring-primary/15 focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={addChip}
          disabled={disabled}
          aria-label="Tambah item"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-cta-gradient text-white shadow-glow-primary transition-transform duration-200 hover:scale-105 disabled:opacity-50"
        >
          <Plus size={18} weight="bold" aria-hidden />
        </button>
      </div>
    </div>
  );
}
