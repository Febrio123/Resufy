/**
 * MESIN SIMILARITY SELF-BUILT — pipeline 9 langkah (DIKUNCI fase UML 02 §4.5):
 * upload → ekstrak teks → pecah segmen → SAMPLING segmen (hemat kuota SerpApi
 * berbayar) → query SerpApi per segmen → skor per segmen (SHINGLING + JACCARD)
 * → agregasi overallScore → simpan segments + sources → status 'completed'/'failed'.
 *
 * ALGORITMA SKOR (keputusan fase backend): shingling (n-gram kata, n=3) + Jaccard
 * similarity. Alasan: (1) deterministik & tanpa training (TF-IDF butuh korpus);
 * (2) bekerja baik pada teks pendek seperti snippet hasil pencarian; (3) mudah
 * diaudit (skor = proporsi shingle yang sama antara segmen user & snippet sumber).
 *
 * ETIKA (requirement B.7): hanya textSnippet (cuplikan singkat) yang disimpan,
 * bukan konten penuh halaman sumber — respons pencarian cukup dipakai snippet-nya.
 *
 * PROSES ASYNC: runCheck dijalankan background (fire-and-forget dari controller);
 * frontend polling GET /api/plagiarism/:id (interval 5s).
 */
const axios = require('axios');
const mammoth = require('mammoth');
const mongoose = require('mongoose');
const WordExtractor = require('word-extractor');
const { PlagiarismCheck } = require('../models/plagiarismCheck.model');
const { env } = require('../config/env');
const { logger } = require('../config/logger');
const { extractPdfText } = require('../utils/pdfExtract');
const { findLocalMatches, saveFingerprints } = require('./corpusService');

// ---- Ekstraktor .doc (Word 97-2003, binary OLE) — murni JS, tanpa native/binary ----
const wordExtractor = new WordExtractor();

// ---- Konfigurasi pipeline (bisa di-tuning di fase performance 08) ----
const MAX_SEGMENTS = 60; // cap segmen dari teks dokumen
const MAX_SAMPLE_SEGMENTS = 10; // SAMPLING: maks query SerpApi per dokumen (kunci penghematan biaya)
const MIN_SEGMENT_CHARS = 40; // segmen di bawah ini diabaikan
const SNIPPET_MAX_CHARS = 250; // textSnippet yang disimpan (BUKAN teks mentah)
const SEGMENT_TEXT_MAX_CHARS = 1200; // `segments[].text` = teks ASLI USER (boleh penuh), cap 1200 char
const MAX_MATCHED_PHRASES = 20; // batas frasa terindikasi per segmen
const MIN_PHRASE_WORDS = 2; // run minimal 2 kata (hindari noise kata tunggal)
const TOP_RESULTS_PER_QUERY = 5; // hasil pencarian yang dinilai per segmen
const MATCH_THRESHOLD = 0.15; // matchScore minimal agar sumber dicatat
const ESCALATE_ON_LOW_SCORE_PCT = 18; // SCAN ADAPTIF: overallScore tahap-1 ≤ 18 → lanjut scan penuh (verifikasi negatif); > 18 → stop (plagiasi terbukti, hemat kuota). Boleh di-override via env di fase performance 08.
const SERPAPI_TIMEOUT_MS = 15000;
// Konkurensi query SerpApi per batch segmen (OPTIMASI FASE 08): paralel TAPI
// bounded — query per segmen jalan bersamaan (maks 3) sehingga scan penuh 60
// segmen selesai ~3x lebih cepat, tanpa membebani rate limit akun SerpApi.
// Urutan hasil TETAP dipertahankan (map by index) → kontrak respons tidak berubah.
const SERPAPI_CONCURRENCY = 3;
const STALE_JOB_MS = 10 * 60 * 1000; // job processing > 10 menit dianggap mati

// ============================================================================
// 1. Ekstraksi teks
// ============================================================================

