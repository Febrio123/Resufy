/**
 * Test ad-hoc: LOCAL CORPUS CHECKER (Winnowing fingerprinting).
 * Jalankan: node scripts/local-corpus.test.js  (tanpa DB nyata / tanpa server)
 *
 * Mock:
 * - CorpusFingerprint & PlagiarismCheck di-patch via require.cache.
 * - CorpusFingerprint.find mensimulasikan index `hash` ($in filter) & merekam query.
 * - axios.get: download (arraybuffer) vs query SerpApi (dihitung).
 *
 * Cakupan:
 * 1. Unit winnowing: deterministik, identik, beda-jauh (jaccard kecil),
 *    parafrase kecil (jaccard tinggi), teks pendek → [], format hash/position.
 * 2. findLocalMatches (murni, mock corpus): exclude userId sendiri ($ne + filter JS),
 *    minOverlap & minRatio bekerja, top-3 sorting, nama file dari fingerprint,
 *    localSources dedup & max 5.
 * 3. E2E runCheck (mock axios): completed → localSources & localMatches terisi,
 *    fingerprint tersimpan (bulkWrite); failed → fingerprint TIDAK disimpan.
 */
const assert = require('assert');
const axios = require('axios');
const { computeFingerprint, jaccardHash } = require('../src/utils/winnowing');

// ---- Patch model corpus (mock, tanpa DB) SEBELUM require service ----
let corpusDocs = [];
let lastFindQuery = null;
let bulkWriteOps = 0;
class MockCorpusFingerprint {
  static find(query) {
    lastFindQuery = query;
    const inHashes = new Set((query.hash && query.hash.$in) || []);
    return {
      select: () => ({
        lean: async () => corpusDocs.filter((d) => inHashes.has(d.hash)), // simulasi index hash
      }),
    };
  }
  static bulkWrite = async (ops) => {
    bulkWriteOps += ops.length;
    return { insertedCount: ops.length };
  };
  static deleteMany = async () => ({ deletedCount: 0 });
}
const corpusModelPath = require.resolve('../src/models/corpusFingerprint.model');
require.cache[corpusModelPath] = {
  id: corpusModelPath,
  filename: corpusModelPath,
  loaded: true,
  exports: { CorpusFingerprint: MockCorpusFingerprint },
};

// ---- Patch PlagiarismCheck (mock, tanpa DB) ----
const OWN_USER = 'u-own';
const OWN_CHECK = 'c-own-check';
let currentCheck = null;
class MockPlagiarismCheck {
  static async findById() {
    return currentCheck;
  }
}
const checkModelPath = require.resolve('../src/models/plagiarismCheck.model');
require.cache[checkModelPath] = {
  id: checkModelPath,
  filename: checkModelPath,
  loaded: true,
  exports: { PlagiarismCheck: MockPlagiarismCheck },
};

const { findLocalMatches } = require('../src/services/corpusService');
const { runCheck } = require('../src/services/similarityService');

// ---- Mock axios: download (arraybuffer) vs query SerpApi ----
let currentDocText = '';
let currentResults = [];
let queryCalls = 0;
const originalGet = axios.get;
axios.get = (url, config) => {
  if (config && config.responseType === 'arraybuffer') {
    return Promise.resolve({ data: Buffer.from(currentDocText, 'utf8') });
  }
  queryCalls += 1; // query SerpApi (1 per segmen)
  return Promise.resolve({ data: { organic_results: currentResults } });
};

async function runCase(docText) {
  currentCheck = {
    _id: OWN_CHECK,
    userId: OWN_USER,
    status: 'processing',
    originalFilename: 'skripsi-saya.pdf',
    uploadedFileUrl: 'https://mock.example/file.txt',
    fileType: 'txt',
    totalSegments: null,
    scannedSegments: null,
    scanMode: null,
    overallScore: null,
    segments: [],
    sources: [],
    localSources: [],
    errorMessage: null,
    save: async function save() {
      /* no-op: check object dimutasi langsung */
    },
  };
  currentDocText = docText;
  const callsBefore = queryCalls;
  await runCheck(OWN_CHECK);
  return { calls: queryCalls - callsBefore, check: currentCheck };
}

// ---- Kalimat uji ----
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
const SEG =
  'Sistem analisis sentimen ulasan produk digital di media sosial menjadi masukan strategis bagi tim pengembangan produk dan analisis risiko penipuan transaksi keuangan secara otomatis menggunakan model bahasa besar.';

