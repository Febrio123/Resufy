import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CaretLeft, MagnifyingGlass, ShieldCheck } from '@phosphor-icons/react';
import { plagiarismApi } from '../../../services/plagiarism';
import { useToast } from '../../../contexts/ToastContext';
import { Dropzone, SelectedFile } from '../../../components/Dropzone';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { extractErrorMessage } from '../../../utils/errors';
import { formatFileSize } from '../../../utils/format';
import { PLAGIARISM_ACCEPT } from '../../../utils/constants';

export default function PlagiarismNewPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!file) {
      toast.error('Pilih dokumen dulu.');
      return;
    }
    setUploading(true);
    try {
      const { data } = await plagiarismApi.upload(file);
      toast.success('Dokumen diterima — pemeriksaan dimulai.');
      navigate(`/app/plagiarism/${data.checkId}`, { replace: true });
    } catch (err) {
      toast.error(extractErrorMessage(err));
      setUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <Link
          to="/app"
          aria-label="Kembali ke dashboard"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-muted-fg hover:bg-muted"
        >
          <CaretLeft size={20} aria-hidden />
        </Link>
        <div>
          <h1 className="text-xl font-extrabold text-foreground">Cek Plagiarisme</h1>
          <p className="text-sm text-muted-fg">Unggah dokumen — hasil siap dalam beberapa menit.</p>
        </div>
      </div>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="info">Format: {PLAGIARISM_ACCEPT.label}</Badge>
          <Badge tone="info">Maks: {formatFileSize(PLAGIARISM_ACCEPT.maxSize)}</Badge>
          <Badge tone="gratis">Gratis cek</Badge>
        </div>

        {!file ? (
          <Dropzone
            accept={PLAGIARISM_ACCEPT.accept}
            acceptLabel={PLAGIARISM_ACCEPT.label}
            maxSize={PLAGIARISM_ACCEPT.maxSize}
            hint="Dokumen diperiksa terhadap sumber daring — privasimu terlindungi."
            onFile={setFile}
          />
        ) : (
          // "Ganti" = kosongkan pilihan → Dropzone tampil lagi untuk memilih file baru
          <SelectedFile file={file} onClear={() => setFile(null)} onReplace={() => setFile(null)} />
        )}

        <div className="flex flex-col gap-2 rounded-md bg-muted/60 px-4 py-3 text-xs text-muted-fg sm:flex-row sm:items-center sm:justify-between">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-primary" aria-hidden />
            Upload aman — file tidak dibagikan ke publik.
          </span>
          <span>Maks 5 pengecekan per jam.</span>
        </div>

        <Button
          variant="primary"
          size="lg"
          icon={MagnifyingGlass}
          className="w-full"
          onClick={handleUpload}
          loading={uploading}
          disabled={!file}
        >
          Mulai Pemeriksaan
        </Button>
      </Card>

      <p className="text-center text-xs text-muted-fg">
        Hasil pengecekan tersimpan di riwayat akunmu. Buka tab{' '}
        <Link to="/app?tab=plagiarism" className="font-bold text-primary hover:underline">
          Cek Plagiarisme
        </Link>{' '}
        di dashboard kapan saja.
      </p>
    </div>
  );
}
