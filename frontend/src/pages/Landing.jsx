import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  Bank,
  Brain,
  CheckCircle,
  Copy,
  FilePdf,
  FileText,
  FloppyDisk,
  LockKey,
  Quotes,
  ShieldCheck,
  Sparkle,
  Star,
  TextAa,
  Wrench,
} from '@phosphor-icons/react';
import { PublicLayout } from '../components/layouts/PublicLayout';
import { Button } from '../components/ui/Button';
import { PriceTag } from '../components/ui/PriceTag';
import { Badge } from '../components/ui/Badge';
import { useCountUp } from '../hooks/useCountUp';
import usePageMeta from '../hooks/usePageMeta';
import { COPY } from '../utils/constants';

/* ---------------------------------------------------------------------------
   StatNumber — angka count-up untuk stats bar (hormati reduced-motion)
--------------------------------------------------------------------------- */
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

/* ---------------------------------------------------------------------------
   HeroMockup — visual produk 100% CSS: mini CV + floating skor ATS/plagiarism
--------------------------------------------------------------------------- */
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
      {/* Glow di belakang mockup */}
      <div className="blob -top-10 left-1/2 h-72 w-72 -translate-x-1/2 bg-primary/25" />
      <div className="blob bottom-0 right-0 h-56 w-56 bg-indigo-500/20" />

      {/* Card utama — dokumen CV */}
      <div className="relative rounded-2xl bg-white p-5 shadow-xl ring-1 ring-black/5 md:p-6">
        {/* Bar mini window */}
        <div className="mb-4 flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
          <span className="ml-3 hidden rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-fg sm:block">
            resufy · preview CV
          </span>
        </div>

        {/* Nama + title */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-extrabold text-foreground">Budi Santoso</p>
            <p className="text-xs font-semibold text-primary">Frontend Developer</p>
          </div>
          <span className="rounded-full bg-success/15 px-2.5 py-1 text-[10px] font-bold text-success ring-1 ring-inset ring-success/25">
            ATS OK ✓
          </span>
        </div>

        {/* Ringkasan */}
        <div className="mt-4 space-y-1.5">
          <div className="h-2 w-full rounded-full bg-muted" />
          <div className="h-2 w-5/6 rounded-full bg-muted" />
          <div className="h-2 w-2/3 rounded-full bg-muted" />
        </div>

        {/* Pengalaman — baris checklist */}
        <div className="mt-4 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-fg">
            Pengalaman
          </p>
          {['PT Nusantara Digital — Frontend Developer', 'Freelance — Web Designer'].map((job) => (
            <div
              key={job}
              className="flex items-center gap-2 rounded-lg bg-primary-50/60 px-2.5 py-2"
            >
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-cta-gradient">
                <CheckCircle size={11} weight="bold" className="text-white" />
              </span>
              <span className="truncate text-[11px] font-semibold text-foreground">{job}</span>
            </div>
          ))}
        </div>

        {/* Footer card */}
        <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-3">
          <span className="flex items-center gap-1 text-[10px] font-semibold text-muted-fg">
            <FilePdf size={13} className="text-destructive" /> PDF HQ
          </span>
          <span className="rounded-lg bg-accent/10 px-2.5 py-1 text-[11px] font-extrabold text-accent ring-1 ring-inset ring-accent/20">
            Rp2.000
          </span>
        </div>
      </div>

      {/* Floating card — ATS Score */}
      <motion.div
        {...float}
        className="absolute -left-4 -top-8 flex items-center gap-3 rounded-2xl bg-white p-3 pr-4 shadow-lg ring-1 ring-black/5 sm:-left-10"
      >
        <div className="relative grid h-14 w-14 place-items-center">
          {/* Ring conic-gradient (zero SVG): nilai 94%, track abu */}
          <div
            className="absolute inset-0 rounded-full"
            style={{ background: 'conic-gradient(var(--color-primary) 0% 94%, #E9EFF8 94% 100%)' }}
            aria-hidden
          />
          <div className="absolute inset-[6px] rounded-full bg-white" aria-hidden />
          <span className="relative text-sm font-extrabold text-primary">94</span>
        </div>
        <div>
          <p className="text-xs font-extrabold text-foreground">ATS Score</p>
          <p className="text-[10px] font-semibold text-success">Sangat baik</p>
        </div>
      </motion.div>

      {/* Floating card — Plagiarism */}
      <motion.div
        {...float}
        transition={reduced ? undefined : { duration: 6.5, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
        className="absolute -bottom-6 -right-3 flex items-center gap-2.5 rounded-2xl bg-white p-3 pr-4 shadow-lg ring-1 ring-black/5 sm:-right-8"
      >
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-success/15 text-success">
          <ShieldCheck size={20} weight="bold" />
        </span>
        <div>
          <p className="text-xs font-extrabold text-foreground">Kemiripan 3%</p>
          <p className="text-[10px] font-semibold text-success">Orisinal — lolos cek</p>
        </div>
      </motion.div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   BentoCard — kartu bento grid (Apple-style: radius besar, hover scale)
--------------------------------------------------------------------------- */
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

/* ---------------------------------------------------------------------------
   Halaman Landing
--------------------------------------------------------------------------- */
export default function Landing() {
  const reduced = useReducedMotion();
  // SEO fase 09: title/description eksplisit (sama dengan default index.html,
  // ditulis ulang agar konsisten saat navigasi client-side).
  usePageMeta({
    title: 'resufy — CV ATS, Cek Plagiarisme & Toolbox Gratis',
    description:
      'Buat CV yang lolos ATS, cek plagiarisme dokumen, dan pakai toolbox gratis (compress, parafrase teks, cek teks AI). Cek gratis, bayar Rp2.000 hanya saat unduh PDF berkualitas tinggi.',
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
        {/* Background: gradient lembut + grid + blobs */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary-50/80 via-white to-white" aria-hidden />
        <div className="bg-grid-light absolute inset-0 opacity-60" aria-hidden />
        <div className="blob -left-24 top-8 h-80 w-80 bg-primary/15" aria-hidden />
        <div className="blob -right-20 top-40 h-72 w-72 bg-indigo-400/20" aria-hidden />

        <div className="relative flex flex-col items-center text-center">
          <motion.div {...fade(0)}>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-white/80 px-4 py-1.5 text-xs font-bold text-primary shadow-sm backdrop-blur">
              <Sparkle size={14} weight="fill" className="text-accent" aria-hidden />
              Gratis daftar · Toolbox gratis · Bayar hanya saat unduh PDF HQ
            </span>
          </motion.div>

          <motion.h1
            {...fade(0.05)}
            className="max-w-3xl text-balance text-4xl font-extrabold leading-[1.08] tracking-tight text-foreground md:text-6xl"
          >
            CV yang <span className="text-gradient">diterima ATS</span>, naskah yang{' '}
            <span className="text-gradient">terbukti orisinal</span>.
          </motion.h1>

          <motion.p {...fade(0.1)} className="mt-5 max-w-xl text-balance text-base text-muted-fg md:text-lg">
            {COPY.heroSub}
          </motion.p>

          <motion.div {...fade(0.15)} className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
            <Link to="/register">
              <Button variant="primary" size="lg" icon={ArrowRight}>
                Mulai Gratis
              </Button>
            </Link>
            <Link to="/app/toolbox">
              <Button variant="secondary" size="lg">
                Coba Toolbox Gratis
              </Button>
            </Link>
          </motion.div>

          <motion.div {...fade(0.2)} className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-medium text-muted-fg">
            <span className="flex items-center gap-1.5">
              <FloppyDisk size={14} className="text-primary" aria-hidden /> Tersimpan otomatis
            </span>
            <span className="flex items-center gap-1.5">
              <Bank size={14} className="text-primary" aria-hidden /> Bayar via Midtrans
            </span>
            <span className="flex items-center gap-1.5">
              <LockKey size={14} className="text-primary" aria-hidden /> Tanpa kartu saat daftar
            </span>
          </motion.div>
        </div>

        {/* Visual produk */}
        <motion.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
        >
          <HeroMockup />
        </motion.div>
      </section>

      {/* ============================ STATS ============================ */}
      <section className="cv-auto relative -mt-8 pb-10" aria-label="Angka resufy">
        <motion.div {...stagger(0)} className="mx-auto grid max-w-4xl grid-cols-2 gap-6 rounded-2xl border border-border bg-surface px-6 py-8 shadow-lg ring-1 ring-black/5 md:grid-cols-4 md:gap-4">
          <StatNumber value={10000} suffix="+" label="dokumen dibuat & diunduh" />
          <StatNumber value={2000} prefix="Rp" label="harga tetap per unduh HQ" />
          <StatNumber value={3} label="modul dalam satu akun" />
          <StatNumber value={4} label="alat toolbox gratis" />
        </motion.div>
      </section>

      {/* ============================ FITUR (BENTO) ============================ */}
      <section className="cv-auto py-14" aria-labelledby="fitur-title">
        <motion.div {...stagger(0)} className="mb-10 text-center">
          <Badge tone="info" icon={Sparkle}>
            FITUR
          </Badge>
          <h2 id="fitur-title" className="mt-3 text-balance text-3xl font-extrabold text-foreground md:text-4xl">
            Satu akun untuk semua kebutuhan dokumen kamu
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-fg md:text-base">
            Tiga modul yang saling melengkapi — tanpa biaya langganan, tanpa kejutan.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          {/* Card besar — CV ATS */}
          <motion.div {...stagger(0.05)} className="md:col-span-7">
            <BentoCard
              icon={FileText}
              title="CV ATS-Ready"
              desc="Format satu kolom, rapi, dan mudah dibaca mesin rekruter — lengkap dengan skor & rekomendasi perbaikan secara langsung."
              className="h-full"
            >
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  ['Struktur standar rekruter', 'Ringkasan, pengalaman, pendidikan'],
                  ['Skor ATS langsung', 'Cek berkali-kali, gratis'],
                ].map(([t, d]) => (
                  <div key={t} className="rounded-xl bg-primary-50/70 p-3.5">
                    <p className="flex items-center gap-1.5 text-xs font-bold text-primary">
                      <CheckCircle size={14} weight="bold" aria-hidden /> {t}
                    </p>
                    <p className="mt-1 text-xs text-muted-fg">{d}</p>
                  </div>
                ))}
              </div>
            </BentoCard>
          </motion.div>

          {/* Card — Plagiarism */}
          <motion.div {...stagger(0.1)} className="md:col-span-5">
            <BentoCard
              icon={Copy}
              title="Cek Plagiarisme"
              desc="Pastikan naskahmu orisinal sebelum dikirim. Lihat sumber kemiripan satu per satu."
              className="h-full"
            >
              <div className="mt-5 flex items-end gap-1.5" aria-hidden>
                {[18, 40, 26, 62, 34, 8].map((h, i) => (
                  <div
                    key={i}
                    className={`w-3 rounded-t-md ${i === 3 ? 'bg-accent/70' : 'bg-primary/25'}`}
                    style={{ height: `${Math.max(h / 1.4, 8)}px` }}
                  />
                ))}
                <span className="ml-1 rounded-md bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success ring-1 ring-inset ring-success/25">
                  3% kemiripan
                </span>
              </div>
            </BentoCard>
          </motion.div>

          {/* Card — Toolbox */}
          <motion.div {...stagger(0.05)} className="md:col-span-5">
            <BentoCard
              icon={Wrench}
              title="Toolbox Gratis"
              desc="Utilitas dokumen tanpa perlu akun — kompres, parafrase teks dengan AI, dan cek teks AI."
              className="h-full"
            >
              <div className="mt-5 flex gap-2.5">
                {[FilePdf, TextAa, Brain].map((T, i) => (
                  <span
                    key={i}
                    className="grid h-10 w-10 place-items-center rounded-xl bg-muted text-muted-fg ring-1 ring-inset ring-border transition-colors group-hover:bg-primary-50 group-hover:text-primary"
                  >
                    <T size={18} weight="bold" aria-hidden />
                  </span>
                ))}
              </div>
            </BentoCard>
          </motion.div>

          {/* Card besar — Payment */}
          <motion.div {...stagger(0.1)} className="md:col-span-7">
            <BentoCard
              icon={ShieldCheck}
              title="Satu harga jujur — Rp2.000"
              desc="Gunakan semua fitur gratis tanpa batas. Bayar sekali hanya saat kamu benar-benar ingin mengunduh PDF berkualitas tinggi. Dokumen final tersimpan permanen di akunmu."
              className="h-full"
            >
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <PriceTag className="items-start" />
                <div className="flex flex-wrap gap-2 text-xs font-semibold text-muted-fg">
                  <span className="rounded-full bg-success/15 px-3 py-1.5 text-success ring-1 ring-inset ring-success/25">
                    Tanpa langganan
                  </span>
                  <span className="rounded-full bg-success/15 px-3 py-1.5 text-success ring-1 ring-inset ring-success/25">
                    Unduh ulang kapan saja
                  </span>
                </div>
              </div>
            </BentoCard>
          </motion.div>
        </div>
      </section>

      {/* ============================ CARA KERJA ============================ */}
      <section className="cv-auto py-14" aria-labelledby="cara-title">
        <motion.div {...stagger(0)} className="mb-10 text-center">
          <Badge tone="info" icon={Sparkle}>
            CARA KERJA
          </Badge>
          <h2 id="cara-title" className="mt-3 text-3xl font-extrabold text-foreground md:text-4xl">
            Dari nol sampai PDF HQ dalam 3 langkah
          </h2>
        </motion.div>

        <ol className="relative grid gap-5 md:grid-cols-3">
          <motion.li {...stagger(0.05)} className="relative">
            <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm transition-shadow duration-200 hover:shadow-md">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-cta-gradient font-extrabold text-white shadow-glow-primary">
                01
              </span>
              <h3 className="mt-4 text-lg font-bold text-foreground">Buat dokumen</h3>
              <p className="mt-1.5 text-sm text-muted-fg">Isi CV lewat form bertahap atau unggah file.</p>
            </div>
          </motion.li>
          <motion.li {...stagger(0.1)} className="relative">
            <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm transition-shadow duration-200 hover:shadow-md">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-cta-gradient font-extrabold text-white shadow-glow-primary">
                02
              </span>
              <h3 className="mt-4 text-lg font-bold text-foreground">Preview & cek</h3>
              <p className="mt-1.5 text-sm text-muted-fg">
                Lihat pratinjau ber-watermark + skor ATS langsung.
              </p>
            </div>
          </motion.li>
          <motion.li {...stagger(0.15)} className="relative">
            <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm transition-shadow duration-200 hover:shadow-md">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-cta-gradient font-extrabold text-white shadow-glow-primary">
                03
              </span>
              <h3 className="mt-4 text-lg font-bold text-foreground">Bayar & unduh HQ</h3>
              <p className="mt-1.5 text-sm text-muted-fg">{COPY.onceOnly}</p>
            </div>
          </motion.li>
        </ol>
      </section>

      {/* ============================ TESTIMONIAL ============================ */}
      <section className="cv-auto py-14" aria-labelledby="testi-title">
        <motion.div {...stagger(0)} className="mb-10 text-center">
          <Badge tone="info" icon={Star}>
            KATA MEREKA
          </Badge>
          <h2 id="testi-title" className="mt-3 text-3xl font-extrabold text-foreground md:text-4xl">
            Dipercaya pelamar kerja Indonesia
          </h2>
        </motion.div>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              name: 'Rina Wulandari',
              role: 'Fresh Graduate · Jakarta',
              text: 'Lamaran pertamaku tembus screening ATS setelah pakai resufy. Skor 94 langsung bikin pede.',
              initials: 'RW',
            },
            {
              name: 'Bagus Pratama',
              role: 'Content Writer · Yogyakarta',
              text: 'Cek plagiarisme-nya lengkap sampai daftar sumber. Harga Rp2.000 terasa sangat wajar.',
              initials: 'BP',
            },
            {
              name: 'Dewi Lestari',
              role: 'HR Assistant · Bandung',
              text: 'Toolbox-nya gratis dan cepat. Kompres PDF untuk kirim lampiran jadi nggak ribet.',
              initials: 'DL',
            },
          ].map((t, i) => (
            <motion.figure
              key={t.name}
              {...stagger(0.05 + i * 0.05)}
              className="flex flex-col rounded-2xl border border-border bg-surface p-6 shadow-sm transition-shadow duration-200 hover:shadow-md"
            >
              <div className="flex gap-0.5 text-warning" aria-label="5 dari 5">
                {Array.from({ length: 5 }).map((_, s) => (
                  <Star key={s} size={14} weight="fill" aria-hidden />
                ))}
              </div>
              <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-foreground">
                “{t.text}”
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-3 border-t border-border/70 pt-4">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-cta-gradient text-xs font-bold text-white ring-2 ring-white">
                  {t.initials}
                </span>
                <div>
                  <p className="text-sm font-bold text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-fg">{t.role}</p>
                </div>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </section>

      {/* ============================ PRICING ============================ */}
      <section className="cv-auto py-14" aria-labelledby="harga-title">
        <motion.div {...stagger(0)} className="mx-auto max-w-md">
          <div className="relative overflow-hidden rounded-3xl border border-accent/25 bg-white p-8 text-center shadow-xl ring-1 ring-black/5">
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-indigo-500 to-accent" aria-hidden />
            <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent ring-1 ring-inset ring-accent/25">
              SEKALI BAYAR · TANPA LANGGANAN
            </span>
            <h2 id="harga-title" className="mt-4 text-2xl font-extrabold text-foreground">
              Unduh PDF kualitas tinggi
            </h2>
            <div className="mt-4 flex items-end justify-center gap-1">
              <span className="text-6xl font-extrabold tabular-nums tracking-tight text-accent drop-shadow-sm">
                Rp2.000
              </span>
              <span className="pb-2 text-sm font-semibold text-muted-fg">/dokumen</span>
            </div>
            <ul className="mt-6 space-y-2.5 text-left text-sm">
              {[
                'Semua fitur gratis tanpa batas',
                'Preview PDF ber-watermark gratis',
                'PDF final berkualitas tinggi, sekali bayar',
                'Invoice otomatis + unduh ulang kapan saja',
                'Pembayaran aman via Midtrans',
              ].map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <CheckCircle size={18} weight="bold" className="mt-0.5 shrink-0 text-success" aria-hidden />
                  <span className="text-foreground">{b}</span>
                </li>
              ))}
            </ul>
            <Link to="/register" className="mt-7 block">
              <Button variant="primary" size="lg" className="w-full" icon={ArrowRight}>
                Mulai Gratis Sekarang
              </Button>
            </Link>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-fg">
              <Quotes size={13} aria-hidden /> Tanpa kartu kredit saat daftar
            </p>
          </div>
        </motion.div>
      </section>

      {/* ============================ CTA AKHIR ============================ */}
      <section className="cv-auto pb-20 pt-6">
        <motion.div {...stagger(0)} className="relative overflow-hidden rounded-3xl bg-panel-gradient px-6 py-14 text-center text-white shadow-xl md:px-12">
          <div className="bg-grid absolute inset-0 opacity-40" aria-hidden />
          <div className="blob -left-16 -top-20 h-72 w-72 bg-primary-500/40" aria-hidden />
          <div className="blob -bottom-24 -right-10 h-72 w-72 bg-indigo-400/30" aria-hidden />

          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-balance text-3xl font-extrabold md:text-4xl">
              Siap membuat CV yang benar-benar lolos saringan ATS?
            </h2>
            <p className="mx-auto mt-4 max-w-md text-sm text-white/80 md:text-base">
              Daftar gratis, lengkapi CV, cek ATS & plagiarisme tanpa biaya. Bayar sekali —
              Rp2.000 — saat kamu yakin mau unduh versi final.
            </p>
            <Link to="/register" className="mt-8 inline-block">
              <Button variant="accent" size="lg" icon={ArrowRight}>
                Buat CV Pertamamu
              </Button>
            </Link>
            <p className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-white/70">
              <span className="flex items-center gap-1.5">
                <FloppyDisk size={13} aria-hidden /> Dokumen tersimpan otomatis di akunmu.
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle size={13} aria-hidden /> Tanpa kartu kredit saat daftar.
              </span>
            </p>
          </div>
        </motion.div>
      </section>
    </PublicLayout>
  );
}
