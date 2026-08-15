import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowRight,
  CaretLeft,
  CheckCircle,
  Copy,
  Download,
  FilePdf,
  MagicWand,
  Sparkle,
  TextAa,
  Warning,
  WarningCircle,
} from '@phosphor-icons/react';
import { Dropzone, SelectedFile } from '../../../components/Dropzone';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Select } from '../../../components/ui/Select';
import { Textarea } from '../../../components/ui/Textarea';
import { toolboxApi } from '../../../services/toolbox';
import { useToast } from '../../../contexts/ToastContext';
import { extractErrorMessage } from '../../../utils/errors';
import { formatFileSize } from '../../../utils/format';
import usePageMeta from '../../../hooks/usePageMeta';
import { NotFoundPublic } from './NotFoundPublic';
import { AiCheckTool } from './AiCheckTool';

/**
 * Metadata skor deteksi AI utk badge sebelum → sesudah (nilai indikatif).
 * <15 hijau (Tidak terdeteksi AI), 15–39 amber (Diragukan), ≥40 merah (Terdeteksi AI).
 */
const AI_SCORE_META = (score) => {
  if (score == null) return { tone: 'default', icon: null, label: 'Belum tersedia' };
  if (score < 15) return { tone: 'paid', icon: CheckCircle, label: 'Tidak terdeteksi AI' };
  if (score < 40) return { tone: 'pending', icon: WarningCircle, label: 'Diragukan' };
  return { tone: 'gagal', icon: Warning, label: 'Terdeteksi AI' };
};

/** Label halus utk provider penyedia AI di kartu hasil parafrase (backend §38). */
const PROVIDER_META = {
  ollama: 'Diproses dengan AI lokal (Ollama).',
  gemini: 'Diproses dengan Gemini AI.',
  mixed: 'Diproses dengan kombinasi penyedia AI.',
};

function AiScoreBadge({ label, score }) {
  // Guard: backend bisa mengirim skor null (penilaian AI tidak tersedia) —
  // badge warna hanya dirender saat skor berupa angka (backend §38).
  if (typeof score !== 'number' || !Number.isFinite(score)) return null;
  const meta = AI_SCORE_META(score);
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-xs font-semibold text-muted-fg">
      {label}:
      <Badge tone={meta.tone} icon={meta.icon}>
        {score} · {meta.label}
      </Badge>
    </span>
  );
}

// Batas karakter kontrak backend POST /api/toolbox/paraphrase (body { text }).
const MIN_PARAPHRASE_CHARS = 50;
const MAX_PARAPHRASE_CHARS = 100000;

const TOOL_CONFIGS = {
  compress: {
    icon: FilePdf,
    title: 'Kompres PDF',
    desc: 'Kecilkan ukuran PDF (mode Ekstrem juga mengompres teks jadi gambar). Hasil diunduh otomatis.',
    accept: '.pdf,application/pdf',
    acceptLabel: 'PDF (.pdf)',
    maxSize: 50 * 1024 * 1024, // backend toolbox menerima sampai 50 MB
    params: [
      {
        key: 'mode',
        label: 'Mode kompresi',
        options: [
          { value: 'standard', label: 'Standar — kualitas baik, ukuran turun wajar' },
          { value: 'hard', label: 'Kuat (Hard) — ukuran minimal, kualitas visual bisa turun' },
          {
            value: 'ekstrem',
            label: 'Ekstrem — ukuran minimal (kualitas rendah, untuk kirim lampiran)',
          },
        ],
      },
    ],
    hint: 'Ukuran maks 50 MB. Mode Ekstrem merender ulang teks PDF jadi gambar — teks tidak bisa dicari/disalin.',
  },
  paraphrase: {
    icon: TextAa,
    title: 'Parafrase AI',
    desc: 'Ubah ulang teks yang terindikasi AI menjadi lebih natural dengan AI.',
    ctaLabel: 'Parafrase AI',
    ctaIcon: MagicWand,
  },
};

