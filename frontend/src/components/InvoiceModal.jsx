import { Receipt } from '@phosphor-icons/react';
import { Badge } from './ui/Badge';
import { Modal } from './ui/Modal';
import { formatDate, formatDateTime, formatIdr } from '../utils/format';

const ITEM_LABELS = { cv: 'CV', plagiarism: 'Laporan Plagiarisme' };

/**
 * InvoiceModal — invoice sederhana transaksi settlement (wireframe 4.3 tab Transaksi).
 * Format nominal formal: "IDR 2.000" (03-ui-ux-design.md §6.5).
 */
export function InvoiceModal({ open, onClose, payment, itemTitle }) {
  if (!payment) return null;

  const rows = [
    { label: 'Nomor Invoice', value: payment.invoiceNumber || payment.midtransOrderId || '-' },
    { label: 'Tanggal', value: formatDateTime(payment.paidAt || payment.createdAt) },
    {
      label: 'Item',
      value: itemTitle || `${ITEM_LABELS[payment.itemType] || 'Dokumen'} (${String(payment.itemId).slice(-6)})`,
    },
    { label: 'Metode Pembayaran', value: payment.paymentMethod || '-' },
  ];

  return (
    <Modal open={open} onClose={onClose} size="sm" labelledBy="invoice-title" title="Invoice">
      <div className="rounded-lg border border-border">
        <div className="flex items-center justify-between border-b border-border bg-bg px-4 py-3">
          <div className="flex items-center gap-2">
            <Receipt size={20} className="text-primary" aria-hidden />
            <span className="text-sm font-extrabold text-foreground">resufy</span>
          </div>
          <Badge tone="lunas">Lunas</Badge>
        </div>
        <dl className="divide-y divide-border px-4 py-2">
          {rows.map((row) => (
            <div key={row.label} className="flex items-start justify-between gap-4 py-2.5">
              <dt className="text-sm text-muted-fg">{row.label}</dt>
              <dd className="text-right text-sm font-semibold text-foreground">{row.value}</dd>
            </div>
          ))}
          <div className="flex items-start justify-between gap-4 py-3">
            <dt className="text-sm font-bold text-foreground">Total</dt>
            <dd className="text-right text-lg font-extrabold tabular-nums text-accent">
              {formatIdr(payment.amount)}
            </dd>
          </div>
        </dl>
        <p className="border-t border-border px-4 py-3 text-xs text-muted-fg">
          Dibayar {formatDate(payment.paidAt || payment.createdAt)} · Pay-per-print, tanpa
          langganan. Simpan bukti ini untuk kebutuhan kamu.
        </p>
      </div>
    </Modal>
  );
}
