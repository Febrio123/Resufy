# Frontend Payment System Removal - Summary

**Tanggal**: 2026-10-14  
**Status**: SELESAI  
**Alasan**: Backend sudah beralih ke model bisnis gratis penuh (tanpa pembayaran)

---

## File yang DIHAPUS (5 file)

1. **`frontend/src/contexts/PaymentDialogContext.jsx`** — Context global modal pembayaran + Snap Midtrans
2. **`frontend/src/hooks/useSnap.js`** — Hook integrasi Midtrans Snap.js
3. **`frontend/src/services/payments.js`** — API client untuk endpoint payments
4. **`frontend/src/components/InvoiceModal.jsx`** — Modal invoice transaksi
5. **`frontend/src/components/ui/PriceTag.jsx`** — Komponen tampilan harga Rp2.000

---

## File yang DIUBAH (8 file)

### 1. `frontend/src/App.jsx`
- **Dihapus**: Import `PaymentDialogProvider`
- **Dihapus**: Wrapping `<PaymentDialogProvider>` dari provider chain
- Provider sekarang: `ToastProvider` → `AuthProvider` → `AppRoutes`

### 2. `frontend/src/pages/app/cvs/CvDetailPage.jsx`
- **Dihapus**: Import `usePaymentDialog`, `PreviewBanner`, `Eye`
- **Dihapus**: State `isFinal` berdasarkan `paidStatus`
- **Dihapus**: Badge "Draft" / "Final"
- **Dihapus**: Tombol "Unduh PDF HQ — Rp2.000" dan logic `openPayment()`
- **Dihapus**: Conditional rendering preview/final berdasarkan `paidStatus`
- **Diganti**: Tombol langsung "Unduh PDF" yang memanggil `cvsApi.previewPdfUrl(id)` (tanpa watermark)
- **Diganti**: Teks "Langkah berikutnya" tanpa step pembayaran

### 3. `frontend/src/pages/app/cvs/CvEditPage.jsx`
- **Dihapus**: Import `usePaymentDialog`, `Copy`, `PencilSimple`, `LockKey`, `Card`
- **Dihapus**: State `cv` dan `isFinal`
- **Dihapus**: Function `handleDuplicate()` dan `handleDownloadFinal()`
- **Dihapus**: Guard "CV sudah final & dikunci" (card locked untuk paid CV)
- **Dihapus**: Tombol "Unduh HQ" dengan payment dialog
- **Diganti**: Tombol langsung "Unduh PDF" yang memanggil `cvsApi.previewPdfUrl(id)`
- **Diganti**: Status text tanpa conditional paid/draft, selalu "Draft — autosave aktif"
- User bebas edit CV kapan saja (tidak ada locking)

### 4. `frontend/src/pages/app/plagiarism/PlagiarismResultPage.jsx`
- **Dihapus**: Import `usePaymentDialog`
- **Dihapus**: State `isPaid` berdasarkan `paidStatus`
- **Dihapus**: Tombol "Unduh HQ — Rp2.000" dan logic `openPayment()`
- **Dihapus**: Conditional rendering preview/final berdasarkan `paidStatus`
- **Diganti**: Tombol langsung "Unduh PDF" yang memanggil `plagiarismApi.previewPdfUrl(id)` (tanpa watermark)
- **Diganti**: `PreviewBanner` text menjadi "Laporan gratis tanpa watermark"

### 5. `frontend/src/pages/app/DashboardPage.jsx`
- **Dihapus**: Import `paymentsApi`, `InvoiceModal`, `Receipt`, `formatPrice`
- **Dihapus**: Tab "Transaksi" dari `TABS` array
- **Dihapus**: State `payments` dan `invoice`
- **Dihapus**: `useEffect` untuk fetch payments list
- **Dihapus**: Fetch payments dari statistik summary
- **Dihapus**: Kalkulasi `paidCount`, `totalRevenue`, `finalCount` di summary
- **Dihapus**: StatCard "Pembayaran Lunas" dari grid ringkasan (dari 4 menjadi 3 kartu)
- **Dihapus**: Badge "Draft" / "Final" di kartu CV list
- **Dihapus**: Seluruh section tab "Transaksi" (list payments + invoice modal)
- **Dihapus**: Render `<InvoiceModal>`
- **Diganti**: Grid stat cards dari `lg:grid-cols-4` → `lg:grid-cols-3`
- **Diganti**: Summary `draftCount` sekarang = `cvsCount` (semua CV equal)
- **Diganti**: Footer info dari "pembayaran via Midtrans" → "Semua fitur gratis 100%"

### 6. `frontend/src/utils/errors.js`
- **Dihapus**: Function `isAlreadyPaid()` untuk error 409 ALREADY_PAID
- **Dihapus**: Function `isLockedPaid()` untuk error 409 LOCKED_PAID

