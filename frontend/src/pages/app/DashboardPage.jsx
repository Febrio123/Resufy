import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  ArrowSquareOut,
  CheckCircle,
  Copy,
  FileText,
  MagnifyingGlass,
  Plus,
  Receipt,
  Sparkle,
  Wrench,
} from '@phosphor-icons/react';
import { cvsApi } from '../../services/cvs';
import { plagiarismApi } from '../../services/plagiarism';
import { paymentsApi } from '../../services/payments';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Tabs } from '../../components/Tabs';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { ListSkeleton } from '../../components/ui/Skeleton';
import { StatusDot } from '../../components/ui/StatusDot';
import { StatCard } from '../../components/StatCard';
import { useCountUp } from '../../hooks/useCountUp';
import { InvoiceModal } from '../../components/InvoiceModal';
import { TOOLS } from './toolbox/ToolboxPage';
import { atsTone, formatDate, formatPrice } from '../../utils/format';
import { extractErrorMessage } from '../../utils/errors';

const TABS = [
  { value: 'cvs', label: 'CV Saya', icon: FileText },
  { value: 'plagiarism', label: 'Cek Plagiarisme', icon: CheckCircle },
  { value: 'transactions', label: 'Transaksi', icon: Receipt },
  { value: 'toolbox', label: 'Toolbox', icon: Wrench, href: '/app/toolbox' },
];

function greetingFor(hour) {
  if (hour < 11) return 'Selamat pagi';
  if (hour < 15) return 'Selamat siang';
  if (hour < 18) return 'Selamat sore';
  return 'Selamat malam';
}

/** Kartu angka ringkas (jumlah CV, jumlah cek, total pembayaran). */
function StatItem({ icon: Icon, grad, value, label, sub, formatter }) {
  const animated = useCountUp(value ?? 0, { duration: 0.9 });
  const text = value == null ? '—' : formatter ? formatter(animated) : `${animated}`;
  return (
    <Card className="h-full p-4">
      <span
        className={`grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br ${grad} text-white shadow-lg`}
        aria-hidden
      >
        <Icon size={20} weight="bold" />
      </span>
      <p className="mt-3 text-2xl font-extrabold tabular-nums text-foreground">{text}</p>
      <p className="text-xs font-semibold text-muted-fg">{label}</p>
      {sub ? <p className="mt-0.5 text-[11px] text-muted-fg">{sub}</p> : null}
    </Card>
  );
}

