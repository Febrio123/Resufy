import { useState } from 'react';
import { PhotoUpload } from '../ui/PhotoUpload';
import { PhotoCrop } from '../ui/PhotoCrop';
import { Modal } from '../ui/Modal';

/**
 * PhotoSection — manajemen foto CV (upload, crop, delete).
 * Props:
 *   - photoUrl (string): URL foto dari server
 *   - photoCrop (object): { x, y, width, height } normalized 0-1
 *   - onUpload (fn): callback(file) → upload ke server
 *   - onCropUpdate (fn): callback(cropData) → update crop coordinates
 *   - onDelete (fn): callback() → hapus foto
 *   - uploading (bool): loading state upload
 *   - saving (bool): loading state save crop
 *   - deleting (bool): loading state delete
 *   - disabled (bool): disable all actions
 */
export function PhotoSection({
  photoUrl,
  photoCrop,
  onUpload,
  onCropUpdate,
  onDelete,
  uploading = false,
  saving = false,
  deleting = false,
  disabled = false,
}) {
  const [cropModalOpen, setCropModalOpen] = useState(false);

  const handleUploadComplete = (file) => {
    onUpload?.(file);
  };

  const handleCropSave = (cropData) => {
    onCropUpdate?.(cropData);
    setCropModalOpen(false);
  };

  return (
    <div className="space-y-4">
      <PhotoUpload
        photoUrl={photoUrl}
        onUpload={handleUploadComplete}
        onDelete={onDelete}
        uploading={uploading}
        deleting={deleting}
        disabled={disabled}
      />

      {/* Tombol crop — tampil hanya jika foto sudah ada */}
      {photoUrl && !uploading && (
        <button
          type="button"
          onClick={() => setCropModalOpen(true)}
          disabled={disabled || deleting}
          className="text-sm font-semibold text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Sesuaikan posisi foto (crop)
        </button>
      )}

      {/* Modal crop */}
      <Modal
        open={cropModalOpen}
        onClose={() => !saving && setCropModalOpen(false)}
        size="lg"
        hideClose={saving}
      >
        <PhotoCrop
          photoUrl={photoUrl}
          initialCrop={photoCrop}
          onSave={handleCropSave}
          onCancel={() => setCropModalOpen(false)}
          saving={saving}
        />
      </Modal>
    </div>
  );
}