async function extractText(buffer, fileType) {
  if (fileType === 'pdf') {
    return extractPdfText(buffer);
  }
  if (fileType === 'docx') {
    const { value } = await mammoth.extractRawText({ buffer });
    return String(value || '');
  }
  if (fileType === 'txt') {
    return buffer.toString('utf8');
  }
  if (fileType === 'doc') {
    // Word 97-2003 (.doc, binary OLE) — word-extractor murni JS, tanpa native/binary.
    try {
      const doc = await wordExtractor.extract(buffer);
      const text = String(doc.getBody() || '');
      // Sanitasi: normalize newline + buang baris kosong berlebihan + trim.
      return text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    } catch (err) {
      logger.warn({ err }, '[similarity] ekstraksi .doc gagal (file rusak/terproteksi?)');
      throw new Error('Dokumen .doc tidak bisa dibaca — pastikan file tidak rusak/terproteksi, atau simpan sebagai .docx/.pdf');
    }
  }
  throw new Error(`Format tidak didukung: ${fileType}`);
}

// ============================================================================
// 2. Pecah segmen (kalimat/paragraf) + 3. Sampling representatif
// ============================================================================

function splitSegments(text) {
  const clean = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
  if (!clean) return [];

  // Pecah per kalimat (.), tanda seru/tanya, atau baris baru (paragraf)
  const raw = clean.split(/(?<=[.!?])\s+|\n+/);
  const segments = raw
    .map((s) => s.trim())
    .filter((s) => s.length >= MIN_SEGMENT_CHARS)
    .slice(0, MAX_SEGMENTS);
  return segments;
}

/**
 * Pilih INDEKS segmen yang tersebar MERATA dari dokumen (awal–tengah–akhir)
 * supaya representatif tanpa harus query semua segmen (hemat kuota SerpApi).
 * Berbasis INDEKS (bukan nilai string): tiap posisi unik → segmen duplikat teks
 * tetap di-query sesuai posisinya (penting utk scannedSegments & `remaining`
 * yang dihitung dari indeks, bukan from string equality).
 */
function sampleIndexes(n, max = MAX_SAMPLE_SEGMENTS) {
  if (n <= 0) return [];
  if (n <= max) return Array.from({ length: n }, (_, i) => i);
  const step = (n - 1) / (max - 1);
  const picked = [];
  for (let i = 0; i < max; i += 1) {
    const idx = Math.round(i * step);
    if (!picked.includes(idx)) picked.push(idx);
  }
  return picked;
}

/** Sampling segmen (string) dari indeks terpilih (sampleIndexes). */
function sampleSegments(segments, max = MAX_SAMPLE_SEGMENTS) {
  return sampleIndexes(segments.length, max).map((i) => segments[i]);
}

// ============================================================================
// 4. Skor kemiripan — shingling + Jaccard
// ============================================================================

const SHINGLE_SIZE = 3;

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function makeShingles(tokens, n = SHINGLE_SIZE) {
  const set = new Set();
  if (tokens.length < n) {
    if (tokens.length > 0) set.add(tokens.join(' '));
    return set;
  }
  for (let i = 0; i <= tokens.length - n; i += 1) {
    set.add(tokens.slice(i, i + n).join(' '));
  }
  return set;
}