export default function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = TABS.some((t) => t.value === searchParams.get('tab')) ? searchParams.get('tab') : 'cvs';
  const toast = useToast();
  const { user } = useAuth();
  const reduced = useReducedMotion();

  const [cvs, setCvs] = useState(null);
  const [checks, setChecks] = useState(null);
  const [payments, setPayments] = useState(null);
  const [invoice, setInvoice] = useState(null);
  // Data ringkas untuk stat cards — fetch terpisah dari list per-tab.
  const [stats, setStats] = useState({ cvs: null, checks: null, payments: null });

  const setTab = useCallback(
    (value) => setSearchParams(value === 'cvs' ? {} : { tab: value }, { replace: true }),
    [setSearchParams]
  );

  useEffect(() => {
    if (tab !== 'cvs') return;
    let alive = true;
    cvsApi
      .list({ page: 1, limit: 5 })
      .then((res) => alive && setCvs(res.data))
      .catch((err) => alive && toast.error(extractErrorMessage(err)));
    return () => {
      alive = false;
    };
  }, [tab, toast]);

  useEffect(() => {
    if (tab !== 'plagiarism') return;
    let alive = true;
    plagiarismApi
      .list({ page: 1, limit: 5 })
      .then((res) => alive && setChecks(res.data))
      .catch((err) => alive && toast.error(extractErrorMessage(err)));
    return () => {
      alive = false;
    };
  }, [tab, toast]);

  useEffect(() => {
    if (tab !== 'transactions') return;
    let alive = true;
    paymentsApi
      .list()
      .then((res) => alive && setPayments(res.data))
      .catch((err) => alive && toast.error(extractErrorMessage(err)));
    return () => {
      alive = false;
    };
  }, [tab, toast]);

  // Ringkasan statistik (mount sekali). Gagal fetch = diam saja → kartu tampil '—'.
  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      cvsApi.list({ page: 1, limit: 100 }),
      plagiarismApi.list({ page: 1, limit: 100 }),
      paymentsApi.list(),
    ]).then(([cvRes, plRes, payRes]) => {
      if (!alive) return;
      setStats({
        cvs: cvRes.status === 'fulfilled' ? cvRes.value.data : null,
        checks: plRes.status === 'fulfilled' ? plRes.value.data : null,
        payments: payRes.status === 'fulfilled' ? payRes.value.data : null,
      });
    });
    return () => {
      alive = false;
    };
  }, []);

  const summary = useMemo(() => {
    const cvsList = stats.cvs?.cvs ?? null;
    const checksList = stats.checks?.checks ?? null;
    const paymentsList = stats.payments?.payments ?? null;

    const cvsCount = cvsList?.length ?? null;
    const draftCount = cvsList ? cvsList.filter((c) => c.paidStatus !== 'paid').length : null;
    const finalCount = cvsList ? cvsList.filter((c) => c.paidStatus === 'paid').length : null;

    const scored = cvsList ? cvsList.filter((c) => c.atsScore != null).map((c) => c.atsScore) : [];
    const avgAts = scored.length
      ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length)
      : null;

    const checksCount = checksList?.length ?? null;
    const doneCount = checksList
      ? checksList.filter((c) => c.status === 'completed').length
      : null;

    const settled = paymentsList ? paymentsList.filter((p) => p.status === 'settlement') : [];
    const paidCount = paymentsList ? settled.length : null;
    const totalRevenue = paymentsList
      ? settled.reduce((acc, p) => acc + (Number(p.amount) || 0), 0)
      : null;

    return { cvsCount, draftCount, finalCount, avgAts, checksCount, doneCount, paidCount, totalRevenue };
  }, [stats]);

  const firstName = user?.name?.split(' ')[0] || 'Kawan';
  const greeting = greetingFor(new Date().getHours());
  const avgTone = atsTone(summary.avgAts).tone;

  const itemAnim = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

  return (
    <div className="space-y-6">
      {/* ============ HERO — sapaan + CTA aksi cepat ============ */}
      <motion.section
        initial={reduced ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        aria-label="Sapaan"
        className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary-50 via-surface to-indigo-50 px-5 py-6 sm:px-8 sm:py-8"
      >
        <div className="bg-grid-light absolute inset-0" aria-hidden />
        <div className="blob absolute -right-16 -top-24 h-64 w-64 bg-primary/15" aria-hidden />

        <div className="relative flex flex-col gap-5">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-primary ring-1 ring-inset ring-primary/15">
            <Sparkle size={14} weight="fill" aria-hidden />
            Beranda resufy
          </span>
          <div className="max-w-2xl">
            <h1 className="text-2xl font-extrabold leading-tight text-foreground sm:text-3xl">
              {greeting}, <span className="text-gradient">{firstName}</span>
            </h1>
            <p className="mt-2 text-sm text-muted-fg sm:text-base">
              Kelola CV, pantau skor ATS, dan unduh PDF final — semua tersimpan di satu tempat.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/app/cvs/new">
              <Button variant="accent" size="lg" icon={Plus}>
                Buat CV Baru
              </Button>
            </Link>
            <Link to="/app/plagiarism">
              <Button variant="primary" size="lg" icon={MagnifyingGlass}>
                Cek Plagiarisme
              </Button>
            </Link>
          </div>
        </div>
      </motion.section>

      {/* ============ RINGKASAN / STAT CARDS ============ */}
      <motion.section
        initial={reduced ? false : 'hidden'}
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: reduced ? 0 : 0.06 } } }}
        aria-label="Ringkasan aktivitas"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <motion.div variants={itemAnim} className="min-w-0">
          <StatItem
            icon={FileText}
            grad="from-primary to-indigo-600"
            value={summary.cvsCount}
            label="CV Saya"
            sub={
              summary.cvsCount != null
                ? `${summary.draftCount} draft · ${summary.finalCount} final`
                : null
            }
          />
        </motion.div>

        <motion.div variants={itemAnim} className="min-w-0">
          <Card className="flex h-full items-center justify-center p-2">
            <StatCard
              score={summary.avgAts}
              tone={avgTone}
              label="Skor ATS Rata-rata"
              size={104}
            />
          </Card>
        </motion.div>

        <motion.div variants={itemAnim} className="min-w-0">
          <StatItem
            icon={CheckCircle}
            grad="from-emerald-500 to-teal-500"
            value={summary.checksCount}
            label="Cek Plagiarisme"
            sub={
              summary.checksCount != null && summary.doneCount != null
                ? `${summary.doneCount} selesai`
                : null
            }
          />
        </motion.div>

        <motion.div variants={itemAnim} className="min-w-0">
          <StatItem
            icon={Receipt}
            grad="from-accent to-accent-600"
            value={summary.totalRevenue}
            label="Pembayaran Lunas"
            formatter={(v) => formatPrice(v)}
            sub={summary.paidCount != null ? `${summary.paidCount} transaksi` : null}
          />
        </motion.div>
      </motion.section>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {/* -------- Tab: CV Saya -------- */}
      {tab === 'cvs' && (
        <section className="space-y-3" aria-label="Daftar CV">
          {!cvs ? (
            <ListSkeleton count={3} />
          ) : cvs.cvs?.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Belum ada CV"
              description="Buat CV pertamamu — gratis. Lengkapi data, cek skor ATS, baru bayar saat mau unduh PDF final."
              action={
                <Link to="/app/cvs/new">
                  <Button variant="accent" icon={Plus}>
                    Buat CV
                  </Button>
                </Link>
              }
            />
          ) : (
            cvs.cvs.map((cv) => (
              <Card key={cv._id} padded={false} hoverable className="p-0">
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-cta-gradient text-white shadow-glow-primary">
                      <FileText size={20} weight="bold" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-foreground">{cv.title}</p>
                      <p className="text-xs text-muted-fg">Diperbarui {formatDate(cv.updatedAt)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pl-[52px] sm:pl-0">
                    {cv.atsScore != null && (
                      <Badge tone={atsTone(cv.atsScore).tone}>ATS {cv.atsScore}/100</Badge>
                    )}
                    <Badge tone={cv.paidStatus === 'paid' ? 'selesai' : 'draft'}>
                      {cv.paidStatus === 'paid' ? 'Final' : 'Draft'}
                    </Badge>
                    <Link to={`/app/cvs/${cv._id}`}>
                      <Button variant="secondary" size="sm">
                        Buka
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            ))
          )}
        </section>
      )}

      {/* -------- Tab: Plagiarisme -------- */}
      {tab === 'plagiarism' && (
        <section className="space-y-3" aria-label="Riwayat pengecekan plagiarisme">
          {!checks ? (
            <ListSkeleton count={3} />
          ) : checks.checks?.length === 0 ? (
            <EmptyState
              icon={CheckCircle}
              title="Belum ada pengecekan"
              description="Unggah dokumen dan lihat persentase kemiripan + daftar sumbernya."
              action={
                <Link to="/app/plagiarism">
                  <Button variant="primary" icon={MagnifyingGlass}>
                    Cek Sekarang
                  </Button>
                </Link>
              }
            />
          ) : (
            checks.checks.map((check) => (
              <Card key={check._id} padded={false} hoverable className="p-0">
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg">
                      <CheckCircle size={20} weight="bold" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-foreground">
                        {check.originalFilename || 'Pengecekan'}
                      </p>
                      <p className="text-xs text-muted-fg">
                        {formatDate(check.createdAt)} · {check.fileType?.toUpperCase()} ·{' '}
                        {check.status === 'completed' ? (
                          <span className="font-bold text-foreground">
                            Kemiripan {check.overallScore ?? 0}%
                          </span>
                        ) : (
                          <StatusDot tone="warning" label="Sedang diperiksa" pulse />
                        )}
                      </p>
                    </div>
                  </div>
                  <Link to={`/app/plagiarism/${check._id}`} className="pl-[52px] sm:pl-0">
                    <Button variant="secondary" size="sm" icon={ArrowSquareOut}>
                      Lihat Hasil
                    </Button>
                  </Link>
                </div>
              </Card>
            ))
          )}
        </section>
      )}

      {/* -------- Tab: Transaksi -------- */}
      {tab === 'transactions' && (
        <section className="space-y-3" aria-label="Riwayat transaksi">
          {!payments ? (
            <ListSkeleton count={3} />
          ) : payments.payments?.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Belum ada transaksi"
              description="Transaksi muncul saat kamu membayar Rp2.000 untuk mengunduh PDF final — sekali bayar, tanpa langganan."
            />
          ) : (
            payments.payments.map((payment) => (
              <Card key={payment._id} padded={false} hoverable className="p-0">
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-b from-accent to-accent-600 text-white shadow-glow-accent">
                      <Receipt size={20} weight="bold" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-foreground">
                        {payment.itemType === 'cv' ? 'CV' : 'Laporan Plagiarisme'} ·{' '}
                        {formatDate(payment.createdAt)}
                      </p>
                      <p className="text-xs text-muted-fg">
                        {payment.invoiceNumber} · {payment.paymentMethod || 'Midtrans'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pl-[52px] sm:pl-0">
                    <Badge tone={payment.status === 'settlement' ? 'lunas' : 'pending'}>
                      {payment.status === 'settlement' ? 'Lunas' : payment.status}
                    </Badge>
                    <span className="text-sm font-extrabold tabular-nums text-foreground">
                      {formatPrice(payment.amount)}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => setInvoice(payment)}>
                      Invoice
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </section>
      )}

      {/* -------- Tab: Toolbox (kartu mini 4 tool) -------- */}
      {tab === 'toolbox' && (
        <section className="space-y-3" aria-label="Toolbox">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-extrabold text-foreground">Toolbox gratis</h2>
              <p className="text-xs text-muted-fg">
                Kompres, parafrase teks, dan cek teks AI — tanpa perlu akun.
              </p>
            </div>
            <Link to="/app/toolbox">
              <Button variant="ghost" size="sm" icon={ArrowRight}>
                Buka Semua
              </Button>
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {TOOLS.map((tool) => (
              <Link key={tool.key} to={`/app/toolbox/${tool.key}`} className="group">
                <Card
                  padded={false}
                  className="h-full p-0 transition-shadow duration-200 group-hover:border-primary/20 group-hover:shadow-lg"
                >
                  <div className="flex items-center gap-3 p-4">
                    <span
                      className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${tool.grad} text-white shadow-lg transition-transform duration-200 group-hover:scale-110`}
                    >
                      <tool.icon size={22} weight="bold" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-foreground group-hover:text-primary">
                        {tool.title}
                      </p>
                      <p className="line-clamp-1 text-xs text-muted-fg">{tool.desc}</p>
                    </div>
                    <Badge tone="gratis" className="ml-auto shrink-0">
                      Gratis
                    </Badge>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Footer info — Midtrans / pay-per-print */}
      <Card className="overflow-hidden p-0">
        <div className="flex items-start gap-3 bg-gradient-to-r from-primary-50/70 to-surface p-4 text-xs text-muted-fg">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-cta-gradient text-white shadow-glow-primary">
            <Copy size={16} weight="bold" aria-hidden />
          </span>
          <p className="pt-1.5">
            Semua pembayaran dilakukan via Midtrans. Dokumen final tersimpan permanen di akunmu —
            bisa diunduh ulang kapan saja tanpa bayar lagi.
          </p>
        </div>
      </Card>

      <InvoiceModal
        open={Boolean(invoice)}
        onClose={() => setInvoice(null)}
        payment={invoice}
        itemTitle={invoice?.itemType === 'cv' ? 'Unduh PDF CV' : 'Unduh PDF Laporan'}
      />
    </div>
  );
}
