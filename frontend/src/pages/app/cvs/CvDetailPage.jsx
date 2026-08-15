import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  CaretLeft,
  Copy,
  Download,
  Eye,
  PencilSimple,
  Trash,
  Warning,
} from '@phosphor-icons/react';
import { cvsApi } from '../../../services/cvs';
import { ensureFreshSession } from '../../../services/http';
import { useToast } from '../../../contexts/ToastContext';
import { usePaymentDialog } from '../../../contexts/PaymentDialogContext';
import { useAuth } from '../../../contexts/AuthContext';
import { AtsPanel } from '../../../components/AtsPanel';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Card } from '../../../components/ui/Card';
import { Modal } from '../../../components/ui/Modal';
import { PageLoader } from '../../../components/ui/Skeleton';
import { PreviewBanner } from '../../../components/WatermarkOverlay';
import { extractErrorMessage } from '../../../utils/errors';
import { formatDate } from '../../../utils/format';
import { buildCvExport } from '../../../utils/cvJson';

export default function CvDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { openPayment } = usePaymentDialog();

  const [cv, setCv] = useState(null);
  const [ats, setAts] = useState(null);
  const [atsRunning, setAtsRunning] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let alive = true;
    cvsApi
      .getById(id)
      .then(({ data }) => {
        if (!alive) return;
        const doc = data.cv;
        setCv(doc);
        setAts(doc.atsScore != null ? { score: doc.atsScore, feedback: doc.atsFeedback } : null);
      })
      .catch((err) => {
        if (!alive) return;
        toast.error(extractErrorMessage(err));
        navigate('/app', { replace: true });
      });
    return () => {
      alive = false;
    };
  }, [id, navigate, toast]);

  // Buka PDF via endpoint backend (guard paid + signed URL). Hanya jalan saat
  // sesi masih valid — sebelum membuka tab, segarkan sesi (rotate access +
  // refresh cookie) supaya cookie 15 menit tidak memunculkan JSON 401 di tab
  // baru. Kalau refresh gagal, arahkan ke login dulu.
  const openPdf = async (url) => {
    if (!user) {
      toast.error('Sesi berakhir — silakan masuk kembali');
      navigate('/login', { state: { next: window.location.pathname } });
      return;
    }
    try {
      await ensureFreshSession();
    } catch {
      toast.error('Sesi berakhir — silakan masuk kembali');
      navigate('/login', { state: { next: window.location.pathname } });
      return;
    }
    window.open(url, '_blank', 'noopener');
  };

  // Salin CV sebagai JSON → bisa di-tempel di "Buat CV Baru" → mode Impor JSON.
  // Hanya data yang benar-benar tersimpan (title + content); url kosong di
  // proyek/sertifikasi di-strip (tidak disimpan backend — lihat utils/cvJson).
  const handleCopyJson = async () => {
    const payload = buildCvExport({ title: cv.title, content: cv.content });
    const text = JSON.stringify(payload, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      toast.success('JSON CV tersalin — tempel di "Buat CV Baru" → mode Impor JSON.');
    } catch {
      // Fallback untuk browser/konteks tanpa Clipboard API (execCommand).
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.top = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        toast.success('JSON CV tersalin — tempel di "Buat CV Baru" → mode Impor JSON.');
      } catch {
        toast.error('Gagal menyalin JSON — coba salin manual dari preview JSON di halaman ini.');
      }
    }
  };

  const handleDuplicate = async () => {
    try {
      const { data } = await cvsApi.duplicate(id);
      toast.success('Salinan CV dibuat.');
      navigate(`/app/cvs/${data.cv._id}/edit`);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await cvsApi.remove(id);
      toast.success('CV dihapus.');
      navigate('/app', { replace: true });
    } catch (err) {
      toast.error(extractErrorMessage(err));
      setDeleting(false);
    }
  };

  const handleAts = async (jobDescription) => {
    setAtsRunning(true);
    try {
      const { data } = await cvsApi.runAts(id, { jobDescription: jobDescription || undefined });
      setAts({ score: data.score, feedback: data.feedback || [], keywordMatch: data.keywordMatch });
      toast.success('ATS check selesai.');
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setAtsRunning(false);
    }
  };

  if (!cv) return <PageLoader label="Memuat CV…" />;

  const isFinal = cv.paidStatus === 'paid';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/app"
          aria-label="Kembali ke dashboard"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-muted-fg hover:bg-muted"
        >
          <CaretLeft size={20} aria-hidden />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-xl font-extrabold text-foreground">{cv.title}</h1>
            <Badge tone={isFinal ? 'selesai' : 'draft'}>{isFinal ? 'Final' : 'Draft'}</Badge>
          </div>
          <p className="text-xs text-muted-fg">
            Diperbarui {formatDate(cv.updatedAt)} ·{' '}
            {cv.content?.personalInfo?.fullName || 'Tanpa nama'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" icon={Copy} onClick={handleCopyJson}>
            Salin JSON
          </Button>
          <Button variant="secondary" size="sm" icon={Copy} onClick={handleDuplicate}>
            Duplikat
          </Button>
          <Link to={`/app/cvs/${id}/edit`}>
            <Button variant="primary" size="sm" icon={PencilSimple}>
              Edit
            </Button>
          </Link>
          <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(true)} aria-label="Hapus CV">
            <Trash size={18} aria-hidden />
          </Button>
        </div>
      </div>

      {/* Preview panel */}
      <Card padded={false} className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-bold text-foreground">Pratinjau Dokumen</p>
          {isFinal ? (
            <Button
              variant="accent"
              size="sm"
              icon={Download}
              onClick={() => openPdf(cvsApi.finalPdfUrl(id))}
            >
              Unduh PDF Final
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              icon={Eye}
              onClick={() => openPdf(cvsApi.previewPdfUrl(id))}
            >
              Buka Preview PDF
            </Button>
          )}
        </div>
        <div className="p-4">
          {!isFinal && <PreviewBanner text="Preview ber-watermark — bukan file final. Unduh HQ untuk versi tanpa watermark." />}
          <div className="mt-3 grid place-items-center rounded-md border border-dashed border-border bg-bg py-12 text-center">
            <div className="max-w-sm space-y-2">
              <Warning size={28} className="mx-auto text-warning" aria-hidden />
              <p className="text-sm font-semibold text-foreground">PDF dibuka di tab baru</p>
              <p className="text-xs text-muted-fg">
                Tekan tombol <span className="font-bold">Buka Preview PDF</span> untuk melihat hasil
                render sesungguhnya (format ATS satu kolom).
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* ATS + aksi bayar */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="space-y-3">
          <h2 className="text-base font-bold text-foreground">Langkah berikutnya</h2>
          {isFinal ? (
            <p className="text-sm text-muted-fg">
              CV ini sudah final & terbayar. Unduh PDF kapan saja tanpa biaya tambahan.
            </p>
          ) : (
            <ul className="space-y-2 text-sm text-muted-fg">
              <li className="flex items-center gap-2">
                <Badge tone="info">1</Badge> Lengkapi & perbaiki berdasarkan ATS score.
              </li>
              <li className="flex items-center gap-2">
                <Badge tone="info">2</Badge> Preview PDF ber-watermark (gratis).
              </li>
              <li className="flex items-center gap-2">
                <Badge tone="info">3</Badge> Bayar <span className="font-bold text-foreground">Rp2.000</span> untuk PDF
                HQ tanpa watermark — sekali bayar, selamanya.
              </li>
            </ul>
          )}
          {!isFinal && (
            <Button
              variant="accent"
              icon={Download}
              onClick={() =>
                openPayment({
                  itemType: 'cv',
                  itemId: id,
                  title: cv.title,
                  subtitle: 'PDF berkualitas tinggi siap dikirim ke rekruter.',
                  previewUrl: cvsApi.previewPdfUrl(id),
                })
              }
            >
              Unduh PDF HQ
            </Button>
          )}
        </Card>

        <AtsPanel score={ats?.score} feedback={ats?.feedback} keywordMatch={ats?.keywordMatch} onRun={handleAts} running={atsRunning} />
      </div>

      {/* Konfirmasi hapus */}
      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} size="sm" labelledBy="delete-cv-title" title="Hapus CV?">
        <div className="space-y-4">
          <p className="text-sm text-muted-fg">
            <span className="font-bold text-foreground">{cv.title}</span> akan dihapus permanen.
            Tindakan ini tidak bisa dibatalkan.
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Batal
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting}>
              Hapus Permanen
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
