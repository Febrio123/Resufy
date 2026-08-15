import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  CaretLeft,
  Copy,
  Download,
  Eye,
  FloppyDisk,
  LockKey,
  PencilSimple,
} from '@phosphor-icons/react';
import { cvsApi } from '../../../services/cvs';
import { ensureFreshSession } from '../../../services/http';
import { useToast } from '../../../contexts/ToastContext';
import { usePaymentDialog } from '../../../contexts/PaymentDialogContext';
import { useAuth } from '../../../contexts/AuthContext';
import { CvForm } from '../../../components/cv/CvForm';
import { AtsPanel } from '../../../components/AtsPanel';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Card } from '../../../components/ui/Card';
import { PageLoader } from '../../../components/ui/Skeleton';
import { extractErrorMessage } from '../../../utils/errors';

export default function CvEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { openPayment } = usePaymentDialog();

  const [cv, setCv] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState({});
  const [ats, setAts] = useState(null);
  const [atsRunning, setAtsRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef(null);

  useEffect(() => {
    let alive = true;
    cvsApi
      .getById(id)
      .then(({ data }) => {
        if (!alive) return;
        const doc = data.cv;
        setCv(doc);
        setTitle(doc.title || '');
        setContent(doc.content || {});
        setAts(doc.atsScore != null ? { score: doc.atsScore, feedback: doc.atsFeedback } : null);
      })
      .catch((err) => {
        if (!alive) return;
        toast.error(extractErrorMessage(err));
        navigate('/app', { replace: true });
      })
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [id, navigate, toast]);

  // Auto-save draft (debounce 1.2s) — requirement: draft tersimpan otomatis
  const scheduleSave = useCallback(
    (nextContent) => {
      setContent(nextContent);
      setSaved(false);
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        try {
          await cvsApi.update(id, { content: nextContent });
          setSaved(true);
        } catch {
          setSaved(false);
        }
      }, 1200);
    },
    [id]
  );

  const handleSaveTitle = async () => {
    setSaving(true);
    try {
      await cvsApi.update(id, { title });
      toast.success('Judul CV disimpan.');
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleAts = async (jobDescription) => {
    setAtsRunning(true);
    try {
      const { data } = await cvsApi.runAts(id, { jobDescription: jobDescription || undefined });
      setAts({
        score: data.score,
        feedback: data.feedback || [],
        keywordMatch: data.keywordMatch,
      });
      toast.success('ATS check selesai.');
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setAtsRunning(false);
    }
  };

  const handleDuplicate = async () => {
    try {
      const { data } = await cvsApi.duplicate(id);
      toast.success('Salinan CV dibuat — versi baru bisa diedit.');
      navigate(`/app/cvs/${data.cv._id}/edit`);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  // Buka PDF via endpoint backend — segarkan sesi dulu (rotate access + refresh
  // cookie) supaya cookie 15 menit tidak memunculkan JSON 401 di tab baru.
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

  const openPreview = () => {
    if (cv?.paidStatus === 'paid') {
      openPdf(cvsApi.finalPdfUrl(id));
    } else {
      openPdf(cvsApi.previewPdfUrl(id));
    }
  };

  const handleDownloadFinal = () => {
    openPayment({
      itemType: 'cv',
      itemId: id,
      title: title || 'CV',
      subtitle: 'PDF berkualitas tinggi siap dikirim ke rekruter.',
      previewUrl: cvsApi.previewPdfUrl(id),
      onPaid: () => {},
    });
  };

  if (!loaded) return <PageLoader label="Memuat CV…" />;

  const isFinal = cv?.paidStatus === 'paid';

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
            <Input
              label="Judul CV"
              labelHidden
              aria-label="Judul CV"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleSaveTitle}
              className="border-0 bg-transparent text-lg font-extrabold shadow-none focus:ring-0"
              style={{ paddingLeft: 0, paddingRight: 0 }}
            />
            <Button variant="ghost" size="icon" onClick={handleSaveTitle} aria-label="Simpan judul" loading={saving}>
              <FloppyDisk size={18} aria-hidden />
            </Button>
          </div>
          <p className="text-xs text-muted-fg">
            {isFinal ? 'Status: Final — PDF terbayar tersimpan.' : 'Status: Draft — autosave aktif.'}
            {!saved && ' Menyimpan…'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={Eye} onClick={openPreview}>
            <span className="hidden sm:inline">Preview PDF</span>
            <span className="sm:hidden">Preview</span>
          </Button>
          {isFinal ? (
            <Button variant="accent" icon={Download} onClick={() => openPdf(cvsApi.finalPdfUrl(id))}>
              Unduh PDF Final
            </Button>
          ) : (
            <Button variant="accent" icon={PencilSimple} onClick={handleDownloadFinal}>
              Unduh HQ
            </Button>
          )}
        </div>
      </div>

      {/* Konten: form + sidebar ATS */}
      {isFinal ? (
        <Card className="space-y-3">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-success/15 text-success">
              <LockKey size={22} weight="bold" aria-hidden />
            </span>
            <div>
              <h2 className="text-base font-bold text-foreground">CV ini sudah final & dikunci</h2>
              <p className="mt-1 text-sm text-muted-fg">
                CV yang sudah dibayar tidak bisa diubah lagi (mencegah manipulasi PDF final yang
                sudah diunduh). Buat duplikat untuk membuat versi baru.
              </p>
            </div>
          </div>
          <Button variant="primary" icon={Copy} onClick={handleDuplicate}>
            Duplikat CV ini
          </Button>
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <CvForm content={content} onChange={scheduleSave} />

          <aside className="space-y-4 lg:sticky lg:top-8 lg:self-start">
            <AtsPanel score={ats?.score} feedback={ats?.feedback} keywordMatch={ats?.keywordMatch} onRun={handleAts} running={atsRunning} />
          </aside>
        </div>
      )}
    </div>
  );
}
