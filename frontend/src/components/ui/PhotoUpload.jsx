import { useRef, useState } from 'react';
import { Camera, Image as ImageIcon, Trash, WarningCircle } from '@phosphor-icons/react';
import { Button } from './Button';
import { formatFileSize } from '../../utils/format';

/**
 * PhotoUpload — upload foto 3x4 dengan preview + drag-drop.
 * Accept: JPG/PNG only, max 5MB.
 * Props: photoUrl (string URL dari server), onUpload (fn), onDelete (fn), 
 *        uploading (bool), deleting (bool), disabled (bool)
 */
export function PhotoUpload({
  photoUrl,
  onUpload,
  onDelete,
  uploading = false,
  deleting = false,
  disabled = false,
}) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');

  const ALLOWED_TYPES = ['image/jpeg', 'image/png'];
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB

  const validate = (file) => {
    if (!file) return false;

    // Type check
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Format harus JPG atau PNG');
      return false;
    }

    // Size check
    if (file.size > MAX_SIZE) {
      setError(`Ukuran maksimal ${formatFileSize(MAX_SIZE)}`);
      return false;
    }

    setError('');
    return true;
  };

  const handleFile = (file) => {
    if (!validate(file)) return;

    // Preview lokal
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target.result);
    };
    reader.readAsDataURL(file);

    // Upload ke server
    onUpload?.(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled || uploading) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleInputChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleFile(files[0]);
    }
    // Reset input
    e.target.value = '';
  };

  const handleDelete = () => {
    setPreview(null);
    setError('');
    onDelete?.();
  };

  const currentPhoto = photoUrl || preview;

  // Foto sudah ada
  if (currentPhoto) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-foreground">Foto Profil</label>
          <span className="text-xs text-muted-fg">3×4 rasio</span>
        </div>
        
        <div className="relative overflow-hidden rounded-xl border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-start gap-4">
            {/* Preview foto */}
            <div className="relative h-32 w-24 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
              <img
                src={currentPhoto}
                alt="Foto profil"
                className="h-full w-full object-cover"
              />
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
                </div>
              )}
            </div>

            {/* Info + aksi */}
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Foto terupload</p>
                <p className="text-xs text-muted-fg">
                  Foto akan muncul di header CV. Gunakan foto formal dengan latar polos.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={ImageIcon}
                  onClick={() => inputRef.current?.click()}
                  disabled={disabled || uploading || deleting}
                >
                  Ganti Foto
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  icon={Trash}
                  onClick={handleDelete}
                  loading={deleting}
                  disabled={disabled || uploading}
                >
                  Hapus
                </Button>
              </div>
            </div>
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png"
          className="hidden"
          onChange={handleInputChange}
        />
      </div>
    );
  }

  // Belum ada foto — dropzone
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-foreground">Foto Profil</label>
        <span className="text-xs text-muted-fg">Opsional</span>
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-label="Upload foto profil"
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !uploading) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled && !uploading) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={`relative flex min-h-40 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 text-center transition-all duration-200 ${
          dragOver
            ? 'border-primary bg-primary-50 shadow-lg'
            : 'border-border bg-surface hover:border-primary/50 hover:shadow-md'
        } ${disabled || uploading ? 'cursor-not-allowed opacity-50' : ''}`}
      >
        <span className="grid h-14 w-14 place-items-center rounded-xl bg-primary-100 text-primary">
          <Camera size={28} weight="duotone" aria-hidden />
        </span>
        
        <div>
          <p className="text-sm font-bold text-foreground">
            {uploading ? 'Mengunggah...' : 'Upload foto atau seret ke sini'}
          </p>
          <p className="mt-1 text-xs text-muted-fg">
            JPG atau PNG, maks 5MB
          </p>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          icon={ImageIcon}
          disabled={disabled || uploading}
          loading={uploading}
        >
          Pilih Foto
        </Button>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          onChange={handleInputChange}
          disabled={disabled || uploading}
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
