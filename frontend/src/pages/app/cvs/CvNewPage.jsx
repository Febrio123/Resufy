import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Article,
  CaretLeft,
  CheckCircle,
  ClipboardText,
  Eye,
  FileText,
} from '@phosphor-icons/react';
import { cvsApi } from '../../../services/cvs';
import { useToast } from '../../../contexts/ToastContext';
import { CvForm } from '../../../components/cv/CvForm';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Textarea } from '../../../components/ui/Textarea';
import { Tabs } from '../../../components/Tabs';
import { extractErrorMessageAsync } from '../../../utils/errors';
import { hasCvContent, sanitizeContent } from '../../../utils/cvJson';

export default function CvNewPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState({});
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const [mode, setMode] = useState('form');
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState('');

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Beri judul CV dulu, ya.');
      return;
    }
    setSaving(true);
    try {
      const { data } = await cvsApi.create({ title: title.trim(), content });
      toast.success('CV tersimpan. Lanjut lengkapi & cek ATS.');
      navigate(`/app/cvs/${data.cv._id}/edit`, { replace: true });
    } catch (err) {
      toast.error(extractErrorMessage(err));
      setSaving(false);
    }
  };

  // Impor JSON: parse + sanitasi whitelist skema → isi state, lalu balik ke Form.
  const applyJson = () => {
    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      setJsonError('JSON tidak valid — periksa tanda kurung dan koma.');
      return;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      setJsonError('JSON harus berupa objek dengan "title" dan "content".');
      return;
    }
    const rawContent = parsed.content;
    if (!rawContent || typeof rawContent !== 'object' || Array.isArray(rawContent)) {
      setJsonError('Isi "content" harus berupa objek berisi data CV.');
      return;
    }

    const cleaned = sanitizeContent(rawContent);
    const rawTitle = typeof parsed.title === 'string' ? parsed.title.trim() : '';
    if (rawTitle) {
      setTitle(rawTitle);
    } else {
      setTitle('');
      toast.info('Judul tidak ditemukan di JSON — beri judul lalu simpan.');
    }
    setContent(cleaned);
    setJsonText('');
    setJsonError('');
    setMode('form');
    toast.success('Data JSON berhasil dimuat — tinjau lalu simpan.');
  };

  // Preview PDF (ber-watermark) SEBELUM simpan — POST stateless { content } →
  // blob → tab baru. Content dari state form (bentuk sama persis dgn yang
  // dikirim handleSave → TANPA konversi tambahan).
  const handlePreview = async () => {
    if (!hasCvContent(content)) {
      toast.error('Isi data CV dulu sebelum preview.');
      return;
    }
    setPreviewing(true);
    try {
      const response = await cvsApi.previewPdf(content);
      const url = URL.createObjectURL(response.data);
      window.open(url, '_blank', 'noopener');
      // Tab baru memuat secara asinkron — lepaskan blob setelah cukup waktu.
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      toast.success('Preview dibuka di tab baru.');
    } catch (err) {
      // Error 422/500 dari endpoint blob datang sebagai Blob JSON → parse async.
      toast.error(await extractErrorMessageAsync(err, 'Gagal membuat preview — coba lagi.'));
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/app')}
            aria-label="Kembali ke dashboard"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-muted-fg hover:bg-muted"
          >
            <CaretLeft size={20} aria-hidden />
          </button>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary-100 text-primary">
            <FileText size={22} weight="bold" aria-hidden />
          </span>
          <div>
            <h1 className="text-xl font-extrabold text-foreground">Buat CV Baru</h1>
            <p className="text-sm text-muted-fg">Lengkapi data — tersimpan otomatis sebagai draft.</p>
          </div>
        </div>
        {mode === 'form' && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              icon={Eye}
              onClick={handlePreview}
              loading={previewing}
              disabled={saving}
              title="Pratinjau PDF ber-watermark tanpa menyimpan"
            >
              Preview
            </Button>
            <Button
              variant="accent"
              onClick={handleSave}
              loading={saving}
              disabled={previewing}
              className="sm:w-auto"
            >
              Simpan & Lanjut
            </Button>
          </div>
        )}
      </div>

      <Tabs
        tabs={[
          { value: 'form', label: 'Form', icon: Article },
          { value: 'import', label: 'Impor JSON', icon: ClipboardText },
        ]}
        active={mode}
        onChange={setMode}
      />

      {mode === 'form' ? (
        <>
          <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
            <Input
              label="Judul CV"
              placeholder="Contoh: CV Rina — Fullstack Developer"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              hint="Judul hanya untukmu — tidak muncul di PDF."
            />
          </div>

          <CvForm content={content} onChange={setContent} />
        </>
      ) : (
        <div className="space-y-3 rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div>
            <h2 className="text-base font-bold text-foreground">Tempel JSON CV</h2>
            <p className="text-sm text-muted-fg">
              Salin dari CV lama: buka halaman Detail CV → tombol <span className="font-semibold">Salin JSON</span>, lalu
              tempel di sini.
            </p>
          </div>
          <Textarea
            label="Isi JSON"
            rows={12}
            placeholder='{"title": "CV Rina — Frontend Developer", "content": {"personalInfo": {"fullName": "Rina"}, "profileSummary": "...", "skills": ["React"]}}'
            value={jsonText}
            onChange={(e) => {
              setJsonText(e.target.value);
              if (jsonError) setJsonError('');
            }}
            error={jsonError || undefined}
            hint="Data diimpor ke form untuk ditinjau — data tidak pernah langsung disimpan sebelum kamu menekan Simpan."
          />
          <Button variant="primary" icon={CheckCircle} onClick={applyJson} className="w-full sm:w-auto">
            Terapkan
          </Button>
        </div>
      )}
    </div>
  );
}
