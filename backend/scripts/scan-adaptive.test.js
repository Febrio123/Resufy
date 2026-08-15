/**
 * Test ad-hoc: SCAN ADAPTIF 2-tahap mesin plagiarism (ambang 18%).
 * Jalankan: node scripts/scan-adaptive.test.js  (tanpa DB nyata / tanpa server)
 *
 * Mock:
 * - PlagiarismCheck di-patch via require.cache (tanpa mongoose/DB).
 * - axios.get: respons download (arraybuffer) = teks dokumen; respons query SerpApi
 *   = organic_results dari `currentResults` (dihitung sebagai queryCalls).
 *
 * Kasus:
 *   A: dokumen 12 segmen, 3 segmen disampel identik dgn snippet → skor tahap-1 ~30% > 18%
 *      → STOP: scanMode 'sample', scanned=10, querySerpApi hanya 10 panggilan.
 *   B: dokumen 12 segmen, tak ada yang cocok → skor 0 ≤ 18% → scanMode 'full',
 *      scanned=12 (= total), querySerpApi 12 panggilan (semua segmen).
 *   C: dokumen 6 segmen (≤ 10) → otomatis scan penuh: scanMode 'full', scanned=6, query=6.
 *   D: dokumen terlalu pendek → failed; totalSegments/scannedSegments/scanMode tetap null.
 */
const assert = require('assert');
const axios = require('axios');

// ---- Patch PlagiarismCheck (mock, tanpa DB) SEBELUM require service ----
let currentCheck = null;
class MockPlagiarismCheck {
  static async findById() {
    return currentCheck;
  }
}
const modelPath = require.resolve('../src/models/plagiarismCheck.model');
require.cache[modelPath] = {
  id: modelPath,
  filename: modelPath,
  loaded: true,
  exports: { PlagiarismCheck: MockPlagiarismCheck },
};

const { runCheck } = require('../src/services/similarityService');

// ---- Mock axios: download (arraybuffer) vs query SerpApi ----
let currentDocText = '';
let currentResults = [];
let queryCalls = 0;
let saveLog = [];
const originalGet = axios.get;
axios.get = (url, config) => {
  if (config && config.responseType === 'arraybuffer') {
    return Promise.resolve({ data: Buffer.from(currentDocText, 'utf8') });
  }
  queryCalls += 1; // query SerpApi (1 per segmen)
  return Promise.resolve({ data: { organic_results: currentResults } });
};

// ---- Kalimat uji (masing-masing > MIN_SEGMENT_CHARS=40) ----
const MATCH_SENTENCE =
  'Sistem informasi manajemen modern mengandalkan basis data terdistribusi untuk mendukung operasional harian perusahaan berskala besar.';
const OTHER_SENTENCES = [
  'Pemeliharaan rutin mesin industri berat memerlukan jadwal berkala serta dokumentasi inspeksi yang lengkap dan dapat diaudit.',
  'Pembelajaran mesin untuk deteksi penipuan transaksi keuangan memanfaatkan data historis yang telah dilabeli secara manual.',
  'Desain antarmuka pengguna yang ergonomis meningkatkan kepuasan pelanggan pada aplikasi perbankan digital modern.',
  'Logistik rantai pasok global menghadapi tantangan ketepatan waktu pengiriman dan manajemen inventaris yang efisien.',
  'Penelitian klinis obat herbal membutuhkan uji toksisitas jangka panjang serta persetujuan komite etik yang ketat.',
  'Otomasi proses robotik membantu departemen akuntansi menyelesaikan rekonsiliasi laporan bulanan secara cepat.',
  'Perencanaan kota berkelanjutan memperhatikan ruang terbuka hijau, transportasi publik, dan drainase lingkungan.',
  'Analisis sentimen ulasan produk di media sosial menjadi masukan strategis bagi tim pengembangan produk digital.',
  'Manajemen risiko proyek konstruksi melibatkan identifikasi bahaya keselamatan kerja dan mitigasi keterlambatan biaya.',
];
const B1 =
  'Strategi pemasaran konten modern menekankan konsistensi narasi merek di berbagai kanal digital yang sedang berkembang pesat.';
const M1 =
  'Pelatihan karyawan berbasis simulasi virtual terbukti meningkatkan produktivitas tim penjualan dalam waktu yang singkat.';
const M2 =
  'Pengelolaan arsip digital membutuhkan kebijakan retensi data yang jelas serta sistem pencadangan berkala yang andal.';

async function runCase(docText) {
  currentCheck = {
    _id: 'mock-check',
    status: 'processing',
    uploadedFileUrl: 'https://mock.example/file.txt',
    fileType: 'txt',
    totalSegments: null,
    scannedSegments: null,
    scanMode: null,
    overallScore: null,
    segments: [],
    sources: [],
    errorMessage: null,
    save: async function save() {
      saveLog.push({
        stage: saveLog.length + 1,
        totalSegments: this.totalSegments,
        scannedSegments: this.scannedSegments,
        scanMode: this.scanMode,
        status: this.status,
      });
    },
  };
  currentDocText = docText;
  saveLog = [];
  const callsBefore = queryCalls;
  await runCheck('mock-check');
  return { calls: queryCalls - callsBefore, check: currentCheck, saveLog: saveLog.slice() };
}