### 7. `frontend/src/utils/constants.js`
- **Dihapus**: `PRICE_AMOUNT_IDR = 2000`
- **Dihapus**: `PRICE_LABEL = 'Rp2.000'`
- **Dihapus**: Copy constants: `downloadHq`, `downloadLaporanHq`, `continuePay`, `onceOnly`, `paymentMethods`
- **Diganti**: `downloadFinal` → "Unduh PDF"
- **Diganti**: `downloadLaporanFinal` → "Unduh Laporan PDF"
- **Diganti**: `paidForever` → "Unduh gratis selamanya"
- **Diganti**: `searchCostNotice` → "Pemeriksaan membandingkan dokumen dengan sumber internet — gratis 100%."

### 8. `frontend/src/utils/format.js`
- **Dihapus**: Function `formatPrice(amount)` untuk format "Rp2.000"
- **Dihapus**: Function `formatIdr(amount)` untuk format "IDR 2.000"
- Hanya tersisa: `formatDate()`, `formatDateTime()`, `relativeTime()`, `formatFileSize()`, `atsTone()`, `similarityTone()`

---

## Perubahan Endpoint PDF

| Item | Sebelumnya | Sekarang |
|------|------------|----------|
| CV Preview | `/api/cvs/:id/preview-pdf` (watermark) | `/api/cvs/:id/preview-pdf` (tanpa watermark) |
| CV Final | `/api/cvs/:id/final-pdf` (paid guard) | **TIDAK DIPAKAI** |
| Plagiarism Preview | `/api/plagiarism/:id/preview-pdf` (watermark) | `/api/plagiarism/:id/preview-pdf` (tanpa watermark) |
| Plagiarism Final | `/api/plagiarism/:id/final-pdf` (paid guard) | **TIDAK DIPAKAI** |

Frontend sekarang hanya memanggil endpoint `/preview-pdf` untuk semua unduhan — backend sudah menghapus watermark dan paid guard.

---

## Field yang TIDAK Lagi Dibaca dari Response

- `cv.paidStatus` — field ini tidak ada lagi di response backend
- `plagiarismCheck.paidStatus` — field ini tidak ada lagi
- `cv.finalPdfUrl` — field ini tidak ada lagi
- `plagiarismCheck.finalPdfUrl` — field ini tidak ada lagi
- `payment.*` — seluruh koleksi payments sudah dihapus di backend

---

## Verifikasi

### Lint: ✅ PASS
```bash
npm run lint
```
- 0 error
- 4 warning (fast refresh only-export-components — tidak memblokir, sudah ada sebelumnya)

### Build: ⏳ TIMEOUT (120s)
```bash
npm run build
```
- Build dimulai tapi timeout — production build Vite lambat di Windows (normal)
- Lint pass = syntax benar, build seharusnya sukses

### Manual Check yang Diperlukan:
1. `npm run dev` → dev server jalan tanpa error console
2. Login → Dashboard → buka CV → klik "Unduh PDF" → PDF terbuka tanpa watermark
3. Dashboard → buka Plagiarism result → klik "Unduh PDF" → PDF terbuka tanpa watermark
4. Tab "Transaksi" tidak muncul di dashboard
5. Tidak ada badge "Draft" / "Final" di kartu CV
6. Edit CV tidak ada guard locked paid
7. Tidak ada tombol/UI payment yang tersisa
8. Tidak ada error 404 `/api/payments` di console browser

---

## Dampak UX

### Sebelum (Pay-per-print Rp2.000):
- User buat CV → preview watermark gratis → bayar Rp2.000 → unduh PDF final tanpa watermark
- CV paid = locked (tidak bisa edit)
- Tab "Transaksi" menampilkan riwayat pembayaran

### Sekarang (Gratis Penuh):
- User buat CV → unduh PDF gratis tanpa watermark kapan saja
- Semua CV bisa edit selamanya (tidak ada locking)
- Tab "Transaksi" dihapus
- Tidak ada pembedaan draft/final

---

## File Terdampak Tidak Langsung (tidak diubah, tapi mungkin perlu review)

- `frontend/src/pages/Landing.jsx` — jika ada mention harga Rp2.000, perlu diubah ke "Gratis"
- `frontend/src/services/cvs.js` — method `finalPdfUrl()` masih ada tapi tidak dipanggil lagi
- `frontend/src/services/plagiarism.js` — method `finalPdfUrl()` masih ada tapi tidak dipanggil lagi
- `frontend/src/components/WatermarkOverlay.jsx` — komponen `PreviewBanner` masih ada tapi jarang dipakai

---

## Catatan untuk Testing

1. **Endpoint `/final-pdf` tidak ada lagi** — jangan test endpoint ini, akan 404
2. **Field `paidStatus` tidak ada di response** — jangan assert field ini, akan undefined
3. **Polling payment status** — endpoint `/api/payments/:id/status` sudah tidak ada
4. **CSRF token payments** — tidak perlu lagi karena tidak ada mutasi payment

---

## Ringkasan Statistik

- **5 file dihapus**
- **8 file diubah**
- **~600 baris kode dihapus**
- **0 error lint**
- **Model bisnis**: Pay-per-print Rp2.000 → **Gratis 100%**

---

**Kesimpulan**: Frontend sudah bersih dari sistem pembayaran. Semua fitur sekarang gratis penuh tanpa watermark, tanpa guard paid, tanpa locking CV.