/** Jaccard = |A∩B| / |A∪B| (0 jika keduanya kosong). */
function jaccard(a, b) {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function scoreSegmentVsSnippet(segmentText, snippetText) {
  const a = makeShingles(tokenize(segmentText));
  const b = makeShingles(tokenize(snippetText));
  return jaccard(a, b);
}

/**
 * Buang tanda baca di TEPI frasa (mis. "…lima tahun." → "…lima tahun") agar
 * highlight <mark> presisi; offset start/end disesuaikan mengikuti teks bersih.
 */
function trimPhrase(run) {
  const t = run.text;
  let lead = 0;
  while (lead < t.length && !/[a-z0-9]/i.test(t[lead])) lead += 1;
  let trail = 0;
  while (trail < t.length - lead && !/[a-z0-9]/i.test(t[t.length - 1 - trail])) trail += 1;
  return { text: t.slice(lead, t.length - trail), start: run.start + lead, end: run.end - trail, count: run.count };
}

/**
 * Hitung frasa yang cocok antara teks segmen USER dan snippet SUMBER (murni,
 * TANPA query tambahan). Alur:
 * 1. Union shingle 3-kata dari SEMUA snippet sumber (reuse makeShingles).
 * 2. Tokenisasi segmen dengan OFFSET char asli (preserve spasi/punctuation).
 * 3. Tandai token bila membentuk shingle 3-kata yang ADA di set sumber.
 * 4. Gabung token bertanda BERURUTAN menjadi "run"; simpan run ≥ 2 kata.
 * 5. Output [{ text, start, end }] — start/end = offset char pada segmentText
 *    asli (untuk <mark> presisi frontend); maks 20 frasa, run terpanjang dulu.
 * Kosong bila tidak ada run ≥ 2 kata → frontend fallback highlight seluruh segmen.
 * ETIKA: input hanya teks USER (boleh penuh) + snippet sumber (singkat).
 */
function computeMatchedPhrases(segmentText, snippetTexts) {
  const srcText = String(segmentText || '');
  if (!srcText) return [];

  // 1) Union shingle 3-kata semua snippet sumber.
  const sourceShingles = new Set();
  for (const sn of snippetTexts || []) {
    for (const s of makeShingles(tokenize(sn))) sourceShingles.add(s);
  }
  if (sourceShingles.size === 0) return [];

  // 2) Tokenisasi segmen dengan offset char asli.
  const tokens = [];
  const re = /[^\s]+/g;
  let m;
  while ((m = re.exec(srcText)) !== null) {
    tokens.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  }
  if (tokens.length < 2) return [];

  // Normalisasi per token = perilaku tokenize (lowercase, buang non-alnum)
  // agar shingle segmen & sumber identik; token simbol-murni tidak dihitung.
  const norm = tokens.map((t) => t.text.toLowerCase().replace(/[^a-z0-9]/g, ''));

  // 3) Tandai token anggota shingle 3-kata yang ada di set sumber.
  const n = SHINGLE_SIZE;
  const marked = new Array(tokens.length).fill(false);
  for (let i = 0; i + n <= tokens.length; i += 1) {
    if (!norm[i] || !norm[i + 1] || !norm[i + 2]) continue; // ada token simbol → lewati shingle
    if (sourceShingles.has(norm.slice(i, i + n).join(' '))) {
      marked[i] = marked[i + 1] = marked[i + 2] = true;
    }
  }

  // 4) Gabung token bertanda berurutan → run.
  const runs = [];
  let cur = null;
  for (let i = 0; i < tokens.length; i += 1) {
    if (marked[i]) {
      if (!cur) cur = { start: tokens[i].start, end: tokens[i].end, text: tokens[i].text, count: 1 };
      else {
        cur.end = tokens[i].end;
        cur.text += ` ${tokens[i].text}`;
        cur.count += 1;
      }
    } else if (cur) {
      runs.push(cur);
      cur = null;
    }
  }
  if (cur) runs.push(cur);

  // 5) Filter run ≥ 2 kata → urut terpanjang dulu → batas 20 → trim tanda baca tepi.
  return runs
    .filter((r) => r.count >= MIN_PHRASE_WORDS)
    .sort((a, b) => b.count - a.count || a.start - b.start)
    .slice(0, MAX_MATCHED_PHRASES)
    .map(trimPhrase)
    .filter((p) => p.text.length > 0)
    .map((p) => ({ text: p.text, start: p.start, end: p.end }));
}

// ============================================================================
// 5. Query SerpApi per segmen (gl/hl dari env; hanya title/link/snippet dipakai)
// ============================================================================

async function querySerpApi(query) {
  const url = 'https://serpapi.com/search.json';
  const params = {
    engine: 'google',
    q: query,
    gl: env.SERPAPI_GL || 'id',
    hl: env.SERPAPI_HL || 'id',
    api_key: env.SERPAPI_API_KEY,
    num: String(TOP_RESULTS_PER_QUERY),
  };
  const { data } = await axios.get(url, { params, timeout: SERPAPI_TIMEOUT_MS });
  const organic = Array.isArray(data.organic_results) ? data.organic_results : [];
  return organic
    .filter((r) => r && r.link)
    .slice(0, TOP_RESULTS_PER_QUERY)
    .map((r) => ({
      url: r.link,
      title: r.title || '',
      snippet: r.snippet || '',
    }));
}

// ============================================================================
// 6–8. Pipeline utama per dokumen
// ============================================================================

/**
 * Agregasi skor & sumber dari daftar segmen yang SUDAH diproses (helper MURNI —
 * dipakai batch tunggal di processSegments maupun GABUNGAN dua batch di scan penuh).
 * - overallScore: rata-rata TERTIMBANG panjang segmen (segmen panjang lebih
 *   berpengaruh), dibulatkan 0-100. Saat scan penuh, hitung dari GABUNGAN semua
 *   segmen (bobot panjang), BUKAN rata-rata skor antar batch.
 * - sources: dedup global by url dari matchedSources tiap segmen, urut by
 *   matchScore terbaik (matchScore terbaik = maksimum di seluruh segmen).
 */
function aggregateResults(processedList) {
  const processed = Array.isArray(processedList) ? processedList : [];
  const map = new Map(); // url -> {url,title,snippet}

  const bestMatchScore = (source) => {
    let best = 0;
    for (const seg of processed) {
      for (const m of seg.matchedSources) {
        if (m.url === source.url && m.matchScore > best) best = m.matchScore;
      }
    }
    return best;
  };

  for (const seg of processed) {
    for (const m of seg.matchedSources) {
      if (!map.has(m.url)) map.set(m.url, { url: m.url, title: m.title, snippet: m.snippet });
    }
  }
  const sources = [...map.values()].sort((a, b) => bestMatchScore(b) - bestMatchScore(a));

  const totalLen = processed.reduce((acc, s) => acc + s.textSnippet.length, 0);
  let weighted = 0;
  for (const s of processed) {
    const w = totalLen === 0 ? 1 / processed.length : s.textSnippet.length / totalLen;
    weighted += s.score * w;
  }
  const overallScore = processed.length === 0 ? 0 : Math.round(weighted * 100);

  return { sources, overallScore };
}

/**
 * Jalankan `fn` untuk tiap item dengan batas konkurensi (bounded parallel).
 * Hasil ditempel via indeks → URUTAN HASIL = URUTAN INPUT (kontrak
 * `processSegments` & respons tidak berubah walau query berjalan paralel).
 * Batas 3 dipilih: cukup memotong latensi scan penuh secara signifikan,
 * masih aman untuk kuota SerpApi dev (hitungan kuota TIDAK berubah).
 */
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next;
      next += 1;
      results[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

async function processSegments(segments) {
  const processed = await mapWithConcurrency(segments, SERPAPI_CONCURRENCY, async (segText) => {
    let results = [];
    try {
      results = await querySerpApi(segText.slice(0, 300)); // query dipotong (maks judul pencarian)
    } catch (err) {
      logger.warn({ err }, '[similarity] SerpApi query gagal untuk satu segmen — lanjut');
      results = [];
    }

    const matchedSources = [];
    for (const r of results) {
      const matchScore = scoreSegmentVsSnippet(segText, r.snippet);
      if (matchScore >= MATCH_THRESHOLD) {
        matchedSources.push({ ...r, matchScore });
      }
    }
    matchedSources.sort((a, b) => b.matchScore - a.matchScore);
    const topMatch = matchedSources[0]?.matchScore || 0;

    return {
      // Teks ASLI segmen USER (dokumen milik user — boleh disimpan penuh; cap 1200
      // char utk ukuran respons). ETIKA: teks SUMBER tetap hanya textSnippet singkat.
      text: segText.length > SEGMENT_TEXT_MAX_CHARS ? `${segText.slice(0, SEGMENT_TEXT_MAX_CHARS).trimEnd()}…` : segText,
      textSnippet: segText.length > SNIPPET_MAX_CHARS ? `${segText.slice(0, SNIPPET_MAX_CHARS).trimEnd()}…` : segText,
      score: topMatch, // 0–1
      matchedSources: matchedSources.slice(0, 3),
      // Frasa terindikasi, dihitung HANYA dari snippet sumber yang lolos threshold
      // (sumber dengan snippet pendek/kosong → array kosong → frontend fallback).
      matchedPhrases: computeMatchedPhrases(segText, matchedSources.map((ms) => ms.snippet)),
    };
  });

  return { processed, ...aggregateResults(processed) };
}

/**
 * Jalankan pemeriksaan penuh untuk satu PlagiarismCheck (async, background).
 * SCAN ADAPTIF 2-TAHAP (keputusan user, ambang ESCALATE_ON_LOW_SCORE_PCT=18):
 * 1. tahap-1: query SAMPEL (maks MAX_SAMPLE_SEGMENTS=10, tersebar merata).
 * 2. skor tahap-1 > 18% → plagiasi SUDAH TERBUKTI → STOP (hemat kuota SerpApi).
 *    skor tahap-1 ≤ 18% → terlihat orisinal → tahap-2: scan SEMUA segmen sisa
 *    (verifikasi negatif, maks MAX_SEGMENTS=60) → skor dari GABUNGAN semua segmen.
 * 3. Dokumen ≤ 10 segmen → sampling = semua → otomatis scan penuh.
 * Download file dari Cloudinary → ekstrak → segmen → sampling → SerpApi → skor → simpan.
 */
async function runCheck(checkId) {
  const check = await PlagiarismCheck.findById(checkId);
  if (!check) return;
  if (check.status !== 'processing') {
    logger.warn({ checkId }, '[similarity] runCheck dipanggil utk status non-processing — skip (idempoten)');
    return;
  }

  try {
    // Download file asli (Cloudinary). Axios timeout 30s.
    const resp = await axios.get(check.uploadedFileUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
      maxContentLength: 20 * 1024 * 1024,
    });
    const buffer = Buffer.from(resp.data);

    const text = await extractText(buffer, check.fileType);
    if (!text.trim()) throw new Error('Tidak ada teks yang bisa diekstrak dari dokumen');

    const allSegments = splitSegments(text);
    if (allSegments.length === 0) throw new Error('Dokumen terlalu pendek untuk diperiksa');

    const sampled = sampleSegments(allSegments);
    const sampledIdx = new Set(sampleIndexes(allSegments.length)); // posisi segmen tahap-1 (utk remaining)

    // TRANSPARANSI SAMPLING: simpan metrik SEBELUM query dimulai supaya frontend yang
    // polling saat status 'processing' sudah bisa menampilkan "memindai X/Y segmen".
    // totalSegments ≤ MAX_SEGMENTS (splitSegments sudah cap 60) & scannedSegments ≤
    // MAX_SAMPLE_SEGMENTS pada tahap-1; totalSegments === scannedSegments → scan penuh.
    check.totalSegments = allSegments.length;
    check.scannedSegments = sampled.length;
    await check.save();

    logger.info({ checkId, totalSegments: allSegments.length, scanned: sampled.length }, '[similarity] tahap-1: query sampel dimulai');

    // ---- TAHAP 1: sampling (maks 10) — cek cepat ----
    const { processed: p1, sources: s1, overallScore: score1 } = await processSegments(sampled);

    // ---- Keputusan scan adaptif ----
    let processed = p1;
    let sources = s1;
    const allScanned = sampled.length === allSegments.length; // dokumen ≤ 10 segmen → otomatis scan penuh
    if (allScanned) {
      check.scanMode = 'full'; // sampling = SEMUA segmen
      logger.info({ checkId, totalSegments: allSegments.length }, '[similarity] dokumen ≤ jumlah sampel — scan penuh');
    } else if (score1 <= ESCALATE_ON_LOW_SCORE_PCT) {
      // Skor rendah → terlihat orisinal → VERIFIKASI dengan scan SEMUA segmen sisa,
      // agar hasil "orisinal" tidak meleset karena sampling.
      // Filter by INDEKS (bukan string equality) supaya segmen duplikat teks yang
      // belum di-query tetap ikut di-scan.
      const remaining = allSegments.filter((_, i) => !sampledIdx.has(i));
      logger.info({ checkId, remaining: remaining.length, score: score1 }, '[similarity] tahap-2: lanjut scan penuh (verifikasi negatif)');
      const { processed: p2 } = await processSegments(remaining);
      processed = [...p1, ...p2];
      // Skor & sumber dihitung dari GABUNGAN semua segmen (bobot panjang, bukan rata-rata batch).
      ({ sources } = aggregateResults(processed));
      check.scannedSegments = allSegments.length;
      check.scanMode = 'full';
      logger.info({ checkId, totalSegments: allSegments.length }, '[similarity] tahap-2 selesai — scan penuh');
    } else {
      check.scanMode = 'sample';
      logger.info({ checkId, score: score1 }, '[similarity] tahap-1 skor tinggi — stop (scan sampel)');
    }

    const { overallScore } = aggregateResults(processed);
    check.overallScore = overallScore;
    check.segments = processed;
    check.sources = sources;
    check.status = 'completed';
    check.errorMessage = null;
    await check.save();
    logger.info({ checkId, overallScore, sources: sources.length, scanMode: check.scanMode }, '[similarity] selesai (completed)');

    // ---- LOCAL CORPUS CHECKER (best-effort, TERPISAH dari sumber web) ----
    // Urutan (keputusan user):
    // 1) findLocalMatches dihitung terhadap corpus SEBELUM dokumen ini masuk
    //    (dokumen ini tidak membandingkan dirinya; userId berbeda wajib).
    // 2) Hasil lokal ditempel per segmen + check.localSources → save.
    // 3) Dokumen ini masuk corpus SETELAH selesai (saveFingerprints) supaya bisa
    //    dibandingkan oleh dokumen berikutnya.
    // PRIVASI: corpus hanya menyimpan HASH + metadata; teks mentah dokumen lain
    // tidak pernah disimpan/diambil/ditampilkan — hanya nama file + skor.
    if (processed.length > 0) {
      try {
        const { localMatchesByIndex, localSources } = await findLocalMatches(processed, {
          userId: check.userId,
          checkId: check._id,
        });
        for (let i = 0; i < processed.length; i += 1) {
          const lm = localMatchesByIndex[i] || [];
          processed[i].localMatches = lm;
          processed[i].localScore = lm.length > 0 ? lm[0].score : 0; // sudah urut score turun → max
        }
        check.localSources = localSources;
        await check.save(); // simpan hasil lokal (status tetap completed)
        await saveFingerprints({
          checkId: check._id,
          userId: check.userId,
          originalFilename: check.originalFilename,
          segments: processed,
        });
      } catch (err) {
        // Fitur lokal best-effort: kegagalan TIDAK menggagalkan check (web sudah selesai).
        logger.warn({ err, checkId }, '[similarity] local corpus check gagal — dilewati (best-effort)');
      }
    }
  } catch (err) {
    logger.error({ err, checkId }, '[similarity] pemeriksaan gagal');
    check.status = 'failed';
    check.errorMessage = err.message || 'Proses pemeriksaan gagal — coba upload ulang';
    await check.save();
  }
}

/** Jalankan di background tanpa memblokir request (fire-and-forget + error guard). */
function enqueueCheck(checkId) {
  setImmediate(() => {
    runCheck(checkId).catch((err) => {
      logger.error({ err, checkId }, '[similarity] background runCheck crash');
    });
  });
}

/** Recovery job mati: processing > 10 menit dianggap stale → failed. */
async function recoverStaleJobs() {
  const staleBefore = new Date(Date.now() - STALE_JOB_MS);
  const res = await PlagiarismCheck.updateMany(
    { status: 'processing', updatedAt: { $lt: staleBefore } },
    { status: 'failed', errorMessage: 'Waktu proses habis — silakan upload ulang' }
  );
  if (res.modifiedCount > 0) {
    logger.warn({ modified: res.modifiedCount }, '[similarity] recovery: job stale ditandai failed');
  }
  return res.modifiedCount;
}

module.exports = {
  extractText,
  splitSegments,
  sampleIndexes,
  sampleSegments,
  scoreSegmentVsSnippet,
  computeMatchedPhrases,
  aggregateResults,
  processSegments,
  querySerpApi,
  runCheck,
  enqueueCheck,
  recoverStaleJobs,
  CONFIG: { MAX_SEGMENTS, MAX_SAMPLE_SEGMENTS, MIN_SEGMENT_CHARS, MATCH_THRESHOLD, ESCALATE_ON_LOW_SCORE_PCT, SEGMENT_TEXT_MAX_CHARS, MAX_MATCHED_PHRASES, SERPAPI_CONCURRENCY },
};