(async () => {
  try {
    currentResults = [
      { link: 'https://sumber.example/artikel', title: 'Artikel Sumber', snippet: MATCH_SENTENCE },
    ];

    // ---- KASUS A: skor tahap-1 > 18% → STOP (scan sampel) ----
    // 12 segmen; sampling ambil idx 0,1,2,4,5,6,7,9,10,11 → 3 segmen identik dgn snippet
    // (idx 0,1,4) → skor tahap-1 ≈ 30% > 18% → berhenti, sisa 2 segmen TIDAK di-query.
    const docA = [MATCH_SENTENCE, MATCH_SENTENCE, ...OTHER_SENTENCES.slice(0, 2), MATCH_SENTENCE, ...OTHER_SENTENCES.slice(2)].join(' ');
    assert.strictEqual(docA.split('. ').length, 12, 'A0: dokumen A berisi 12 segmen');
    const rA = await runCase(docA);
    assert.strictEqual(rA.check.totalSegments, 12, 'A1: totalSegments=12');
    assert.strictEqual(rA.check.scannedSegments, 10, 'A2: scannedSegments=sampel (10)');
    assert.strictEqual(rA.check.scanMode, 'sample', 'A3: skor tinggi → scanMode sample');
    assert.strictEqual(rA.calls, 10, 'A4: hanya 10 query SerpApi (sisa tidak di-query)');
    assert.strictEqual(rA.check.status, 'completed', 'A5: completed');
    assert(rA.check.overallScore > 18, `A6: overallScore akhir > 18 (dapat ${rA.check.overallScore})`);
    assert.strictEqual(rA.saveLog[0].totalSegments, 12, 'A7: metrik disimpan SEBELUM query dimulai (save pertama)');
    assert.strictEqual(rA.saveLog[0].scannedSegments, 10, 'A8: scannedSegments tahap-1 = 10 saat save pertama');
    console.log(`PASS A (scan sampel): score=${rA.check.overallScore}% calls=${rA.calls} scanMode=${rA.check.scanMode}`);

    // ---- KASUS B: skor ≤ 18% → scan PENUH (verifikasi negatif) ----
    // 12 segmen, tak ada cocok → skor 0 → lanjut query 2 segmen sisa → total 12 query.
    const docB = [B1, ...OTHER_SENTENCES, M1, M2].join(' ');
    const rB = await runCase(docB);
    assert.strictEqual(rB.check.totalSegments, 12, 'B1: totalSegments=12');
    assert.strictEqual(rB.check.scannedSegments, 12, 'B2: scannedSegments=total (scan penuh)');
    assert.strictEqual(rB.check.scanMode, 'full', 'B3: scanMode full');
    assert.strictEqual(rB.calls, 12, 'B4: SEMUA segmen di-query (12)');
    assert.strictEqual(rB.check.status, 'completed', 'B5: completed');
    assert.strictEqual(rB.check.overallScore, 0, 'B6: skor akhir 0 (tidak ada cocok)');
    assert.strictEqual(rB.check.segments.length, 12, 'B7: laporan memuat 12 segmen (gabungan p1+p2)');
    console.log('PASS B (scan penuh): score=0% calls=12 scanMode=full');

    // ---- KASUS C: ≤ 10 segmen → otomatis scan penuh ----
    const docC = OTHER_SENTENCES.slice(0, 6).join(' ');
    const rC = await runCase(docC);
    assert.strictEqual(rC.check.totalSegments, 6, 'C1: totalSegments=6');
    assert.strictEqual(rC.check.scannedSegments, 6, 'C2: scanned=total (semua disampel)');
    assert.strictEqual(rC.check.scanMode, 'full', 'C3: scanMode full (otomatis, ≤ jumlah sampel)');
    assert.strictEqual(rC.calls, 6, 'C4: 6 query (semua segmen)');
    assert.strictEqual(rC.check.status, 'completed', 'C5: completed');
    console.log('PASS C (≤10 segmen → scan penuh): calls=6 scanMode=full');

    // ---- KASUS D: gagal sebelum sampling → field null (kompatibilitas) ----
    const rD = await runCase('Pendek sekali.');
    assert.strictEqual(rD.check.status, 'failed', 'D1: failed');
    assert(rD.check.errorMessage, 'D2: errorMessage terisi');
    assert.strictEqual(rD.check.totalSegments, null, 'D3: totalSegments tetap null');
    assert.strictEqual(rD.check.scannedSegments, null, 'D4: scannedSegments tetap null');
    assert.strictEqual(rD.check.scanMode, null, 'D5: scanMode tetap null');
    assert.strictEqual(rD.calls, 0, 'D6: tidak ada query SerpApi');
    console.log('PASS D (gagal sebelum sampling): field null, calls=0');

    console.log('OK — scan-adaptive.test.js: semua asersi A/B/C/D lolos');
  } finally {
    axios.get = originalGet; // restore
  }
})().catch((e) => {
  axios.get = originalGet;
  console.error('FAIL:', e.message);
  process.exit(1);
});
