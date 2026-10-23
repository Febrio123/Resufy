import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Download,
  Eye,
  FileText,
  PencilSimple,
  Plus,
  Trash,
  UserSquare,
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

export default function CvListPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const [cvs, setCvs] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  usePageMeta({
    title: 'CV Saya — HireUp',
    description: 'Riwayat dan pengelolaan CV ATS profesional kamu.',
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

  const openPdf = async (url) => {
    if (!user) {
      toast.error('Sesi berakhir — silakan masuk kembali');
      navigate('/login', { state: { next: window.location.pathname } });
      return;
    }
    try {
      await ensureFreshSession();
      window.open(url, '_blank', 'noopener');
    } catch {
      toast.error('Sesi berakhir — silakan masuk kembali');
      navigate('/login', { state: { next: window.location.pathname } });
    }
  };

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/80 pb-4">
        <div>
          <h1 className="text-2xl font-black text-foreground">CV Saya</h1>
          <p className="text-sm text-muted-fg mt-0.5">
            Daftar seluruh CV standar ATS yang tersimpan di akunmu. Siap diedit dan diunduh langsung.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link to="/app/cvs/new?template=with-photo">
            <Button variant="accent" size="sm" icon={UserSquare}>
              Buat Dengan Foto
            </Button>
          </Link>
          <Link to="/app/cvs/new?template=without-photo">
            <Button variant="primary" size="sm" icon={FileText}>
              Buat Tanpa Foto
            </Button>
          </Link>
        </div>
      </div>

      {!cvs ? (
        <ListSkeleton count={4} />
      ) : cvs.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Belum ada CV yang dibuat"
          description="Pilih salah satu template di bawah untuk mulai membuat CV ATS profesional."
          action={
            <div className="flex flex-wrap gap-3 justify-center">
              <Link to="/app/cvs/new?template=with-photo">
                <Button variant="accent" icon={UserSquare}>
                  Template Dengan Foto (Kiri Atas)
                </Button>
              </Link>
              <Link to="/app/cvs/new?template=without-photo">
                <Button variant="primary" icon={FileText}>
                  Template Tanpa Foto
                </Button>
              </Link>
            </div>
          }
        />
      ) : (
        <div className="grid gap-3">
          {cvs.map((cv) => {
            const isWithPhoto = cv.template === 'with-photo';
            return (
              <Card key={cv._id} padded={false} hoverable className="p-4 sm:p-5 border border-border/80 shadow-xs">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${
                        isWithPhoto
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-primary-100 text-primary-700'
                      }`}
                    >
                      {isWithPhoto ? (
                        <UserSquare size={24} weight="bold" />
                      ) : (
                        <FileText size={24} weight="bold" />
                      )}
                    </span>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/app/cvs/${cv._id}`}
                          className="truncate text-base font-extrabold text-foreground hover:text-primary transition-colors max-w-sm"
                        >
                          {cv.title || 'Curriculum Vitae'}
                        </Link>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isWithPhoto
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-blue-50 text-blue-800 border border-blue-200'
                          }`}
                        >
                          {isWithPhoto ? 'Foto Kiri Atas 3×4' : 'Standar Tanpa Foto'}
                        </span>
                        {cv.atsScore != null && (
                          <Badge tone={atsTone(cv.atsScore).tone}>
                            ATS {cv.atsScore}/100
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-fg">
                        Nama: <span className="font-semibold text-foreground">{cv.content?.personalInfo?.fullName || 'Belum diisi'}</span> · Diperbarui {formatDate(cv.updatedAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pl-[52px] sm:pl-0 pt-2 sm:pt-0 border-t border-border/40 sm:border-t-0">
                    <Button
                      variant="accent"
                      size="sm"
                      icon={Download}
                      onClick={() => openPdf(cvsApi.downloadPdfUrl(cv._id))}
                    >
                      Unduh PDF
                    </Button>
                    <Link to={`/app/cvs/${cv._id}/edit`}>
                      <Button variant="secondary" size="sm" icon={PencilSimple}>
                        Edit
                      </Button>
                    </Link>
                    <Link to={`/app/cvs/${cv._id}`}>
                      <Button variant="ghost" size="sm" icon={Eye}>
                        Detail
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setConfirmDelete(cv)}
                      aria-label={`Hapus ${cv.title}`}
                    >
                      <Trash size={16} className="text-destructive" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Konfirmasi Hapus */}
      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        size="sm"
        title="Hapus CV?"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-fg leading-relaxed">
            Apakah kamu yakin ingin menghapus CV{' '}
            <span className="font-bold text-foreground">{confirmDelete?.title}</span>? Tindakan ini tidak dapat dibatalkan.
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>
              Batal
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              loading={deletingId === confirmDelete?._id}
            >
              Hapus Permanen
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
