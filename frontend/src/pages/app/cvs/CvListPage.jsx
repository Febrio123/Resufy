import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Clock,
  Download,
  Eye,
  FileText,
  Info,
  LockKey,
  Plus,
  SealCheck,
  Trash,
} from '@phosphor-icons/react';
import { cvsApi } from '../../../services/cvs';
import { ensureFreshSession } from '../../../services/http';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Modal } from '../../../components/ui/Modal';
import { ListSkeleton } from '../../../components/ui/Skeleton';
import usePageMeta from '../../../hooks/usePageMeta';
import { atsTone, formatDate } from '../../../utils/format';
import { extractErrorMessage } from '../../../utils/errors';

/**
 * CV Saya — riwayat CV dengan status paid/unpaid.
 * - paid   → "Unduh Bersih (Tanpa Watermark)" (final-pdf) + "Preview".
 * - unpaid → "Preview (Ber-watermark)" (preview-pdf, gratis) + himbauan bayar.
 * - Semua kartu: tombol Hapus (Trash) → modal konfirmasi → cvsApi.deleteCv (soft delete).
 * Backend pdfService: preview = ber-watermark, final = bersih — otomatis.
 */
export default function CvListPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const [cvs, setCvs] = useState(null);

  // Konfirmasi hapus: confirmDelete = CV yang dipilih, deletingId = CV yang sedang dihapus.
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  usePageMeta({
    title: 'CV Saya — resufy',
    description:
      'Riwayat CV kamu: preview ber-watermark gratis, unduh versi bersih setelah bayar Rp2.000.',
  });

  useEffect(() => {
    let alive = true;
    cvsApi
      .list({ page: 1, limit: 100 })
      .then((res) => alive && setCvs(res.data.cvs || []))
      .catch((err) => alive && toast.error(extractErrorMessage(err)));
    return () => {
      alive = false;
    };
  }, [toast]);

  // Buka PDF via endpoint backend (guard paid + signed URL). Hanya jalan saat
  // sesi masih valid — sebelum membuka tab, segarkan sesi (rotate access +
  // refresh cookie) supaya cookie 15 menit tidak memunculkan JSON 401 di tab
  // baru. Kalau refresh gagal, arahkan ke login dulu (pola CvDetailPage).
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

  // Hapus: konfirmasi → soft delete → update state lokal (tanpa refetch penuh).
  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeletingId(confirmDelete._id);
    try {
      await cvsApi.deleteCv(confirmDelete._id);
      setCvs((prev) => prev.filter((cv) => cv._id !== confirmDelete._id));
      toast.success(`CV "${confirmDelete.title}" berhasil dihapus.`);
      setConfirmDelete(null);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">CV Saya</h1>
          <p className="text-sm text-muted-fg">
            Preview gratis (ber-watermark) — bayar Rp2.000 sekali untuk unduh versi bersih.
          </p>
        </div>
        <Link to="/app/cvs/new">
          <Button variant="accent" icon={Plus}>
            Buat CV Baru
          </Button>
        </Link>
      </div>

      {!cvs ? (
        <ListSkeleton count={4} />
      ) : cvs.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Belum ada CV"
          description="Buat CV pertamamu — gratis. Cek skor ATS dulu, baru bayar saat mau unduh PDF tanpa watermark."
          action={
            <Link to="/app/cvs/new">
              <Button variant="accent" icon={Plus}>
                Buat CV Baru
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {cvs.map((cv) => {
            const isPaid = cv.paidStatus === 'paid';
            return (
              <Card key={cv._id} padded={false} hoverable className="p-0">
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-cta-gradient text-white shadow-glow-primary">
                      <FileText size={20} weight="bold" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <Link
                        to={`/app/cvs/${cv._id}`}
                        className="block truncate text-sm font-bold text-foreground hover:text-primary"
                      >
                        {cv.title}
                      </Link>
                      <p className="text-xs text-muted-fg">Diperbarui {formatDate(cv.updatedAt)}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pl-[52px] sm:pl-0">
                    {cv.atsScore != null && (
                      <Badge tone={atsTone(cv.atsScore).tone}>ATS {cv.atsScore}/100</Badge>
                    )}

                    {/* Badge status — ikon + teks, bukan warna saja (a11y) */}
                    <Badge tone={isPaid ? 'paid' : 'pending'} icon={isPaid ? SealCheck : Clock}>
                      {isPaid ? 'Paid' : 'Belum Dibayar'}
                    </Badge>

                    {isPaid ? (
                      <>
                        <Button
                          variant="accent"
                          size="sm"
                          icon={Download}
                          onClick={() => openPdf(cvsApi.finalPdfUrl(cv._id))}
                        >
                          Unduh Bersih
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={Eye}
                          onClick={() => openPdf(cvsApi.previewPdfUrl(cv._id))}
                        >
                          Preview
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={Eye}
                          onClick={() => openPdf(cvsApi.previewPdfUrl(cv._id))}
                        >
                          Preview (Ber-watermark)
                        </Button>
                        <span
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-fg"
                          title="Bayar untuk unduh tanpa watermark"
                        >
                          <LockKey size={12} aria-hidden />
                          Bayar untuk unduh tanpa watermark
                        </span>
                      </>
                    )}

                    <span className="hidden h-6 w-px bg-border sm:block" aria-hidden />
                    <Button
                      variant="danger"
                      size="sm"
                      icon={Trash}
                      aria-label={`Hapus CV ${cv.title}`}
                      title="Hapus CV"
                      disabled={Boolean(deletingId)}
                      loading={deletingId === cv._id}
                      onClick={() => setConfirmDelete(cv)}
                    >
                      Hapus
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Konfirmasi hapus — destructive; catatan khusus untuk CV paid */}
      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => {
          if (!deletingId) setConfirmDelete(null);
        }}
        size="sm"
        labelledBy="cv-list-delete-title"
        title="Hapus CV?"
      >
        {confirmDelete && (
          <div className="space-y-4">
            <p className="text-sm text-muted-fg">
              <span className="font-bold text-foreground">{confirmDelete.title}</span> akan dihapus dari
              daftar. Tindakan ini tidak bisa dibatalkan.
            </p>
            {confirmDelete.paidStatus === 'paid' && (
              <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
                CV yang sudah dibayar tetap bisa dihapus — pastikan kamu sudah mengunduh PDF-nya. Akses
                unduh ulang tidak tersedia setelah CV dihapus.
              </p>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="secondary"
                onClick={() => setConfirmDelete(null)}
                disabled={Boolean(deletingId)}
              >
                Batal
              </Button>
              <Button
                variant="danger"
                icon={Trash}
                onClick={handleDelete}
                loading={Boolean(deletingId)}
              >
                Hapus CV
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
