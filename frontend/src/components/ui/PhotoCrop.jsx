import { useCallback, useState } from 'react';
import Cropper from 'react-easy-crop';
import { Button } from './Button';
import { CheckCircle, X } from '@phosphor-icons/react';

/**
 * PhotoCrop — crop foto dengan react-easy-crop.
 * Props:
 *   - photoUrl (string): URL foto yang akan di-crop
 *   - initialCrop (object): { x, y, width, height } normalized 0-1 (reserved for future use)
 *   - onSave (fn): callback(cropData) → { x, y, width, height }
 *   - onCancel (fn): callback()
 *   - saving (bool): loading state saat menyimpan
 */
export function PhotoCrop({
  photoUrl,
  initialCrop = { x: 0, y: 0, width: 1, height: 1 }, // eslint-disable-line no-unused-vars
  onSave,
  onCancel,
  saving = false,
}) {
  // react-easy-crop menggunakan crop position (x, y pixels) + zoom
  // Kita convert dari normalized crop → initial position
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSave = () => {
    if (!croppedAreaPixels) return;

    // Convert pixels → normalized 0-1 (backend expects normalized)
    // Kita perlu image dimensions asli — react-easy-crop tidak expose,
    // jadi kita load image untuk mendapat naturalWidth/Height
    const img = new Image();
    img.onload = () => {
      const normalized = {
        x: croppedAreaPixels.x / img.naturalWidth,
        y: croppedAreaPixels.y / img.naturalHeight,
        width: croppedAreaPixels.width / img.naturalWidth,
        height: croppedAreaPixels.height / img.naturalHeight,
      };
      onSave?.(normalized);
    };
    img.src = photoUrl;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-foreground">Sesuaikan Foto</h3>
          <p className="text-sm text-muted-fg">
            Geser dan zoom untuk memilih area foto yang akan ditampilkan
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Tutup crop"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-muted-fg hover:bg-muted hover:text-foreground"
        >
          <X size={20} aria-hidden />
        </button>
      </div>

      {/* Crop area — 3:4 aspect ratio untuk foto formal */}
      <div className="relative h-96 overflow-hidden rounded-xl border border-border bg-muted">
        <Cropper
          image={photoUrl}
          crop={crop}
          zoom={zoom}
          aspect={3 / 4}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          objectFit="contain"
          style={{
            containerStyle: {
              backgroundColor: '#f1f5f9',
            },
            cropAreaStyle: {
              border: '2px solid #2563eb',
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
            },
          }}
        />
      </div>

      {/* Zoom slider */}
      <div className="space-y-2">
        <label htmlFor="zoom-slider" className="text-sm font-semibold text-foreground">
          Zoom
        </label>
        <input
          id="zoom-slider"
          type="range"
          min={1}
          max={3}
          step={0.1}
          value={zoom}
          onChange={(e) => setZoom(parseFloat(e.target.value))}
          className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary"
        />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={saving}
        >
          Batal
        </Button>
        <Button
          type="button"
          variant="primary"
          icon={CheckCircle}
          onClick={handleSave}
          loading={saving}
          className="flex-1 sm:flex-initial"
        >
          Simpan Crop
        </Button>
      </div>

      {/* Info */}
      <p className="rounded-lg bg-primary-100/30 px-3 py-2 text-xs text-muted-fg">
        ℹ️ Foto akan ditampilkan dengan rasio 3×4 (portrait) di header CV.
        Pastikan wajah terlihat jelas dan latar polos.
      </p>
    </div>
  );
}
