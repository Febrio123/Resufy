import { useCallback } from 'react';

/**
 * Integrasi Snap Midtrans (03-ui-ux-design.md §7.2 poin 6):
 * - Load snap.js sekali dengan data-client-key (CLIENT KEY = publik, dari env).
 * - Callback client TIDAK dianggap source of truth — polling status server tetap
 *   dijalankan setelah Snap dibuka/ditutup (keputusan lintas fase).
 * - Fallback: bila Snap gagal dimuat → buka redirectUrl di tab baru.
 */

const SNAP_JS_URL =
  import.meta.env.VITE_MIDTRANS_PRODUCTION === 'true'
    ? 'https://app.midtrans.com/snap/snap.js'
    : 'https://app.sandbox.midtrans.com/snap/snap.js';

let snapScriptPromise = null;

function loadSnapScript(clientKey) {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Snap hanya tersedia di browser'));
  }
  if (window.snap) return Promise.resolve(window.snap);
  if (!snapScriptPromise) {
    snapScriptPromise = new Promise((resolve, reject) => {
      const existing = document.getElementById('midtrans-snap');
      if (existing) {
        existing.addEventListener('load', () => resolve(window.snap));
        existing.addEventListener('error', () => reject(new Error('Gagal memuat Snap.js')));
        return;
      }
      const script = document.createElement('script');
      script.id = 'midtrans-snap';
      script.src = SNAP_JS_URL;
      script.setAttribute('data-client-key', clientKey);
      script.onload = () => resolve(window.snap);
      script.onerror = () => {
        snapScriptPromise = null;
        reject(new Error('Gagal memuat Snap.js — periksa VITE_MIDTRANS_CLIENT_KEY'));
      };
      document.head.appendChild(script);
    });
  }
  return snapScriptPromise;
}

export function useSnap() {
  return useCallback(
    async ({ snapToken, redirectUrl, onSuccess, onPending, onError, onClose }) => {
      const clientKey = import.meta.env.VITE_MIDTRANS_CLIENT_KEY;
      if (!clientKey) {
        throw new Error('VITE_MIDTRANS_CLIENT_KEY belum diisi di frontend/.env');
      }
      try {
        const snap = await loadSnapScript(clientKey);
        snap.pay(snapToken, {
          onSuccess: (result) => onSuccess?.(result),
          onPending: (result) => onPending?.(result),
          onError: (result) => onError?.(result),
          onClose: () => onClose?.(),
        });
      } catch (err) {
        // Fallback: buka halaman pembayaran Snap di tab baru
        if (redirectUrl) {
          window.open(redirectUrl, '_blank', 'noopener');
          onPending?.({ fallback: true });
          return;
        }
        throw err;
      }
    },
    []
  );
}
