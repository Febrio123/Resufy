import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  CheckCircle,
  Download,
  FilePdf,
  FileText,
  FloppyDisk,
  Quotes,
  ShieldCheck,
  Sparkle,
  Star,
  UserSquare,
  CloudCheck,
} from '@phosphor-icons/react';
import { PublicLayout } from '../components/layouts/PublicLayout';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useCountUp } from '../hooks/useCountUp';
import usePageMeta from '../hooks/usePageMeta';

function StatNumber({ value, prefix = '', suffix = '', label }) {
  const n = useCountUp(value, { duration: 1.4 });
  const display = `${prefix}${Number(n.toFixed(0)).toLocaleString('id-ID')}${suffix}`;
  return (
    <div className="text-center">
      <p className="text-gradient text-3xl font-extrabold tabular-nums md:text-4xl">{display}</p>
      <p className="mt-1 text-sm font-medium text-muted-fg">{label}</p>
    </div>
  );
}

function HeroMockup() {
  const reduced = useReducedMotion();
  const float = reduced
    ? {}
    : {
        animate: { y: [0, -9, 0] },
        transition: { duration: 5.5, repeat: Infinity, ease: 'easeInOut' },
      };

  return (
    <div className="relative mx-auto mt-12 w-full max-w-lg md:mt-16" aria-hidden>
      <div className="blob -top-10 left-1/2 h-72 w-72 -translate-x-1/2 bg-primary/25" />
      <div className="blob bottom-0 right-0 h-56 w-56 bg-indigo-500/20" />

      {/* Card utama — mockup CV dengan foto kiri atas */}
      <div className="relative rounded-2xl bg-white p-5 shadow-xl ring-1 ring-black/5 md:p-6">
        <div className="mb-4 flex items-center justify-between border-b border-border/70 pb-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
          </div>
          <span className="rounded-md bg-primary-50 px-2 py-0.5 text-[10px] font-bold text-primary">
            Template ATS · Foto Kiri Atas
          </span>
        </div>

        {/* Header CV: Foto di sisi kiri pojok atas 3x4 + Teks di kanan */}
        <div className="flex items-start gap-4 border-b border-gray-300 pb-3">
          <div className="w-16 h-20 rounded border border-gray-300 bg-gray-100 flex items-center justify-center text-[9px] font-bold text-gray-400 shrink-0 shadow-xs">
            FOTO 3×4
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-base font-extrabold text-foreground">Budi Santoso, S.Kom</p>
            <p className="text-xs font-semibold text-primary">Software Engineer</p>
            <p className="text-[10px] text-muted-fg mt-1">budi@example.com · +62 812-3456-7890 · Jakarta</p>
          </div>
        </div>

        {/* Body Section ATS */}
        <div className="mt-4 space-y-2.5 text-left">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-fg border-b border-gray-200 pb-0.5">
            PENGALAMAN KERJA
          </p>
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-bold text-gray-800">
              <span>Frontend Developer — PT Inovasi Digital</span>
              <span className="text-[10px] font-normal text-muted-fg">2022 — Sekarang</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted" />
            <div className="h-1.5 w-4/5 rounded-full bg-muted" />
          </div>

          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-fg border-b border-gray-200 pb-0.5 pt-1">
            KEAHLIAN UTAMA
          </p>
          <p className="text-[10px] text-gray-700">
            JavaScript • TypeScript • React.js • Node.js • Tailwind CSS • REST API
          </p>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-3">
          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
            <CheckCircle size={14} weight="bold" /> Standar ATS 100% Lulus
          </span>
          <span className="flex items-center gap-1 text-[10px] font-semibold text-muted-fg">
            <FilePdf size={13} className="text-destructive" /> PDF Berkualitas Tinggi
          </span>
        </div>
      </div>

      {/* Floating card — ATS Score */}
      <motion.div
        {...float}
        className="absolute -left-4 -top-8 flex items-center gap-3 rounded-2xl bg-white p-3 pr-4 shadow-lg ring-1 ring-black/5 sm:-left-10"
      >
        <div className="relative grid h-14 w-14 place-items-center">
          <div
            className="absolute inset-0 rounded-full"
            style={{ background: 'conic-gradient(var(--color-primary) 0% 98%, #E9EFF8 98% 100%)' }}
            aria-hidden
          />
          <div className="absolute inset-[6px] rounded-full bg-white" aria-hidden />
          <span className="relative text-sm font-extrabold text-primary">98%</span>
        </div>
        <div>
          <p className="text-xs font-extrabold text-foreground">ATS Score</p>
          <p className="text-[10px] font-semibold text-success">Lolos Verifikasi Mesin</p>
        </div>
      </motion.div>

      {/* Floating card — Cloudinary */}
      <motion.div
        {...float}
        transition={reduced ? undefined : { duration: 6.5, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
        className="absolute -bottom-6 -right-3 flex items-center gap-2.5 rounded-2xl bg-white p-3 pr-4 shadow-lg ring-1 ring-black/5 sm:-right-8"
      >
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/15 text-primary">
          <CloudCheck size={20} weight="bold" />
        </span>
        <div>
          <p className="text-xs font-extrabold text-foreground">Foto Cloudinary CDN</p>
          <p className="text-[10px] font-semibold text-primary">Penyimpanan Aman & Cepat</p>
        </div>
      </motion.div>
    </div>
  );
}

function BentoCard({ className = '', icon: Icon, title, desc, children }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      whileHover={reduced ? undefined : { scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      className={`group relative overflow-hidden rounded-2xl border border-border bg-surface p-6 shadow-sm transition-shadow duration-200 hover:shadow-lg md:p-8 ${className}`}
    >
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-cta-gradient text-white shadow-glow-primary transition-transform duration-200 group-hover:scale-110">
        <Icon size={24} weight="bold" aria-hidden />
      </span>
      <h3 className="mt-4 text-lg font-extrabold text-foreground">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-fg">{desc}</p>
      {children}
    </motion.div>
  );
}

export default function Landing() {
  const reduced = useReducedMotion();

  usePageMeta({
    title: 'HireUp — Pembuat CV Standar ATS Profesional',
    description:
      'Buat CV yang lulus standar ATS dengan HireUp. Tersedia 2 template: dengan foto formal di sisi kiri pojok atas atau template klasik tanpa foto. Dilengkapi skor ATS realtime & unduh PDF gratis.',
  });

  const fade = (delay = 0) => ({
    initial: reduced ? { opacity: 0 } : { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, delay },
  });

  const stagger = (base = 0) => ({
    initial: reduced ? { opacity: 0 } : { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-60px' },
    transition: { duration: 0.45, delay: base },
  });

  return (
    <PublicLayout>
      {/* ============================ HERO ============================ */}
      <section className="relative overflow-hidden pb-24 pt-10 md:pt-16">
        <div className="absolute inset-0 bg-gradient-to-b from-primary-50/80 via-white to-white" aria-hidden />
        <div className="bg-grid-light absolute inset-0 opacity-60" aria-hidden />
        <div className="blob -left-24 top-8 h-80 w-80 bg-primary/15" aria-hidden />
        <div className="blob -right-20 top-40 h-72 w-72 bg-indigo-400/20" aria-hidden />

        <div className="relative flex flex-col items-center text-center">
          <motion.div {...fade(0)}>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-white/80 px-4 py-1.5 text-xs font-bold text-primary shadow-sm backdrop-blur">
              <Sparkle size={14} weight="fill" className="text-accent" aria-hidden />
              2 Template ATS Standar · Dengan Foto & Tanpa Foto · PDF Siap Cetak
            </span>
          </motion.div>

          <motion.h1
            {...fade(0.05)}
            className="max-w-3xl text-balance text-4xl font-extrabold leading-[1.1] tracking-tight text-foreground md:text-6xl"
          >
            Buat CV Standar ATS yang <span className="text-gradient">Lolos Seleksi Kerja</span>.
          </motion.h1>

          <motion.p {...fade(0.1)} className="mt-5 max-w-xl text-balance text-base text-muted-fg md:text-lg">
            Fokus pada layouting dan kerapihan tanpa desain berlebihan. Dibuat sesuai kaidah sistem pelacak pelamar (ATS) agar data kamu terbaca sempurna oleh rekruter.
          </motion.p>

          <motion.div {...fade(0.15)} className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
            <Link to="/register">
              <Button variant="accent" size="lg" icon={ArrowRight}>
                Mulai Buat CV Gratis
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="secondary" size="lg">
                Masuk ke Akun
              </Button>
            </Link>
          </motion.div>

          <motion.div {...fade(0.2)} className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-medium text-muted-fg">
            <span className="flex items-center gap-1.5">
              <FloppyDisk size={14} className="text-primary" aria-hidden /> Tersimpan otomatis
            </span>
            <span className="flex items-center gap-1.5">
              <CloudCheck size={14} className="text-primary" aria-hidden /> Cloudinary Cloud CDN
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle size={14} className="text-primary" aria-hidden /> Lulus ATS Parser
            </span>
          </motion.div>
        </div>

        <motion.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
        >
          <HeroMockup />
        </motion.div>
      </section>

      {/* ============================ STATS ============================ */}
      <section className="cv-auto relative -mt-8 pb-10" aria-label="Statistik HireUp">
        <motion.div {...stagger(0)} className="mx-auto grid max-w-4xl grid-cols-2 gap-6 rounded-2xl border border-border bg-surface px-6 py-8 shadow-lg ring-1 ring-black/5 md:grid-cols-4 md:gap-4">
          <StatNumber value={100} suffix="%" label="Standar Format ATS" />
          <StatNumber value={2} label="Pilihan Template ATS" />
          <StatNumber value={0} prefix="Rp" label="Gratis Buat & Unduh" />
          <StatNumber value={10000} suffix="+" label="CV Telah Digenerate" />
        </motion.div>
      </section>

      {/* ============================ FITUR UTAMA ============================ */}
      <section className="cv-auto py-14" aria-labelledby="fitur-title">
        <motion.div {...stagger(0)} className="mb-10 text-center">
          <Badge tone="info" icon={Sparkle}>
            TEMPLATE & LAYOUT
          </Badge>
          <h2 id="fitur-title" className="mt-3 text-balance text-3xl font-extrabold text-foreground md:text-4xl">
            2 Template Khusus Lolos Standar ATS
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-fg md:text-base">
            Tanpa ornamen berlebihan yang mengacaukan scanner mesin pencari kerja. Cukup layouting presisi, kerapihan, dan tipografi standar.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          {/* Card 1 — Dengan Foto (Kiri Atas) */}
          <motion.div {...stagger(0.05)} className="md:col-span-6">
            <BentoCard
              icon={UserSquare}
              title="Template 1: CV Dengan Foto (Pojok Kiri Atas)"
              desc="Posisi foto formal 3×4 diletakkan di sisi kiri pojok atas dengan nama dan informasi kontak di sebelah kanannya. Dilanjutkan layout 1 kolom rapi."
              className="h-full"
            >
              <div className="mt-5 space-y-2">
                <div className="rounded-xl bg-primary-50/70 p-3.5">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-primary">
                    <CheckCircle size={14} weight="bold" /> Foto Proporsional 3×4
                  </p>
                  <p className="mt-1 text-xs text-muted-fg">
                    Crop & resize otomatis dan tersimpan aman di Cloudinary CDN.
                  </p>
                </div>
                <div className="rounded-xl bg-primary-50/70 p-3.5">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-primary">
                    <CheckCircle size={14} weight="bold" /> Tata Letak Rapi & Sejajar
                  </p>
                  <p className="mt-1 text-xs text-muted-fg">
                    Nama dan kontak terstruktur rapi di samping foto tanpa memotong alur bacaan ATS.
                  </p>
                </div>
              </div>
            </BentoCard>
          </motion.div>

          {/* Card 2 — Tanpa Foto */}
          <motion.div {...stagger(0.1)} className="md:col-span-6">
            <BentoCard
              icon={FileText}
              title="Template 2: CV Tanpa Foto (Standar Klasik)"
              desc="Layout 1 kolom penuh tanpa foto, pilihan standar internasional yang paling aman dan disukai oleh semua sistem ATS perusahaan multinasional."
              className="h-full"
            >
              <div className="mt-5 space-y-2">
                <div className="rounded-xl bg-indigo-50/70 p-3.5">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-indigo-700">
                    <CheckCircle size={14} weight="bold" /> 1 Kolom Penuh (Single Column)
                  </p>
                  <p className="mt-1 text-xs text-muted-fg">
                    Menghilangkan risiko salah urutan pembacaan teks pada sistem parser ATS.
                  </p>
                </div>
                <div className="rounded-xl bg-indigo-50/70 p-3.5">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-indigo-700">
                    <CheckCircle size={14} weight="bold" /> Tipografi Helvetica ATS-Friendly
                  </p>
                  <p className="mt-1 text-xs text-muted-fg">
                    Kombinasi font universal standar industri tanpa elemen dekoratif berlebih.
                  </p>
                </div>
              </div>
            </BentoCard>
          </motion.div>

          {/* Card 3 — ATS Score */}
          <motion.div {...stagger(0.15)} className="md:col-span-6">
            <BentoCard
              icon={ShieldCheck}
              title="Pemeriksaan Skor ATS Instan"
              desc="Ketahui skor kelayakan CV kamu sebelum dikirim ke HRD. Dapatkan feedback langsung untuk bagian yang perlu disempurnakan."
              className="h-full"
            />
          </motion.div>

          {/* Card 4 — Cloudinary Storage */}
          <motion.div {...stagger(0.2)} className="md:col-span-6">
            <BentoCard
              icon={CloudCheck}
              title="Penyimpanan Cloudinary Terintegrasi"
              desc="Foto profil diunggah langsung ke Cloudinary menggunakan cloud storage resmi, aman, dan berkecepatan tinggi."
              className="h-full"
            />
          </motion.div>
        </div>
      </section>

      {/* ============================ 3 LANGKAH ============================ */}
      <section className="cv-auto py-14" aria-labelledby="cara-title">
        <motion.div {...stagger(0)} className="mb-10 text-center">
          <Badge tone="info" icon={Sparkle}>
            CARA KERJA
          </Badge>
          <h2 id="cara-title" className="mt-3 text-3xl font-extrabold text-foreground md:text-4xl">
            Langkah Mudah Membuat CV ATS
          </h2>
        </motion.div>

        <ol className="relative grid gap-5 md:grid-cols-3">
          <motion.li {...stagger(0.05)} className="relative">
            <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm hover:shadow-md transition-shadow">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-cta-gradient font-extrabold text-white shadow-glow-primary">
                01
              </span>
              <h3 className="mt-4 text-lg font-bold text-foreground">Pilih Template</h3>
              <p className="mt-1.5 text-sm text-muted-fg">Pilih template dengan foto (sisi kiri pojok atas) atau template tanpa foto.</p>
            </div>
          </motion.li>
          <motion.li {...stagger(0.1)} className="relative">
            <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm hover:shadow-md transition-shadow">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-cta-gradient font-extrabold text-white shadow-glow-primary">
                02
              </span>
              <h3 className="mt-4 text-lg font-bold text-foreground">Lengkapi Data & Cek ATS</h3>
              <p className="mt-1.5 text-sm text-muted-fg">Isi pengalaman, pendidikan, dan keahlian, lalu cek skor kelulusan ATS kamu.</p>
            </div>
          </motion.li>
          <motion.li {...stagger(0.15)} className="relative">
            <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm hover:shadow-md transition-shadow">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-cta-gradient font-extrabold text-white shadow-glow-primary">
                03
              </span>
              <h3 className="mt-4 text-lg font-bold text-foreground">Unduh PDF Siap Kirim</h3>
              <p className="mt-1.5 text-sm text-muted-fg">Dapatkan dokumen PDF berkualitas tinggi tanpa watermark, langsung siap dilamar.</p>
            </div>
          </motion.li>
        </ol>
      </section>

      {/* ============================ CTA ============================ */}
      <section className="cv-auto py-16 text-center">
        <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary-50 via-surface to-indigo-50 p-8 sm:p-14 shadow-md">
          <h2 className="text-3xl font-extrabold text-foreground sm:text-4xl">
            Siap Melamar Pekerjaan Impianmu?
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-muted-fg sm:text-base">
            Buat CV ATS profesional sekarang juga. Pilih template yang kamu suka dan unduh hasilnya secara instan.
          </p>
          <div className="mt-8 flex justify-center">
            <Link to="/register">
              <Button variant="accent" size="lg" icon={ArrowRight}>
                Buat CV Sekarang — Gratis
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
