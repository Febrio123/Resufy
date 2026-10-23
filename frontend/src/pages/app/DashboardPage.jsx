import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Download,
  FileText,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Sparkle,
  Trash,
  UserSquare,
  Copy,
  CheckCircle,
} from '@phosphor-icons/react';
import { cvsApi } from '../../services/cvs';
import { ensureFreshSession } from '../../services/http';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { ListSkeleton } from '../../components/ui/Skeleton';
import { Modal } from '../../components/ui/Modal';
import { useCountUp } from '../../hooks/useCountUp';
import { atsTone, formatDate } from '../../utils/format';
import { extractErrorMessage } from '../../utils/errors';

function greetingFor(hour) {
  if (hour < 11) return 'Selamat pagi';
  if (hour < 15) return 'Selamat siang';
  if (hour < 18) return 'Selamat sore';
  return 'Selamat malam';
}

function StatItem({ icon: Icon, grad, value, label, sub }) {
  const animated = useCountUp(value ?? 0, { duration: 0.9 });
  const text = value == null ? '—' : `${animated}`;
  return (
    <Card className="h-full p-4 border border-border/80 shadow-sm">
      <span
        className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ${grad} text-white shadow-md`}
        aria-hidden
      >
        <Icon size={20} weight="bold" />
      </span>
      <p className="mt-3 text-2xl font-extrabold tabular-nums text-foreground">{text}</p>
      <p className="text-xs font-bold text-muted-fg">{label}</p>
      {sub ? <p className="mt-0.5 text-[11px] text-muted-fg">{sub}</p> : null}
    </Card>
  );
}

export default function DashboardPage() {
  const toast = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const reduced = useReducedMotion();

  const [cvs, setCvs] = useState(null);
  const [search, setSearch] = useState('');
  const [filterTemplate, setFilterTemplate] = useState('all'); // 'all' | 'with-photo' | 'without-photo'
  const [deletingId, setDeletingId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCvs = useCallback(() => {
    cvsApi
      .list({ page: 1, limit: 100 })
      .then((res) => setCvs(res.data.cvs || []))
      .catch((err) => toast.error(extractErrorMessage(err)));
  }, [toast]);

  useEffect(() => {
    fetchCvs();
  }, [fetchCvs]);

  const openPdf = async (url) => {
    try {
      await ensureFreshSession();
      window.open(url, '_blank', 'noopener');
    } catch {
      toast.error('Sesi berakhir — silakan masuk kembali');
      navigate('/login');
    }
  };

  const handleDuplicate = async (id) => {
    try {
      const { data } = await cvsApi.duplicate(id);
      toast.success('Salinan CV berhasil dibuat.');
      fetchCvs();
      navigate(`/app/cvs/${data.cv._id}/edit`);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setDeleting(true);
    try {
      await cvsApi.remove(deletingId);
      toast.success('CV berhasil dihapus.');
      setDeletingId(null);
      fetchCvs();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const summary = useMemo(() => {
    if (!cvs) return { total: 0, withPhoto: 0, withoutPhoto: 0, avgAts: null };
    const total = cvs.length;
    const withPhoto = cvs.filter((c) => c.template === 'with-photo').length;
    const withoutPhoto = total - withPhoto;
    const scored = cvs.filter((c) => c.atsScore != null).map((c) => c.atsScore);
    const avgAts = scored.length
      ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length)
      : null;
    return { total, withPhoto, withoutPhoto, avgAts };
  }, [cvs]);

  const filteredCvs = useMemo(() => {
    if (!cvs) return [];
    return cvs.filter((cv) => {
      const matchSearch =
        search.trim() === '' ||
        (cv.title || '').toLowerCase().includes(search.toLowerCase()) ||
        (cv.content?.personalInfo?.fullName || '').toLowerCase().includes(search.toLowerCase());
      const matchTemplate =
        filterTemplate === 'all' ||
        (filterTemplate === 'with-photo' && cv.template === 'with-photo') ||
        (filterTemplate === 'without-photo' && cv.template !== 'with-photo');
      return matchSearch && matchTemplate;
    });
  }, [cvs, search, filterTemplate]);

  const firstName = user?.name?.split(' ')[0] || 'Kawan';
  const greeting = greetingFor(new Date().getHours());

  return (
    <div className="space-y-6">
      {/* ============ HERO SECTION ============ */}
      <motion.section
        initial={reduced ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        aria-label="Sapaan"
        className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary-50 via-surface to-indigo-50/70 p-6 sm:p-8 shadow-sm"
      >
        <div className="bg-grid-light absolute inset-0 opacity-40" aria-hidden />

        <div className="relative flex flex-col gap-5">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-primary ring-1 ring-inset ring-primary/20 shadow-xs">
            <Sparkle size={14} weight="fill" aria-hidden />
            CV Standar ATS Profesional
          </span>

          <div className="max-w-2xl">
            <h1 className="text-2xl font-black leading-tight text-foreground sm:text-3xl">
              {greeting}, <span className="text-gradient">{firstName}</span>!
            </h1>
            <p className="mt-2 text-sm text-muted-fg leading-relaxed">
              Buat CV standar ATS yang rapi, lulus seleksi rekruter & sistem parser. Pilih template dengan foto (letak di sisi kiri pojok atas) atau template klasik tanpa foto.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 pt-1">
            <Link to="/app/cvs/new?template=with-photo">
              <Button variant="accent" size="lg" icon={UserSquare}>
                Buat CV Dengan Foto
              </Button>
            </Link>
            <Link to="/app/cvs/new?template=without-photo">
              <Button variant="primary" size="lg" icon={FileText}>
                Buat CV Tanpa Foto
              </Button>
            </Link>
          </div>
        </div>
      </motion.section>

      {/* ============ STATISTIK RINGKAS ============ */}
      <section aria-label="Statistik CV" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatItem
          icon={FileText}
          grad="from-blue-600 to-indigo-600"
          value={summary.total}
          label="Total CV Tersimpan"
          sub="Dokumen aktif"
        />
        <StatItem
          icon={CheckCircle}
          grad="from-emerald-500 to-teal-600"
          value={summary.avgAts != null ? `${summary.avgAts}%` : '—'}
          label="Rata-rata Skor ATS"
          sub="Parser compliance"
        />
        <StatItem
          icon={UserSquare}
          grad="from-amber-500 to-orange-500"
          value={summary.withPhoto}
          label="Template Dengan Foto"
          sub="Foto kiri atas 3×4"
        />
        <StatItem
          icon={FileText}
          grad="from-purple-600 to-pink-600"
          value={summary.withoutPhoto}
          label="Template Tanpa Foto"
          sub="Klasik 1 kolom ATS"
        />
      </section>

      {/* ============ DAFTAR CV SAYA ============ */}
      <section className="space-y-4" aria-label="Daftar CV Saya">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/80 pb-3">
          <div>
            <h2 className="text-lg font-extrabold text-foreground">CV Saya</h2>
            <p className="text-xs text-muted-fg">Kelola, edit, cek ATS, dan unduh dokumen PDF siap cetak.</p>
          </div>

          {/* Filter & Search */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-56">
              <MagnifyingGlass
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-fg"
                aria-hidden
              />
              <input
                type="text"
                placeholder="Cari CV…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-xs text-foreground placeholder:text-muted-fg focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setFilterTemplate('all')}
                className={`rounded-md px-2.5 py-1 transition-colors ${
                  filterTemplate === 'all'
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-muted-fg hover:text-foreground'
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setFilterTemplate('with-photo')}
                className={`rounded-md px-2.5 py-1 transition-colors ${
                  filterTemplate === 'with-photo'
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-muted-fg hover:text-foreground'
                }`}
              >
                Dengan Foto
              </button>
              <button
                type="button"
                onClick={() => setFilterTemplate('without-photo')}
                className={`rounded-md px-2.5 py-1 transition-colors ${
                  filterTemplate === 'without-photo'
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-muted-fg hover:text-foreground'
                }`}
              >
                Tanpa Foto
              </button>
            </div>
          </div>
        </div>

        {/* List Content */}
        {!cvs ? (
          <ListSkeleton count={3} />
        ) : filteredCvs.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={cvs.length === 0 ? 'Belum ada CV' : 'Tidak ditemukan CV yang cocok'}
            description={
              cvs.length === 0
                ? 'Mulai buat CV pertamamu dengan template ATS yang dirancang lolos seleksi kerja.'
                : 'Coba ubah kata kunci pencarian atau filter template.'
            }
            action={
              cvs.length === 0 ? (
                <div className="flex flex-wrap gap-2 justify-center">
                  <Link to="/app/cvs/new?template=with-photo">
                    <Button variant="accent" icon={UserSquare}>
                      Buat CV Dengan Foto
                    </Button>
                  </Link>
                  <Link to="/app/cvs/new?template=without-photo">
                    <Button variant="primary" icon={FileText}>
                      Buat CV Tanpa Foto
                    </Button>
                  </Link>
                </div>
              ) : null
            }
          />
        ) : (
          <div className="grid gap-3">
            {filteredCvs.map((cv) => {
              const isWithPhoto = cv.template === 'with-photo';
              const atsInfo = atsTone(cv.atsScore);

              return (
                <Card key={cv._id} padded={false} hoverable className="p-4 sm:p-5 border border-border/80 shadow-xs">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3 min-w-0">
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
                            className="text-base font-extrabold text-foreground hover:text-primary transition-colors truncate max-w-md"
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
                            <Badge tone={atsInfo.tone}>
                              Skor ATS: {cv.atsScore}%
                            </Badge>
                          )}
                        </div>

                        <p className="text-xs text-muted-fg truncate">
                          Nama: <span className="font-semibold text-foreground">{cv.content?.personalInfo?.fullName || 'Belum diisi'}</span> · Diperbarui {formatDate(cv.updatedAt)}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t border-border/40 sm:border-t-0">
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
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Copy}
                        onClick={() => handleDuplicate(cv._id)}
                      >
                        Duplikat
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletingId(cv._id)}
                        aria-label="Hapus CV"
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
      </section>

      {/* Modal Konfirmasi Hapus */}
      <Modal
        open={Boolean(deletingId)}
        onClose={() => setDeletingId(null)}
        size="sm"
        title="Hapus CV?"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-fg leading-relaxed">
            Apakah kamu yakin ingin menghapus CV ini? Dokumen yang dihapus tidak dapat dipulihkan kembali.
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setDeletingId(null)}>
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
