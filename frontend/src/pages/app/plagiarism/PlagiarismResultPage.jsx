import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CaretLeft, CheckCircle, Copy, Download, Eye, UsersThree } from '@phosphor-icons/react';
import { plagiarismApi } from '../../../services/plagiarism';
import { ensureFreshSession } from '../../../services/http';
import { useToast } from '../../../contexts/ToastContext';
import { usePaymentDialog } from '../../../contexts/PaymentDialogContext';
import { useAuth } from '../../../contexts/AuthContext';
import { usePolling } from '../../../hooks/usePolling';
import { ProgressSteps } from '../../../components/ProgressSteps';
import { StatCard } from '../../../components/StatCard';
import { SegmentHighlight } from '../../../components/plagiarism/SegmentHighlight';
import { PreviewBanner } from '../../../components/WatermarkOverlay';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { PageLoader } from '../../../components/ui/Skeleton';
import { extractErrorMessage } from '../../../utils/errors';
import { formatDate, similarityTone } from '../../../utils/format';

const TERMINAL = ['completed', 'failed'];

export default function PlagiarismResultPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { openPayment } = usePaymentDialog();

  const [check, setCheck] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  // Filter daftar segmen: 'all' = semua, 'flagged' = hanya terindikasi (default)
  const [segFilter, setSegFilter] = useState('flagged');

  const fetchOnce = useCallback(() => plagiarismApi.getById(id).then((r) => r.data.check), [id]);

  usePolling({
    enabled: loaded && check && !TERMINAL.includes(check.status),
    fn: fetchOnce,
    stopWhen: (d) => TERMINAL.includes(d.status),
    onComplete: (d) => {
      setCheck(d);
      if (d.status === 'completed') toast.success('Pemeriksaan selesai.');
      if (d.status === 'failed') toast.error(d.errorMessage || 'Pemeriksaan gagal — coba unggah ulang.');
    },
    interval: 5000,
    maxAttempts: 60,
  });

  useEffect(() => {
    let alive = true;
    plagiarismApi
      .getById(id)
      .then(({ data }) => alive && setCheck(data.check))
      .catch((err) => alive && setError(extractErrorMessage(err)))
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [id]);

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

  if (error) {
    return (
      <div className="space-y-5">
        <Link to="/app/plagiarism" className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline">
          <CaretLeft size={16} aria-hidden /> Kembali
        </Link>
        <EmptyState icon={CheckCircle} title="Laporan tidak ditemukan" description={error} />
      </div>
    );
  }

  if (!loaded || !check) return <PageLoader label="Memuat laporan…" />;

  const running = !TERMINAL.includes(check.status);
  const tone = similarityTone(check.overallScore);
  const isPaid = check.paidStatus === 'paid';

  // Segmen: urut skor turun + filter terindikasi (score >= 0.15 atau ada sumber)
  const segments = check.segments || [];
  const sortedSegments = [...segments].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const flaggedSegments = sortedSegments.filter(
    (s) => (s.score ?? 0) >= 0.15 || (s.matchedSources?.length ?? 0) > 0,
  );
  const visibleSegments = segFilter === 'all' ? sortedSegments : flaggedSegments;

  // Distribusi band skor segmen (<30 / 30–59 / ≥60) untuk bar tanpa SVG
  const dist = { low: 0, mid: 0, high: 0, total: segments.length || 1 };
  for (const s of segments) {
    const pct = (s.score ?? 0) * 100;
    if (pct < 30) dist.low += 1;
    else if (pct < 60) dist.mid += 1;
    else dist.high += 1;
  }

  // Metadata scan (backend baru; null utk dokumen lama) — progress & label
  const hasScanMeta =
    typeof check.totalSegments === 'number' &&
    check.totalSegments > 0 &&
    typeof check.scannedSegments === 'number';
  const scanProgress = hasScanMeta
    ? Math.min(100, Math.max(0, Math.round((check.scannedSegments / check.totalSegments) * 100)))
    : 0;

  let scanBadge = null;
  if (check.scanMode === 'full' && hasScanMeta) {
    scanBadge = {
      tone: 'paid',
      label: `Scan penuh — ${check.scannedSegments} dari ${check.totalSegments} segmen`,
    };
  } else if (check.scanMode === 'sample' && hasScanMeta) {
    scanBadge = {
      tone: 'proses',
      label: `Scan sampel — ${check.scannedSegments} dari ${check.totalSegments} segmen diperiksa`,
      tip: 'Plagiasi sudah terdeteksi >18%, pemeriksaan lanjutan tidak diperlukan.',
    };
  }

  // Sumber internal (local corpus) — default [] utk dokumen lama → disembunyikan
  const localSources = check.localSources || [];
  const localCount = localSources.length;

  // Grid stat ringkasan menyesuaikan jumlah stat (4 + scan + internal)
  const statCount = 4 + (hasScanMeta ? 1 : 0) + (localCount > 0 ? 1 : 0);
  const summaryGrid =
    statCount >= 6
      ? 'sm:grid-cols-2 lg:grid-cols-3'
      : statCount === 5
        ? 'sm:grid-cols-2 lg:grid-cols-5'
        : 'sm:grid-cols-4';

  const hostnameOf = (url) => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  };

  const copySegmentText = async (seg) => {
    const content = seg.text || seg.textSnippet || '';
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      toast.success('Teks tersalin — tempel di editor untuk revisi');
    } catch {
      toast.error('Gagal menyalin teks — salin manual dari teks di atas');
    }
  };

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
            <h1 className="truncate text-xl font-extrabold text-foreground">
              {check.originalFilename || 'Laporan Plagiarisme'}
            </h1>
            {running ? (
              <Badge tone="proses">Sedang diperiksa</Badge>
            ) : check.status === 'failed' ? (
              <Badge tone="gagal">Gagal</Badge>
            ) : (
              <Badge tone={tone.badge}>{tone.label}</Badge>
            )}
          </div>
          <p className="text-xs text-muted-fg">
            {formatDate(check.createdAt)} · {check.fileType?.toUpperCase()}
            {!running && check.status === 'completed' && scanBadge && (
              <>
                {' '}·{' '}
                <span title={scanBadge.tip || undefined} className="align-middle">
                  <Badge tone={scanBadge.tone}>{scanBadge.label}</Badge>
                </span>
              </>
            )}
          </p>
        </div>
        {!running && check.status === 'completed' && (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              icon={Eye}
              onClick={() => openPdf(plagiarismApi.previewPdfUrl(id))}
            >
              Preview PDF
            </Button>
            {isPaid ? (
              <Button
                variant="accent"
                icon={Download}
                onClick={() => openPdf(plagiarismApi.finalPdfUrl(id))}
              >
                Unduh PDF Final
              </Button>
            ) : (
              <Button
                variant="accent"
                icon={Download}
                onClick={() =>
                  openPayment({
                    itemType: 'plagiarism',
                    itemId: id,
                    title: 'Laporan Plagiarisme',
                    subtitle: `${check.originalFilename || 'Dokumen'} — PDF berkualitas tinggi.`,
                    previewUrl: plagiarismApi.previewPdfUrl(id),
                  })
                }
              >
                Unduh HQ
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Sedang berjalan */}
      {running && (
        <Card>
          <div className="grid gap-6 md:grid-cols-2">
            <ProgressSteps activeIndex={0} />
            <div className="space-y-3">
              <h2 className="text-base font-bold text-foreground">Sedang memeriksa…</h2>
              {hasScanMeta ? (
                <>
                  <p className="text-sm text-muted-fg" aria-live="polite">
                    Memindai segmen {check.scannedSegments} dari {check.totalSegments} — status
                    diperbarui otomatis setiap 5 detik.
                  </p>
                  <div
                    role="progressbar"
                    aria-label="Progres pemindaian segmen"
                    aria-valuemin={0}
                    aria-valuemax={check.totalSegments}
                    aria-valuenow={check.scannedSegments}
                    className="h-2.5 w-full overflow-hidden rounded-full bg-muted/60"
                  >
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-500"
                      style={{ width: `${scanProgress}%` }}
                      aria-hidden
                    />
                  </div>
                  <p className="text-xs text-muted-fg">Butuh ±2–4 menit — biarkan halaman ini terbuka.</p>
                </>
              ) : (
                <p className="text-sm text-muted-fg">
                  Dokumen dibandingkan terhadap sumber daring. Status diperbarui otomatis setiap 5
                  detik — biarkan halaman ini terbuka. Butuh ±2–4 menit.
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Gagal */}
      {!running && check.status === 'failed' && (
        <EmptyState
          icon={CheckCircle}
          title="Pemeriksaan gagal"
          description={check.errorMessage || 'Terjadi kendala saat memproses dokumen. Silakan unggah ulang.'}
          action={
            <Link to="/app/plagiarism">
              <Button variant="primary">Unggah Ulang</Button>
            </Link>
          }
        />
      )}

      {/* Selesai: hasil — laporan profesional */}
      {!running && check.status === 'completed' && (
        <>
          {/* a. Header ringkasan */}
          <div className="grid gap-5 md:grid-cols-[auto_minmax(0,1fr)]">
            <Card className="flex flex-col items-center justify-center gap-1">
              <StatCard score={check.overallScore} tone={tone.tone} label="Kemiripan" suffix="%" />
              <p className="text-xs text-muted-fg">{tone.description}</p>
            </Card>

            <Card className="space-y-4">
              <h2 className="text-base font-bold text-foreground">Ringkasan</h2>
              <dl className={`grid gap-3 text-sm ${summaryGrid}`}>
                <div className="rounded-md bg-bg p-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-fg">Kemiripan</dt>
                  <dd className="mt-1 text-lg font-extrabold tabular-nums text-foreground">
                    {check.overallScore ?? 0}%
                  </dd>
                </div>
                <div className="rounded-md bg-bg p-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-fg">Sumber mirip</dt>
                  <dd className="mt-1 text-lg font-extrabold tabular-nums text-foreground">
                    {check.sources?.length ?? 0}
                  </dd>
                </div>
                <div className="rounded-md bg-bg p-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-fg">Segmen terindikasi</dt>
                  <dd className="mt-1 text-lg font-extrabold tabular-nums text-foreground">
                    {flaggedSegments.length}
                  </dd>
                </div>
                <div className="rounded-md bg-bg p-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-fg">Total segmen</dt>
                  <dd className="mt-1 text-lg font-extrabold tabular-nums text-foreground">
                    {segments.length}
                  </dd>
                </div>
                {hasScanMeta && (
                  <div className="rounded-md bg-bg p-3">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-fg">Segmen diperiksa</dt>
                    <dd className="mt-1 text-lg font-extrabold tabular-nums text-foreground">
                      {check.scannedSegments}
                      <span className="text-sm font-semibold text-muted-fg">/{check.totalSegments}</span>
                    </dd>
                  </div>
                )}
                {localCount > 0 && (
                  <div className="rounded-md bg-bg p-3">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-fg">Sumber internal</dt>
                    <dd className="mt-1 text-lg font-extrabold tabular-nums text-foreground">{localCount}</dd>
                  </div>
                )}
              </dl>

              {check.scanMode === 'sample' && hasScanMeta && (
                <p className="rounded-md bg-warning/10 px-3 py-2 text-xs text-warning">
                  Scan sampel — plagiasi sudah terdeteksi &gt;18%, pemeriksaan lanjutan tidak
                  diperlukan.
                </p>
              )}

              {/* Bar distribusi — div murni, TANPA SVG */}
              <div
                className="space-y-2"
                role="img"
                aria-label={`Distribusi segmen — ${dist.low} rendah, ${dist.mid} sedang, ${dist.high} tinggi`}
              >
                {[
                  { key: 'low', label: 'Rendah', color: 'bg-success', count: dist.low },
                  { key: 'mid', label: 'Sedang', color: 'bg-warning', count: dist.mid },
                  { key: 'high', label: 'Tinggi', color: 'bg-destructive', count: dist.high },
                ].map((b) => {
                  const width = b.count > 0 ? Math.max(2, Math.round((b.count / dist.total) * 100)) : 0;
                  return (
                    <div key={b.key} className="flex items-center gap-2">
                      <span className="w-16 shrink-0 text-xs font-semibold text-muted-fg">{b.label}</span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted/60">
                        <div
                          className={`h-full rounded-full ${b.color}`}
                          style={{ width: `${width}%` }}
                          aria-hidden
                        />
                      </div>
                      <span className="w-7 shrink-0 text-right text-xs font-bold tabular-nums text-foreground">
                        {b.count}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-fg">
                Ambang per segmen: Rendah &lt;30% · Sedang 30–59% · Tinggi ≥60%. Klik frasa yang
                ditandai untuk melihat sumbernya.
              </p>
            </Card>
          </div>

          {/* b. Daftar segmen terindikasi */}
          <Card className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-foreground">Segmen yang terindikasi</h2>
                <p className="text-xs text-muted-fg">
                  Diurutkan dari kemiripan tertinggi. Klik frasa yang ditandai untuk melihat
                  sumbernya — konten sumber tidak ditampilkan penuh.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={segFilter === 'all' ? 'primary' : 'secondary'}
                  size="sm"
                  aria-pressed={segFilter === 'all'}
                  onClick={() => setSegFilter('all')}
                >
                  Semua ({sortedSegments.length})
                </Button>
                <Button
                  variant={segFilter === 'flagged' ? 'primary' : 'secondary'}
                  size="sm"
                  aria-pressed={segFilter === 'flagged'}
                  onClick={() => setSegFilter('flagged')}
                >
                  Hanya terindikasi ({flaggedSegments.length})
                </Button>
              </div>
            </div>

            {visibleSegments.length === 0 ? (
              <EmptyState
                icon={CheckCircle}
                title="Tidak ada kemiripan signifikan"
                description="Dokumenmu terindikasi orisinal terhadap sumber yang diperiksa."
              />
            ) : (
              <ul className="space-y-4">
                {visibleSegments.map((seg, i) => {
                  const segTone = similarityTone(Math.round((seg.score ?? 0) * 100));
                  const sourceCount = seg.matchedSources?.length ?? 0;
                  // Sumber internal per segmen — top 2 + hitungan sisanya (privasi: nama file saja)
                  const localMatches = seg.localMatches || [];
                  const shownLocal = localMatches.slice(0, 2);
                  const localRest = localMatches.length - shownLocal.length;
                  const localBadgeText = `${shownLocal
                    .map((m) => `${m.originalFilename || 'Dokumen tanpa nama'} · ${Math.round((m.score ?? 0) * 100)}%`)
                    .join(' · ')}${localRest > 0 ? ` · +${localRest} lainnya` : ''}`;
                  const localBadgeAria = `Mirip dokumen internal — ${shownLocal
                    .map((m) => `${m.originalFilename || 'Dokumen tanpa nama'} (${Math.round((m.score ?? 0) * 100)}%)`)
                    .join(', ')}${localRest > 0 ? `, dan ${localRest} lainnya` : ''}`;
                  return (
                    <li key={i}>
                      <Card className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="grid h-7 w-7 place-items-center rounded-md bg-primary-50 text-xs font-extrabold text-primary">
                            {i + 1}
                          </span>
                          <h3 className="text-sm font-bold text-foreground">Segmen {i + 1}</h3>
                          <Badge tone={segTone.tone}>
                            {Math.round((seg.score ?? 0) * 100)}% · {segTone.label}
                          </Badge>
                        </div>

                        <SegmentHighlight
                          text={seg.text}
                          textSnippet={seg.textSnippet}
                          phrases={seg.matchedPhrases || []}
                          sources={seg.matchedSources || []}
                          score={seg.score ?? 0}
                        />

                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-muted-fg">{sourceCount} sumber mirip</span>
                            {localMatches.length > 0 && (
                              <span
                                className="inline-flex"
                                aria-label={localBadgeAria}
                                title={localBadgeAria}
                              >
                                <Badge tone="proses" icon={UsersThree}>
                                  {localBadgeText}
                                </Badge>
                              </span>
                            )}
                          </div>
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={Copy}
                            onClick={() => copySegmentText(seg)}
                          >
                            Salin teks
                          </Button>
                        </div>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* c. Sumber dominan */}
          {check.sources?.length > 0 && (
            <Card className="space-y-4">
              <h2 className="text-base font-bold text-foreground">Sumber dominan</h2>
              <ul className="space-y-3">
                {check.sources.slice(0, 5).map((src, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary-50 text-xs font-extrabold text-primary">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="line-clamp-2 font-semibold text-primary hover:underline"
                      >
                        {src.title || src.url}
                      </a>
                      <p className="text-xs text-muted-fg">{hostnameOf(src.url)}</p>
                      {src.snippet && (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-fg">{src.snippet}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Sumber internal (local corpus) — privasi: HANYA nama file + skor, TANPA link */}
          {localCount > 0 && (
            <Card className="space-y-4">
              <div>
                <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
                  <UsersThree size={20} weight="bold" className="text-primary" aria-hidden />
                  Sumber internal
                </h2>
                <p className="text-xs text-muted-fg">
                  Dokumen pengguna lain yang fingerprint-nya cocok — privasi: hanya nama file yang
                  ditampilkan, tanpa tautan ke dokumen tersebut.
                </p>
              </div>
              <ul className="space-y-3">
                {localSources.map((src, i) => (
                  <li
                    key={src.documentId ?? i}
                    className="flex items-center justify-between gap-3 rounded-md bg-bg p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {src.originalFilename || 'Dokumen tanpa nama'}
                      </p>
                      <p className="text-xs text-muted-fg">Dokumen internal</p>
                    </div>
                    <Badge tone={similarityTone(Math.round((src.score ?? 0) * 100)).tone}>
                      {Math.round((src.score ?? 0) * 100)}%
                    </Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <PreviewBanner text="Laporan ini versi PREVIEW. Unduh HQ untuk salinan penuh tanpa watermark." />
        </>
      )}
    </div>
  );
}
