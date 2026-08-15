import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Brain, CaretLeft, ChatText, CheckCircle, Sparkle, TextT, WarningCircle } from '@phosphor-icons/react';
import { Dropzone, SelectedFile } from '../../../components/Dropzone';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Textarea } from '../../../components/ui/Textarea';
import { toolboxApi } from '../../../services/toolbox';
import { extractErrorMessage } from '../../../utils/errors';

const MIN_WORDS = 100;

const countWords = (value) => String(value || '').trim().split(/\s+/).filter(Boolean).length;

/** Warna bar skor + teks pendamping (gaya GPTZero: rendah=manusia, tinggi=AI). */
const scoreStyle = (score) => {
  if (score < 50) return { bar: 'bg-success', text: 'text-success', ring: 'bg-success/10' };
  if (score < 75) return { bar: 'bg-amber-500', text: 'text-amber-600', ring: 'bg-amber-100' };
  return { bar: 'bg-destructive', text: 'text-destructive', ring: 'bg-destructive/10' };
};

const BREAKDOWN_META = [
  { key: 'burstiness', label: 'Keragaman kalimat', hint: 'AI cenderung rata; manusia lebih bervariasi' },
  { key: 'vocabulary', label: 'Kosakata', hint: 'Variasi pilihan kata' },
  { key: 'aiPhrases', label: 'Frasa khas AI', hint: 'Pola frasa yang sering dipakai model AI' },
  { key: 'repetition', label: 'Pengulangan', hint: 'Ulang-ulang struktur atau istilah' },
];

/**
 * AI Content Detector — cek apakah teks ditulis AI (gaya GPTZero).
 * Respons JSON dari /api/toolbox/ai-check (BUKAN blob). Zero SVG manual.
 */
export function AiCheckTool() {
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const words = countWords(text);
  const tooShort = words > 0 && words < MIN_WORDS;
  const canSubmit = Boolean(text.trim() || file) && !processing;

  const handleCheck = async () => {
    if (!text.trim() && !file) {
      setError('Tempel teks atau pilih file dulu — salah satu wajib.');
      return;
    }
    setError('');
    setResult(null);
    setProcessing(true);
    try {
      const data = await toolboxApi.aiCheck({ text: text.trim(), file });
      setResult(data);
    } catch (err) {
      // 422 TEXT_TOO_SHORT / INVALID_TEXT → pesan server tampil apa adanya.
      setError(extractErrorMessage(err, 'Gagal memeriksa teks — coba lagi.'));
    } finally {
      setProcessing(false);
    }
  };

  const s = result ? scoreStyle(result.score) : null;

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
          <Brain size={24} weight="bold" aria-hidden />
        </span>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-foreground">AI Content Detector</h1>
            <Badge tone="gratis">Gratis</Badge>
          </div>
          <p className="text-sm text-muted-fg">
            Deteksi apakah teks ditulis oleh AI (ChatGPT, Gemini, dll) berbasis pola statistik —
            gratis, tanpa perlu akun.
          </p>
        </div>
      </div>

      <Card className="space-y-4">
        <Textarea
          label="Tempel teks"
          rows={8}
          placeholder="Tempel teks yang ingin diperiksa di sini…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={processing}
        />
        <p
          className={`-mt-2 text-xs ${tooShort ? 'font-semibold text-amber-600' : 'text-muted-fg'}`}
          aria-live="polite"
        >
          {words} kata
          {tooShort
            ? ` — masih di bawah ${MIN_WORDS} kata. Hasil makin akurat dengan teks yang lebih panjang.`
            : ` (minimal ${MIN_WORDS} kata untuk hasil akurat)`}
        </p>

        <div>
          {!file ? (
            <Dropzone
              accept=".pdf,.docx,.doc,.txt"
              acceptLabel="PDF, DOCX, DOC, TXT (opsional)"
              hint="Atau tempel teks di atas; salah satu wajib."
              onFile={setFile}
              disabled={processing}
            />
          ) : (
            <SelectedFile file={file} onClear={() => setFile(null)} onReplace={() => setFile(null)} />
          )}
        </div>

        <Button
          variant="primary"
          size="lg"
          icon={Sparkle}
          className="w-full"
          onClick={handleCheck}
          loading={processing}
          disabled={!canSubmit}
        >
          {processing ? 'Memeriksa…' : 'Cek Teks'}
        </Button>

        {error && (
          <p role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
            <WarningCircle size={16} className="mt-0.5 shrink-0" aria-hidden />
            <span>{error}</span>
          </p>
        )}

        <p className="text-xs text-muted-fg">
          Privasi: file dihapus otomatis setelah diproses.
        </p>
      </Card>

      {result && (
        <div aria-live="polite" className="space-y-4">
          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Skor kemungkinan ditulis AI</p>
                <p className={`text-3xl font-extrabold ${s.text}`}>{Math.round(result.score)}%</p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${s.ring} ${s.text}`}
              >
                {result.label}
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={Math.round(result.score)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Skor kemungkinan ditulis AI"
              className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
            >
              <div
                className={`h-full rounded-full transition-all duration-500 ${s.bar}`}
                style={{ width: `${Math.min(100, Math.max(0, result.score))}%` }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {result.engine === 'gemini' ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-1 font-semibold text-indigo-700">
                  <Sparkle size={14} aria-hidden /> Didukung Gemini AI
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 font-medium text-muted-fg shadow-sm ring-1 ring-inset ring-border">
                  Deteksi lokal (tanpa API)
                </span>
              )}
              {result.note && <span className="italic text-muted-fg">{result.note}</span>}
            </div>
          </Card>

          {result.engine === 'gemini' && result.reasoning && (
            <Card className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ChatText size={18} aria-hidden /> Alasan model
              </p>
              <p className="text-sm leading-relaxed text-foreground/80">{result.reasoning}</p>
            </Card>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {BREAKDOWN_META.map(({ key, label, hint }) => {
              const value = Math.round(result.breakdown?.[key] ?? 0);
              const vStyle = scoreStyle(value);
              return (
                <Card key={key} padded={false} className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{label}</p>
                      <p className="truncate text-xs text-muted-fg" title={hint}>
                        {hint}
                      </p>
                    </div>
                    <span className={`text-lg font-extrabold ${vStyle.text}`}>{value}%</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className={`h-full rounded-full ${vStyle.bar}`} style={{ width: `${value}%` }} />
                  </div>
                </Card>
              );
            })}
          </div>

          {result.textStats && (
            <Card className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <TextT size={18} aria-hidden /> Statistik teks
              </p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-xl font-extrabold text-foreground">{result.textStats.words}</p>
                  <p className="text-xs text-muted-fg">kata</p>
                </div>
                <div>
                  <p className="text-xl font-extrabold text-foreground">{result.textStats.sentences}</p>
                  <p className="text-xs text-muted-fg">kalimat</p>
                </div>
                <div>
                  <p className="text-xl font-extrabold text-foreground">
                    {Number(result.textStats.avgWordsPerSentence).toFixed(1)}
                  </p>
                  <p className="text-xs text-muted-fg">kata / kalimat</p>
                </div>
              </div>
              <p className="flex items-center gap-1.5 text-xs text-success">
                <CheckCircle size={14} aria-hidden />
                Pemeriksaan selesai — hasil ditampilkan di atas.
              </p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

export default AiCheckTool;