export default function ToolDetailPage() {
  const { tool } = useParams();
  const config = TOOL_CONFIGS[tool];
  const toast = useToast();
  const isAiCheck = tool === 'ai-check';
  // SEO fase 09 — title/description per alat (dipanggil sebelum early-return
  // config, supaya urutan hook konsisten).
  usePageMeta({
    title: isAiCheck
      ? 'AI Content Detector — Gratis | Toolbox resufy'
      : config
        ? `${config.title} — Gratis | Toolbox resufy`
        : 'Alat tidak ditemukan — resufy',
    description: isAiCheck
      ? 'Deteksi apakah teks ditulis AI (ChatGPT, Gemini, dll) berbasis pola statistik — gratis.'
      : config
        ? `${config.desc} Gratis, tanpa perlu akun.`
        : 'Toolbox yang kamu cari tidak ada. Lihat daftar alat resufy yang tersedia.',
  });

  const [file, setFile] = useState(null);
  const [params, setParams] = useState({});
  const [processing, setProcessing] = useState(false);
  const [resultName, setResultName] = useState('');
  // Teks input parafrase (textarea, bukan upload file).
  const [text, setText] = useState('');
  // Hasil parafrase: JSON { aiScoreBefore, aiScoreAfter, iterations, paraphrasedText }.
  const [aiResult, setAiResult] = useState(null);

  // Route /app/toolbox/:tool TIDAK me-remount komponen saat pindah tool —
  // reset pilihan parameter (label hasil & teks parafrase) supaya tidak bocor
  // antar tool.
  useEffect(() => {
    setParams({});
    setResultName('');
    setAiResult(null);
    setText('');
  }, [tool]);

  // Tool khusus tanpa konfigurasi binary (AI Content Detector — respons JSON,
  // UI sendiri). Sesudah SEMUA hook agar urutan hook konsisten antar tool.
  if (isAiCheck) return <AiCheckTool />;

  if (!config) return <NotFoundPublic />;

  const handleTextChange = (e) => {
    const next = e.target.value;
    setText(next);
    // Hasil parafrase tidak lagi valid begitu teks sumber berubah.
    if (aiResult) setAiResult(null);
  };

  const handleRun = async () => {
    if (tool === 'paraphrase') {
      const len = text.trim().length;
      if (len < MIN_PARAPHRASE_CHARS) {
        toast.error('Teks terlalu pendek — minimal 50 karakter.');
        return;
      }
      if (len > MAX_PARAPHRASE_CHARS) {
        toast.error('Teks terlalu panjang — maksimal 100.000 karakter.');
        return;
      }
      setProcessing(true);
      setAiResult(null);
      try {
        // Respons JSON { aiScoreBefore, aiScoreAfter, iterations, paraphrasedText }.
        const result = await toolboxApi.paraphrase(text.trim());
        setAiResult(result);
        toast.success('Parafrase selesai — salin atau unduh hasilnya.');
      } catch (err) {
        // 422/503/502 datang sebagai JSON biasa → extractErrorMessage (bukan blob).
        toast.error(extractErrorMessage(err, 'Gagal parafrase — coba lagi.'));
      } finally {
        setProcessing(false);
      }
      return;
    }

    if (!file) {
      toast.error('Pilih file dulu.');
      return;
    }
    setProcessing(true);
    setResultName('');
    setAiResult(null);
    try {
      // toolboxApi.run mengembalikan axios response { data: Blob, headers }
      const response = await toolboxApi.run(tool, file, params);
      const filename = toolboxApi.download(response, `hasil-${tool}-${file.name}`);
      setResultName(filename);
      toast.success('File selesai diproses — unduhan dimulai.');
    } catch (err) {
      toast.error(
        extractErrorMessage(err, `Gagal memproses — cek kembali format file (${config.acceptLabel}).`)
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleCopy = async () => {
    const content = aiResult?.paraphrasedText;
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      toast.success('Teks hasil parafrase tersalin.');
    } catch {
      // Fallback utk konteks tanpa izin clipboard (execCommand deprecated tapi tetap jalan).
      try {
        const el = document.createElement('textarea');
        el.value = content;
        el.setAttribute('readonly', '');
        el.style.position = 'fixed';
        el.style.opacity = '0';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        toast.success('Teks hasil parafrase tersalin.');
      } catch {
        toast.error('Gagal menyalin — pilih teks dan salin manual.');
      }
    }
  };

  const handleDownloadTxt = () => {
    const content = aiResult?.paraphrasedText;
    if (!content) return;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    toolboxApi.downloadBlobNamed(blob, 'hasil-parafrase.txt');
    toast.success('Unduhan .txt dimulai.');
  };

  // Validasi & status counter parafrase (kontrak: 50–100.000 karakter).
  const paraphraseLen = tool === 'paraphrase' ? text.trim().length : 0;
  const paraphraseUnder = paraphraseLen < MIN_PARAPHRASE_CHARS && text.trim() !== '';
  const paraphraseOver = paraphraseLen > MAX_PARAPHRASE_CHARS;
  const canSubmit =
    tool === 'paraphrase'
      ? paraphraseLen >= MIN_PARAPHRASE_CHARS && paraphraseLen <= MAX_PARAPHRASE_CHARS
      : Boolean(file);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
        <div className="flex items-center gap-3">
          <Link
            to="/app/toolbox"
            aria-label="Kembali ke toolbox"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-muted-fg hover:bg-muted"
          >
            <CaretLeft size={20} aria-hidden />
          </Link>
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-cta-gradient text-white shadow-glow-primary">
            <config.icon size={24} weight="bold" aria-hidden />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-foreground">{config.title}</h1>
              <Badge tone="gratis">Gratis</Badge>
            </div>
            <p className="text-sm text-muted-fg">{config.desc}</p>
          </div>
        </div>

        <Card className="space-y-4">
          {tool === 'paraphrase' ? (
            <div className="space-y-2">
              <Textarea
                label="Teks yang ingin diparafrase"
                rows={8}
                className="min-h-[200px]"
                placeholder="Tempel atau ketik teks yang ingin diparafrase..."
                value={text}
                onChange={handleTextChange}
                disabled={processing}
              />
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <p
                  aria-live="polite"
                  className={`text-xs ${
                    paraphraseOver
                      ? 'font-medium text-destructive'
                      : paraphraseUnder
                        ? 'font-medium text-warning'
                        : 'text-muted-fg'
                  }`}
                >
                  {paraphraseOver
                    ? 'Maksimal 100.000 karakter.'
                    : paraphraseUnder
                      ? 'Minimal 50 karakter.'
                      : 'Min. 50 karakter, maks. 100.000 karakter.'}
                </p>
                <p aria-live="polite" className="text-xs font-medium tabular-nums text-foreground">
                  {paraphraseLen.toLocaleString('id-ID')} / 100.000
                </p>
              </div>
            </div>
          ) : (
            <>
              {!file ? (
                <Dropzone
                  accept={config.accept}
                  acceptLabel={config.acceptLabel}
                  maxSize={config.maxSize}
                  hint={config.hint}
                  onFile={setFile}
                />
              ) : (
                // "Ganti" = kosongkan pilihan → Dropzone tampil lagi utk memilih file baru
                <SelectedFile file={file} onClear={() => setFile(null)} onReplace={() => setFile(null)} />
              )}

              {config.params.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {config.params.map((p) => (
                    <Select
                      key={p.key}
                      label={p.label}
                      value={params[p.key] || p.options[0].value}
                      onChange={(e) => setParams({ ...params, [p.key]: e.target.value })}
                      options={p.options}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          <Button
            variant="primary"
            size="lg"
            icon={config.ctaIcon || Sparkle}
            className="w-full"
            onClick={handleRun}
            loading={processing}
            disabled={!canSubmit}
          >
            {processing
              ? tool === 'paraphrase'
                ? 'Memparafrase…'
                : 'Memproses…'
              : config.ctaLabel || `Proses ${config.title}`}
          </Button>

          {resultName && !aiResult && (
            <p className="flex items-center gap-2 rounded-md bg-success/10 px-3 py-2 text-sm text-success">
              <Download size={16} aria-hidden />
              Berhasil — <span className="font-bold">{resultName}</span> tersimpan di folder
              unduhan.
            </p>
          )}

          {/* Hasil parafrase: skor AI sebelum → sesudah + teks hasil + Salin/Unduh .txt */}
          {aiResult && (
            <div aria-live="polite" className="space-y-3 rounded-lg border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-foreground">Hasil Parafrase</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={Copy}
                    onClick={handleCopy}
                    disabled={!aiResult.paraphrasedText}
                  >
                    Salin
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={Download}
                    onClick={handleDownloadTxt}
                    disabled={!aiResult.paraphrasedText}
                  >
                    Unduh .txt
                  </Button>
                </div>
              </div>
              {typeof aiResult.aiScoreBefore === 'number' &&
              typeof aiResult.aiScoreAfter === 'number' ? (
                <div className="flex flex-wrap items-center gap-2">
                  <AiScoreBadge label="Skor sebelum" score={aiResult.aiScoreBefore} />
                  <ArrowRight size={18} className="shrink-0 text-muted-fg" aria-hidden />
                  <AiScoreBadge label="Skor sesudah" score={aiResult.aiScoreAfter} />
                </div>
              ) : (
                <p className="text-xs font-semibold text-muted-fg">
                  Skor: <span className="font-bold">—</span> (penilaian AI tidak tersedia)
                </p>
              )}
              {aiResult.iterations > 1 && (
                <p className="text-xs font-medium text-muted-fg">
                  Diparafrase ulang ×{aiResult.iterations} untuk menurunkan skor AI.
                </p>
              )}
              {aiResult.provider && PROVIDER_META[aiResult.provider] && (
                <p className="text-xs text-muted-fg">{PROVIDER_META[aiResult.provider]}</p>
              )}
              <div className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm leading-relaxed text-foreground">
                {aiResult.paraphrasedText || ''}
              </div>
              <p className="text-xs text-muted-fg">
                Skor deteksi AI bersifat indikatif — tidak ada detektor yang menjamin 0% di semua
                alat.
              </p>
            </div>
          )}

          <p className="text-xs text-muted-fg">
            {tool === 'paraphrase'
              ? 'Privasi: teks dikirim ke server untuk diproses dan tidak disimpan.'
              : `Privasi: file dihapus otomatis setelah diproses. Ukuran maks ${formatFileSize(config.maxSize)}.`}
          </p>
        </Card>
      </div>
  );
}
