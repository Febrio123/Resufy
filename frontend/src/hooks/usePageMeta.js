import { useEffect } from 'react';

/**
 * upsertMeta — cari meta tag di <head>; jika belum ada, buat; lalu set konten.
 * Mengembalikan elemen agar pemanggil bisa membersihkannya.
 */
function upsertMeta(selector, content) {
  let el = document.querySelector(selector);
  if (!el) {
    el = document.createElement('meta');
    const m = selector.match(/\[(name|property)="([^"]+)"\]/);
    if (m) el.setAttribute(m[1], m[2]);
    document.head.appendChild(el);
  }
  el.content = content;
  return el;
}

/**
 * usePageMeta — set title & meta description per halaman (SEO fase 09).
 *
 * SPA murni: crawler modern (Google) menjalankan JS dan membaca nilai dari
 * <head> hasil render, jadi tag perlu di-update saat navigasi client-side.
 * Halaman yang TIDAK memanggil hook ini memakai default dari index.html
 * (homepage) — aman karena title/description default memang untuk Landing.
 *
 * @param {Object} opts
 * @param {string} [opts.title]        — document.title (+ og:title)
 * @param {string} [opts.description]  — meta description (+ og:description)
 * @param {string} [opts.robots]       — mis. 'noindex, nofollow' untuk halaman
 *                                       sensitif (reset-password); meta dihapus
 *                                       otomatis saat navigasi keluar.
 */
export default function usePageMeta({ title, description, robots } = {}) {
  useEffect(() => {
    let robotsMeta = null;

    if (title) {
      document.title = title;
      upsertMeta('meta[property="og:title"]', title);
    }
    if (description) {
      upsertMeta('meta[name="description"]', description);
      upsertMeta('meta[property="og:description"]', description);
    }
    if (robots) {
      robotsMeta = upsertMeta('meta[name="robots"]', robots);
    }

    return () => {
      if (robotsMeta) robotsMeta.remove();
    };
  }, [title, description, robots]);
}
