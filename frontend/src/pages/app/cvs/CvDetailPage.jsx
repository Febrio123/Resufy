import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  CaretLeft,
  Copy,
  Download,
  Eye,
  PencilSimple,
  Trash,
  UserSquare,
  FileText,
} from '@phosphor-icons/react';
import { cvsApi } from '../../../services/cvs';
import { ensureFreshSession } from '../../../services/http';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { AtsPanel } from '../../../components/AtsPanel';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Card } from '../../../components/ui/Card';
import { Modal } from '../../../components/ui/Modal';
import { PageLoader } from '../../../components/ui/Skeleton';
import { extractErrorMessage } from '../../../utils/errors';
import { formatDate } from '../../../utils/format';
import { buildCvExport } from '../../../utils/cvJson';

export default function CvDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();

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

  const handleCopyJson = async () => {
    const payload = buildCvExport({ title: cv.title, content: cv.content });
    const text = JSON.stringify(payload, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      toast.success('JSON CV tersalin.');
    } catch {
      toast.error('Gagal menyalin JSON.');
    }
  };

  const handleDuplicate = async () => {
    try {
      const { data } = await cvsApi.duplicate(id);
      toast.success('Salinan CV berhasil dibuat.');
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
      toast.success('Pemeriksaan skor ATS selesai.');
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setAtsRunning(false);
    }
  };

  if (!cv) return <PageLoader label="Memuat CV…" />;

  const isWithPhoto = cv.template === 'with-photo';
  const c = cv.content || {};
  const p = c.personalInfo || {};

  return (
    <div className="space-y-6">
      {/* Top Bar Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/app"
          aria-label="Kembali ke dashboard"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-muted-fg hover:bg-muted transition-colors"
        >
          <CaretLeft size={20} aria-hidden />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-xl font-extrabold text-foreground">{cv.title}</h1>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                isWithPhoto
                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                  : 'bg-blue-100 text-blue-800 border border-blue-300'
              }`}
            >
              {isWithPhoto ? 'Template Dengan Foto' : 'Template Tanpa Foto'}
            </span>
          </div>
          <p className="text-xs text-muted-fg mt-0.5">
            Diperbarui {formatDate(cv.updatedAt)} · {p.fullName || 'Nama belum diisi'}
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
              Edit CV
            </Button>
          </Link>
          <Button
            variant="accent"
            size="sm"
            icon={Download}
            onClick={() => openPdf(cvsApi.downloadPdfUrl(id))}
          >
            Unduh PDF
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(true)} aria-label="Hapus CV">
            <Trash size={18} className="text-destructive" />
          </Button>
        </div>
      </div>

      {/* Main Grid: Live Visual Preview Paper + ATS Checker Sidebar */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* CV Document Visual Preview Paper */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-fg">Pratinjau Layout Dokumen</span>
              <span className="text-[11px] text-muted-fg">({isWithPhoto ? 'Foto Pojok Kiri Atas 3×4' : '1 Kolom Standar ATS'})</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              icon={Eye}
              onClick={() => openPdf(cvsApi.previewPdfUrl(id))}
            >
              Review PDF (Adobe Acrobat)
            </Button>
          </div>

          <div className="rounded-2xl border border-border/80 bg-white p-5 sm:p-8 shadow-sm text-gray-900 font-serif">
            {/* Header Area */}
            {isWithPhoto ? (
              <div className="flex items-start gap-4 border-b border-gray-300 pb-3 mb-4">
                {/* Foto di sisi kiri pojok atas */}
                <div className="w-16 h-[84px] shrink-0 rounded border border-gray-300 bg-gray-50 overflow-hidden flex items-center justify-center shadow-xs">
                  {cv.photoUrl ? (
                    <img src={cv.photoUrl} alt="Foto Profil Formal" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-1.5 text-gray-400 text-[9px] font-semibold leading-tight">
                      Foto 3×4
                    </div>
                  )}
                </div>

                {/* Nama & Kontak di sisi kanan foto */}
                <div className="min-w-0 flex-1 pt-0.5">
                  <h2 className="text-xl font-bold tracking-tight text-gray-950">
                    {p.fullName || 'Nama Lengkap'}
                  </h2>
                  <div className="mt-1.5 text-[11px] text-gray-600 space-y-0.5">
                    <p>{[p.email, p.phone].filter(Boolean).join('   |   ')}</p>
                    <p>{[p.location, p.linkedinUrl, p.website].filter(Boolean).join('   |   ')}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border-b border-gray-300 pb-3 mb-4">
                <h2 className="text-xl font-bold tracking-tight text-gray-950">
                  {p.fullName || 'Nama Lengkap'}
                </h2>
                <p className="mt-1 text-[11px] text-gray-600">
                  {[p.email, p.phone, p.location, p.linkedinUrl, p.website].filter(Boolean).join('   |   ')}
                </p>
              </div>
            )}

            {/* Sections */}
            <div className="space-y-3 text-[11px] leading-relaxed text-gray-800">
              {/* Ringkasan */}
              {c.profileSummary && (
                <div>
                  <h3 className="font-bold uppercase tracking-wider text-gray-950 text-[11px] border-b border-gray-200 pb-0.5 mb-1.5">
                    Ringkasan Profil
                  </h3>
                  <p className="text-gray-700 leading-relaxed text-justify">{c.profileSummary}</p>
                </div>
              )}

              {/* Pengalaman */}
              {Array.isArray(c.workExperiences) && c.workExperiences.length > 0 && (
                <div>
                  <h3 className="font-bold uppercase tracking-wider text-gray-950 text-[11px] border-b border-gray-200 pb-0.5 mb-2">
                    Pengalaman Kerja
                  </h3>
                  <div className="space-y-2.5">
                    {c.workExperiences.map((exp, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between items-baseline font-bold text-gray-900">
                          <span className="text-xs">{exp.jobTitle || 'Posisi'}</span>
                          <span className="text-[10px] font-normal text-gray-500">
                            {[exp.startDate, exp.isCurrent ? 'Sekarang' : exp.endDate].filter(Boolean).join(' — ')}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-600">{[exp.company, exp.location].filter(Boolean).join(' — ')}</p>
                        {exp.description && (
                          <div className="pt-1.5 text-[11px] text-gray-700 leading-relaxed whitespace-pre-line">
                            {exp.description
                              .split('\n')
                              .map((line) => line.replace(/^[\s•\-\*–—\u2022\d+\.\)]+/, '').trim())
                              .filter(Boolean)
                              .join('\n')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pendidikan */}
              {Array.isArray(c.educations) && c.educations.length > 0 && (
                <div>
                  <h3 className="font-bold uppercase tracking-wider text-gray-950 text-[11px] border-b border-gray-200 pb-0.5 mb-2">
                    Pendidikan
                  </h3>
                  <div className="space-y-2.5">
                    {c.educations.map((edu, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between items-baseline font-bold text-gray-900">
                          <span className="text-xs">{edu.degree || 'Program Studi'}</span>
                          <span className="text-[10px] font-normal text-gray-500">
                            {[edu.startDate, edu.endDate].filter(Boolean).join(' — ')}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-600">
                          {[edu.institution, edu.location, edu.gpa ? `IPK: ${edu.gpa}` : null].filter(Boolean).join(' — ')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Keahlian */}
              {Array.isArray(c.skills) && c.skills.length > 0 && (
                <div>
                  <h3 className="font-bold uppercase tracking-wider text-gray-950 text-[11px] border-b border-gray-200 pb-0.5 mb-1.5">
                    Keahlian
                  </h3>
                  <p className="text-gray-700 leading-relaxed">{c.skills.join('   •   ')}</p>
                </div>
              )}

              {/* Sertifikasi */}
              {Array.isArray(c.certifications) && c.certifications.length > 0 && (
                <div>
                  <h3 className="font-bold uppercase tracking-wider text-gray-950 text-[11px] border-b border-gray-200 pb-0.5 mb-1.5">
                    Sertifikasi
                  </h3>
                  <div className="space-y-1">
                    {c.certifications.map((cert, idx) => (
                      <div key={idx} className="flex justify-between text-[11px]">
                        <span className="font-bold text-gray-900">{cert.name}</span>
                        <span className="text-gray-500">{[cert.issuer, cert.date].filter(Boolean).join(' — ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Proyek */}
              {Array.isArray(c.projects) && c.projects.length > 0 && (
                <div>
                  <h3 className="font-bold uppercase tracking-wider text-gray-950 text-[11px] border-b border-gray-200 pb-0.5 mb-2">
                    Proyek
                  </h3>
                  <div className="space-y-2.5">
                    {c.projects.map((proj, idx) => (
                      <div key={idx} className="space-y-1">
                        <p className="font-bold text-xs text-gray-900">{proj.name}</p>
                        {Array.isArray(proj.techStack) && proj.techStack.length > 0 && (
                          <p className="text-[10px] text-gray-500 italic">Teknologi: {proj.techStack.join(', ')}</p>
                        )}
                        {proj.description && (
                          <p className="pt-1 text-[11px] text-gray-700 leading-relaxed whitespace-pre-line">
                            {proj.description
                              .split('\n')
                              .map((line) => line.replace(/^[\s•\-\*–—\u2022\d+\.\)]+/, '').trim())
                              .filter(Boolean)
                              .join('\n')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bahasa */}
              {Array.isArray(c.languages) && c.languages.length > 0 && (
                <div>
                  <h3 className="font-bold uppercase tracking-wider text-gray-950 text-[11px] border-b border-gray-200 pb-0.5 mb-1.5">
                    Bahasa
                  </h3>
                  <p className="text-gray-700 text-[11px]">
                    {c.languages.map((l) => `${l.name}${l.proficiency ? ` (${l.proficiency})` : ''}`).join('   •   ')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ATS Checker Panel & Info Sidebar */}
        <div className="space-y-5">
          <AtsPanel
            score={ats?.score}
            feedback={ats?.feedback}
            keywordMatch={ats?.keywordMatch}
            onRun={handleAts}
            running={atsRunning}
          />

          <Card className="space-y-3 border border-border/80 shadow-xs">
            <h2 className="text-sm font-bold text-foreground">Informasi Template</h2>
            <div className="space-y-2 text-xs text-muted-fg leading-relaxed">
              <p>
                <strong className="text-foreground">Tipe Layout:</strong>{' '}
                {isWithPhoto ? 'Dengan Foto (3×4 Pojok Kiri Atas)' : 'Tanpa Foto (Single Column Klasik)'}
              </p>
              <p>
                <strong className="text-foreground">Standar ATS:</strong> Memenuhi standar struktur hirarki teks, tipografi Helvetica berlisensi bebas error, dan single-column flow tanpa tabel kompleks.
              </p>
              <p>
                <strong className="text-foreground">Penyimpanan Foto:</strong> Foto disimpan aman di Cloudinary CDN.
              </p>
            </div>
            <Link to={`/app/cvs/${id}/edit`} className="block pt-2">
              <Button variant="secondary" size="sm" className="w-full">
                Ubah Template / Edit Konten
              </Button>
            </Link>
          </Card>
        </div>
      </div>

      {/* Modal Konfirmasi Hapus */}
      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} size="sm" title="Hapus CV?">
        <div className="space-y-4">
          <p className="text-sm text-muted-fg">
            <span className="font-bold text-foreground">{cv.title}</span> akan dihapus permanen.
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