(async () => {
  try {
    // ================= 1. UNIT WINNOWING =================
    const fp1a = computeFingerprint(MATCH_SENTENCE);
    const fp1b = computeFingerprint(MATCH_SENTENCE);
    assert.deepStrictEqual(fp1a, fp1b, 'W1: deterministik (2x panggil sama)');
    assert(fp1a.length > 0, 'W2: teks cukup panjang → fingerprint tidak kosong');
    for (const f of fp1a) {
      assert(/^[0-9a-f]{8}$/.test(f.hash), 'W3: hash hex 8 digit');
      assert(Number.isInteger(f.position) && f.position >= 0, 'W4: position integer ≥ 0');
    }
    const fp2 = computeFingerprint(OTHER_SENTENCES[0]);
    assert(jaccardHash(fp1a, fp2) < 0.05, `W5: teks beda jauh → jaccard kecil (dapat ${jaccardHash(fp1a, fp2)})`);
    const fpParaphrase = computeFingerprint(MATCH_SENTENCE.replace('mengandalkan', 'memakai'));
    assert(jaccardHash(fp1a, fpParaphrase) > 0.4, `W6: parafrase 1 kata → jaccard tinggi (dapat ${jaccardHash(fp1a, fpParaphrase)})`);
    assert.deepStrictEqual(computeFingerprint('Teks pendek sekali.'), [], 'W7: token < k → []');
    console.log(`PASS W (winnowing): ${fp1a.length} hash utk MATCH_SENTENCE; jaccard beda=${jaccardHash(fp1a, fp2).toFixed(3)}, parafrase=${jaccardHash(fp1a, fpParaphrase).toFixed(3)}`);

    // ================= 2. findLocalMatches (mock corpus) =================
    const fp = computeFingerprint(SEG);
    const segHashCount = new Set(fp.map((f) => f.hash)).size;
    const OTHER = 'u-other';
    const docA = fp.map((f) => ({ checkId: 'c-A', userId: OTHER, originalFilename: 'makalah-A.pdf', hash: f.hash }));
    const docB = fp.slice(0, 1).map((f) => ({ checkId: 'c-B', userId: OTHER, originalFilename: 'makalah-B.pdf', hash: f.hash }));
    const docC = fp.map((f) => ({ checkId: 'c-C', userId: OWN_USER, originalFilename: 'makalah-C.pdf', hash: f.hash }));
    const docD = fp.slice(0, 4).map((f) => ({ checkId: 'c-D', userId: OTHER, originalFilename: 'makalah-D.pdf', hash: f.hash }));
    const docE = fp.slice(0, 3).map((f) => ({ checkId: 'c-E', userId: OTHER, originalFilename: 'makalah-E.pdf', hash: f.hash }));
    const docF = fp.slice(0, 2).map((f) => ({ checkId: 'c-F', userId: OTHER, originalFilename: 'makalah-F.pdf', hash: f.hash }));
    corpusDocs = [...docA, ...docB, ...docC, ...docD, ...docE, ...docF];

    // Panggilan 1: minRatio 0.4 → E (0.375) & F (0.25) gugur minRatio; A (1.0) & D (0.5) match.
    const { localMatchesByIndex: m1, localSources: s1 } = await findLocalMatches([{ text: SEG }], {
      userId: OWN_USER,
      checkId: OWN_CHECK,
      minOverlap: 2,
      minRatio: 0.4,
    });
    const matches1 = m1[0];
    assert.strictEqual(matches1.length, 2, 'L1a: minRatio 0.4 → hanya A & D');
    assert.strictEqual(matches1[0].originalFilename, 'makalah-A.pdf', 'L1b: top = A');
    assert.strictEqual(matches1[1].originalFilename, 'makalah-D.pdf', 'L1c: kedua = D');
    assert(!matches1.some((x) => /makalah-(B|C|E|F)/.test(x.originalFilename)), 'L1d: E/F gugur minRatio, B gugur minOverlap, C userId sendiri');

    // Panggilan 2: minOverlap 3 → F (matchCount 2) gugur minOverlap walau ratio 0.25 ≥ minRatio 0.1.
    const { localMatchesByIndex: m2, localSources: s2 } = await findLocalMatches([{ text: SEG }], {
      userId: OWN_USER,
      checkId: OWN_CHECK,
      minOverlap: 3,
      minRatio: 0.1,
    });
    const matches2 = m2[0];
    assert.strictEqual(matches2.length, 3, 'L2a: minOverlap 3 → A, D, E');
    assert.strictEqual(matches2[0].originalFilename, 'makalah-A.pdf', 'L2b: urut score turun');
    assert.strictEqual(matches2[1].originalFilename, 'makalah-D.pdf', 'L2c: D kedua');
    assert.strictEqual(matches2[2].originalFilename, 'makalah-E.pdf', 'L2d: E ketiga');
    assert(!matches2.some((x) => /makalah-(B|C|F)/.test(x.originalFilename)), 'L2e: F gugur minOverlap; B gugur; C own');
    assert.strictEqual(matches2[0].matchCount, segHashCount, 'L2f: matchCount A = semua hash unik');
    assert.strictEqual(matches2[1].matchCount, 4, 'L2g: matchCount D = 4');
    assert.strictEqual(matches2[2].matchCount, 3, 'L2h: matchCount E = 3');

    assert.strictEqual(lastFindQuery.userId.$ne, OWN_USER, 'L3: query exclude userId sendiri ($ne)');
    assert.strictEqual(lastFindQuery.checkId.$ne, OWN_CHECK, 'L4: query exclude checkId sendiri');
    assert(Array.isArray(lastFindQuery.hash.$in) && lastFindQuery.hash.$in.length > 0, 'L5: query pakai $in hash');
    assert.strictEqual(s1.length, 2, 'L6: localSources (minRatio 0.4) = 2 (A, D)');
    assert.strictEqual(s1[0].originalFilename, 'makalah-A.pdf', 'L7: localSources urut score turun');
    assert.strictEqual(s1[0].score, 1, 'L8: skor localSources');
    assert.strictEqual(s2.length, 3, 'L9: localSources (minOverlap 3) = 3 (A, D, E)');
    console.log('PASS L (findLocalMatches): minRatio & minOverlap tervalidasi (2 panggilan); $ne + $in + top-3 + nama file ok');

    // ================= 3. E2E runCheck =================
    // Dokumen 12 segmen, 3 identik MATCH_SENTENCE → web score1 33% (scan sampel).
    // Corpus berisi fingerprint MATCH_SENTENCE milik user LAIN.
    const docA_12 = [MATCH_SENTENCE, MATCH_SENTENCE, ...OTHER_SENTENCES.slice(0, 2), MATCH_SENTENCE, ...OTHER_SENTENCES.slice(2)].join(' ');
    const fpSent = computeFingerprint(MATCH_SENTENCE);
    corpusDocs = fpSent.map((f) => ({
      checkId: 'c-other-check',
      userId: OTHER,
      originalFilename: 'makalah-siswa-lain.pdf',
      hash: f.hash,
    }));
    currentResults = [
      { link: 'https://sumber.example/artikel', title: 'Artikel Sumber', snippet: MATCH_SENTENCE },
    ];
    bulkWriteOps = 0;
    const rE = await runCase(docA_12);
    assert.strictEqual(rE.check.status, 'completed', 'E1: completed');
    assert.strictEqual(rE.check.scanMode, 'sample', 'E2: web scanMode sample (score1 33 > 18)');
    assert.strictEqual(rE.check.localSources.length, 1, 'E3: localSources terisi (1 dokumen corpus)');
    assert.strictEqual(rE.check.localSources[0].originalFilename, 'makalah-siswa-lain.pdf', 'E4: nama file dari corpus');
    assert.strictEqual(rE.check.localSources[0].score, 1, 'E5: skor lokal 1.0');
    const segMatch = rE.check.segments.find((s) => s.localMatches.length > 0);
    assert(segMatch, 'E6: ada segmen dengan localMatches');
    assert.strictEqual(segMatch.localScore, 1, 'E7: localScore = skor terbaik');
    assert.strictEqual(segMatch.localMatches[0].matchCount, new Set(fpSent.map((f) => f.hash)).size, 'E8: matchCount = jumlah hash unik');
    assert.strictEqual(lastFindQuery.userId.$ne, OWN_USER, 'E9: runCheck query exclude user sendiri');
    assert.strictEqual(lastFindQuery.checkId.$ne, OWN_CHECK, 'E10: runCheck query exclude check sendiri');
    assert(bulkWriteOps > 0, 'E11: fingerprint dokumen tersimpan (bulkWrite dipanggil)');
    console.log(`PASS E (E2E runCheck): localSources=1, bulkWriteOps=${bulkWriteOps}, queryCalls=${rE.calls}`);

    // Failed → fingerprint TIDAK disimpan (guard di akhir sukses saja)
    const opsBefore = bulkWriteOps;
    const rF = await runCase('Pendek sekali.');
    assert.strictEqual(rF.check.status, 'failed', 'F1: failed');
    assert.strictEqual(rF.check.localSources.length, 0, 'F2: localSources default []');
    assert.strictEqual(bulkWriteOps, opsBefore, 'F3: failed → fingerprint TIDAK disimpan');
    console.log('PASS F (failed → tanpa fingerprint): bulkWriteOps tidak bertambah');

    console.log('OK — local-corpus.test.js: semua asersi W/L/E/F lolos');
  } finally {
    axios.get = originalGet; // restore
  }
})().catch((e) => {
  axios.get = originalGet;
  console.error('FAIL:', e.message);
  process.exit(1);
});
