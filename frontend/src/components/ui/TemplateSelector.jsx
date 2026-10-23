import { forwardRef } from 'react';
import { FileText, UserSquare, Check } from '@phosphor-icons/react';

/**
 * TemplateSelector — Pilih 2 Template Standar ATS:
 * 1. with-photo: CV dengan foto di sisi kiri pojok atas (3x4), layouting rapi & lulus standar ATS.
 * 2. without-photo: CV tanpa foto, single-column klasik full-width ATS.
 */
export const TemplateSelector = forwardRef(function TemplateSelector(
  { value = 'without-photo', onChange, disabled = false },
  ref
) {
  const templates = [
    {
      id: 'with-photo',
      name: 'Template Dengan Foto',
      badge: 'Foto Kiri Atas',
      description: 'Foto formal 3×4 di sisi kiri pojok atas, nama & kontak di kanan, layouting rapi standar ATS.',
      icon: UserSquare,
    },
    {
      id: 'without-photo',
      name: 'Template Tanpa Foto',
      badge: 'Standar Klasik',
      description: 'Layouting 1 kolom penuh tanpa foto, sangat direkomendasikan untuk ATS internasional.',
      icon: FileText,
    },
  ];

  return (
    <div ref={ref} className="space-y-3">
      <div>
        <label className="text-sm font-bold text-foreground">
          Pilih Format & Template CV (Standar ATS)
        </label>
        <p className="text-xs text-muted-fg mt-0.5">
          Kedua template didesain khusus agar lolos seleksi mesin parser ATS dengan layouting bersih dan rapi.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {templates.map((template) => {
          const Icon = template.icon;
          const isActive = value === template.id;
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => onChange?.(template.id)}
              disabled={disabled}
              className={`group relative flex items-start gap-3 rounded-xl border p-4 text-left transition-all duration-200 ${
                isActive
                  ? 'border-primary bg-primary-50/50 shadow-md ring-2 ring-primary/40'
                  : 'border-border bg-surface hover:border-primary/40 hover:shadow-sm'
              } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
            >
              <span
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-colors ${
                  isActive
                    ? 'bg-cta-gradient text-white shadow-glow-primary'
                    : 'bg-muted text-muted-fg group-hover:bg-primary-50 group-hover:text-primary'
                }`}
              >
                <Icon size={24} weight={isActive ? 'fill' : 'bold'} aria-hidden />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-sm text-foreground">{template.name}</p>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    isActive ? 'bg-primary text-white' : 'bg-muted text-muted-fg'
                  }`}>
                    {template.badge}
                  </span>
                </div>
                <p className="text-xs text-muted-fg mt-1 leading-relaxed">{template.description}</p>
              </div>

              <div
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-colors mt-0.5 ${
                  isActive ? 'border-primary bg-primary text-white' : 'border-border'
                }`}
              >
                {isActive && <Check size={12} weight="bold" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
});
