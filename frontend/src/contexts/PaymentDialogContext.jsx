import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowClockwise,
  ArrowSquareOut,
  CheckCircle,
  CreditCard,
  FileText,
  Lock,
  XCircle,
} from '@phosphor-icons/react';
import { paymentsApi } from '../services/payments';
import { ensureFreshSession } from '../services/http';
import { useSnap } from '../hooks/useSnap';
import { usePolling } from '../hooks/usePolling';
import { useToast } from './ToastContext';
import { extractErrorMessage, isAlreadyPaid } from '../utils/errors';
import { COPY } from '../utils/constants';
import { formatPrice } from '../utils/format';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { PriceTag } from '../components/ui/PriceTag';
import { WatermarkOverlay } from '../components/WatermarkOverlay';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';

const PaymentDialogContext = createContext(null);

export function usePaymentDialog() {
  return useContext(PaymentDialogContext);
}

/**
 * PaymentDialogProvider — modal konfirmasi pembayaran GLOBAL (03-ui-ux-design.md §4.7,
 * requirement C.11). Wajib: konfirmasi eksplisit → POST /api/payments → Snap →
 * polling 5s → settlement/expire/cancel. 409 ALREADY_PAID → tombol unduh final.
 */
export function PaymentDialogProvider({ children }) {
  const [state, setState] = useState(null);

  const openPayment = useCallback((opts) => {
    setState({
      itemType: opts.itemType,
      itemId: opts.itemId,
      title: opts.title,
      subtitle: opts.subtitle,
      previewUrl: opts.previewUrl,
      onPaid: opts.onPaid,
    });
  }, []);

  const close = useCallback(() => setState(null), []);

  const handlePaid = useCallback(
    (info) => {
      state?.onPaid?.(info);
    },
    [state]
  );

  return (
    <PaymentDialogContext.Provider value={{ openPayment }}>
      {children}
      <PaymentConfirmDialog
        key={state ? `${state.itemType}-${state.itemId}` : 'closed'}
        open={Boolean(state)}
        onClose={close}
        onPaid={handlePaid}
        {...(state || {})}
      />
    </PaymentDialogContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// State machine: confirm → creating → snap → polling → success | failed | alreadyPaid
// ---------------------------------------------------------------------------

function PaymentConfirmDialog({ open, onClose, onPaid, itemType, itemId, title, subtitle, previewUrl }) {
  const toast = useToast();
  const openSnap = useSnap();
  const reduced = useReducedMotion();

  const [phase, setPhase] = useState('confirm');
  const [payment, setPayment] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  // finalUrl (URL Cloudinary) tidak lagi dibaca untuk window.open — semua unduh
  // lewat endpoint backend. State dipertahankan agar reset/set logika tetap sama.
  const [, setFinalUrl] = useState('');
  const [lastStatus, setLastStatus] = useState(null);

  useEffect(() => {
    if (open) {
      setPhase('confirm');
      setPayment(null);
      setErrorMsg('');
      setFinalUrl('');
      setLastStatus(null);
    }
  }, [open]);

  const applyStatus = useCallback(
    (data) => {
      if (!data) return;
      setLastStatus(data);
      if (data.status === 'settlement') {
        setFinalUrl(data.finalPdfUrl || '');
        setPhase('success');
        toast.success('Pembayaran berhasil! PDF final siap diunduh.');
        onPaid?.(data);
      } else if (data.status === 'expire' || data.status === 'cancel') {
        setPhase('failed');
      }
    },
    [onPaid, toast]
  );

  // Polling status payment setiap 5s (sampai terminal state / 5 menit)
  const pollRestartKey = payment?.paymentId || 'none';
  usePolling({
    enabled: open && phase === 'polling' && Boolean(payment?.paymentId),
    fn: () => paymentsApi.status(payment.paymentId).then((r) => r.data),
    stopWhen: (d) => ['settlement', 'expire', 'cancel'].includes(d.status),
    onComplete: (d) => {
      if (!d) {
        // timeout polling ±5 menit → kembali ke fase snap, cek manual tersedia
        setPhase('snap');
        toast.info('Masih menunggu pembayaran — kamu bisa cek status secara manual.');
        return;
      }
      applyStatus(d);
    },
    onError: () => {
      /* polling gagal sementara — hook meneruskan; tetap tunggu tick berikutnya */
    },
    restartKey: pollRestartKey,
    interval: 5000,
    maxAttempts: 60,
  });

  const handleManualCheck = async () => {
    if (!payment?.paymentId) return;
    try {
      const { data } = await paymentsApi.status(payment.paymentId);
      applyStatus(data);
      if (!['settlement', 'expire', 'cancel'].includes(data.status)) {
        toast.info(`Status: ${data.status} — masih menunggu pembayaran.`);
      }
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const handleContinue = async () => {
    setPhase('creating');
    setErrorMsg('');
    try {
      const { data } = await paymentsApi.create({ itemType, itemId });
      setPayment(data);
      try {
        await openSnap({
          snapToken: data.snapToken,
          redirectUrl: data.redirectUrl,
          onSuccess: () => setPhase('polling'),
          onPending: () => setPhase('polling'),
          onError: () => setPhase('polling'),
          onClose: () => setPhase('polling'),
        });
        setPhase('polling'); // Snap terbuka/tertutup → polling server (source of truth)
      } catch (snapErr) {
        // Snap gagal dimuat & tanpa redirectUrl → polling tetap berjalan
        setPhase('polling');
        toast.error(extractErrorMessage(snapErr, 'Gagal membuka halaman pembayaran.'));
      }
    } catch (err) {
      if (isAlreadyPaid(err)) {
        const data = err.response.data;
        setFinalUrl(data.finalPdfUrl || '');
        setPhase('alreadyPaid');
        toast.info('Dokumen ini sudah dibayar — PDF final tersedia.');
        onPaid?.({ alreadyPaid: true, finalPdfUrl: data.finalPdfUrl });
      } else {
        const message = extractErrorMessage(err);
        setErrorMsg(message);
        setPhase('confirm');
        toast.error(message);
      }
    }
  };

  const handleRetry = () => {
    // Retry = payment record BARU (keputusan lintas fase), bukan transisi record lama
    setPayment(null);
    setLastStatus(null);
    setPhase('confirm');
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      labelledBy="payment-confirm-title"
      title={
        phase === 'success' || phase === 'alreadyPaid'
          ? 'Pembayaran Selesai'
          : 'Unduh PDF Berkualitas Tinggi'
      }
      hideClose={phase === 'creating' || phase === 'polling'}
    >
      <div className="space-y-4">
        {/* ----- Fase konfirmasi eksplisit ----- */}
        {phase === 'confirm' && (
          <>
            <div className="flex items-start gap-4 rounded-lg border border-border bg-bg p-4">
              <div className="relative h-40 w-28 shrink-0 overflow-hidden rounded-md border border-border bg-white">
                {previewUrl ? (
                  <>
                    <iframe
                      title="Preview dokumen"
                      src={previewUrl}
                      className="h-full w-full"
                      loading="lazy"
                    />
                    <WatermarkOverlay dense />
                  </>
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-muted/40 p-2 text-center">
                    <FileText size={28} className="text-primary" aria-hidden />
                    <span className="line-clamp-3 text-[10px] font-semibold text-muted-fg">
                      {title}
                    </span>
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground">{title}</p>
                {subtitle && <p className="mt-0.5 text-xs text-muted-fg">{subtitle}</p>}
                <div className="mt-3">
                  <PriceTag />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-md bg-muted/70 px-3 py-2.5 text-xs text-muted-fg">
              <CreditCard size={16} className="shrink-0 text-primary" aria-hidden />
              <span>
                Metode: <span className="font-semibold text-foreground">{COPY.paymentMethods}</span>
                <span className="ml-2 inline-flex items-center gap-1">
                  <Lock size={12} aria-hidden /> pembayaran aman via Midtrans
                </span>
              </span>
            </div>

            {errorMsg && (
              <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errorMsg}
              </p>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={onClose} disabled={false}>
                Batal
              </Button>
              <Button variant="accent" onClick={handleContinue} loading={false}>
                {COPY.continuePay}
              </Button>
            </div>
          </>
        )}

        {/* ----- Membuat transaksi ----- */}
        {phase === 'creating' && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Spinner size={28} label="Membuat transaksi…" />
            <p className="text-sm text-muted-fg">Menyiapkan pembayaran aman…</p>
          </div>
        )}

        {/* ----- Snap dibuka / menunggu pembayaran ----- */}
        {(phase === 'snap' || phase === 'polling') && payment && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <Spinner size={28} label="Menunggu pembayaran…" />
            <p className="text-sm font-semibold text-foreground">
              Menunggu pembayaran {formatPrice(payment.amount)}
            </p>
            <p className="text-xs text-muted-fg">
              Order: <span className="font-mono font-semibold">{payment.midtransOrderId}</span>
              <br />
              Invoice: <span className="font-mono">{payment.invoiceNumber || '-'}</span>
            </p>
            {lastStatus?.paymentMethod && (
              <Badge tone="pending">Menunggu pembayaran · {lastStatus.paymentMethod}</Badge>
            )}
            <p className="max-w-xs text-xs text-muted-fg">
              Jika halaman pembayaran tertutup, buka kembali lewat tombol di bawah. Status
              diperbarui otomatis setiap 5 detik.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={ArrowSquareOut}
                onClick={() => payment.redirectUrl && window.open(payment.redirectUrl, '_blank', 'noopener')}
              >
                Buka Halaman Pembayaran
              </Button>
              <Button variant="ghost" size="sm" icon={ArrowClockwise} onClick={handleManualCheck}>
                Cek Status
              </Button>
            </div>
          </div>
        )}

        {/* ----- Gagal: expire / cancel ----- */}
        {phase === 'failed' && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <XCircle size={40} className="text-destructive" weight="bold" aria-hidden />
            <p className="text-sm font-semibold text-foreground">
              Transaksi {lastStatus?.status === 'expire' ? 'kadaluarsa' : 'dibatalkan'}.
            </p>
            <p className="max-w-xs text-xs text-muted-fg">
              Pembayaran tidak diterima. Kamu bisa mencoba lagi dengan membuat pembayaran baru
              untuk dokumen yang sama.
            </p>
            <Button variant="accent" onClick={handleRetry}>
              Coba Bayar Lagi — Rp2.000
            </Button>
          </div>
        )}

        {/* ----- Sukses settlement ----- */}
        {(phase === 'success' || phase === 'alreadyPaid') && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <motion.span
              initial={reduced ? { opacity: 0 } : { scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <CheckCircle size={48} className="text-success" weight="bold" aria-hidden />
            </motion.span>
            <p className="text-sm font-bold text-foreground">
              {phase === 'alreadyPaid'
                ? 'Dokumen ini sudah dibayar sebelumnya'
                : 'Pembayaran berhasil!'}
            </p>
            <p className="text-xs text-muted-fg">
              {phase === 'alreadyPaid'
                ? 'PDF final kamu masih tersedia — unduh gratis, tanpa bayar lagi.'
                : COPY.paidForever}
            </p>
            <Button
              variant="accent"
              icon={CheckCircle}
              onClick={async () => {
                // Unduh lewat endpoint backend (guard paid + redirect ke signed
                // URL) — jangan buka URL Cloudinary langsung (bisa 401 saat
                // akun mengaktifkan signed URLs/restricted delivery). Segarkan
                // sesi dulu supaya access cookie 15 menit tidak menampilkan
                // JSON 401 di tab baru.
                const finalEndpoint =
                  itemType === 'cv'
                    ? `/api/cvs/${itemId}/final-pdf`
                    : `/api/plagiarism/${itemId}/final-pdf`;
                try {
                  await ensureFreshSession();
                  window.open(finalEndpoint, '_blank', 'noopener');
                } catch {
                  toast.error('Sesi berakhir — silakan masuk kembali');
                }
                onClose();
              }}
            >
              {COPY.downloadFinal}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
