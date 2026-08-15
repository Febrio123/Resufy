/**
 * Test ad-hoc: computeMatchedPhrases + processSegments (mock SerpApi).
 * Jalankan: node scripts/similarity-phrases.test.js  (tanpa DB — fungsi murni + mock axios)
 * Termasuk E2E ringan: processSegments dengan querySerpApi di-mock → verifikasi
 * segments[].text & segments[].matchedPhrases terisi.
 */
const assert = require('assert');
const axios = require('axios');
const {
  computeMatchedPhrases,
  processSegments,
} = require('../src/services/similarityService');

const segmentText =
  'Saya memiliki pengalaman kerja di bidang pemasaran digital selama lima tahun. ' +
  'Selain itu saya menguasai analisis data untuk pengambilan keputusan bisnis.';
const snippet =
  'Pengalaman kerja di bidang pemasaran digital selama lima tahun sangat dicari perusahaan.';

// ---- Test 1: frasa persis ada di snippet → run ≥2 kata, offset char benar ----
const phrases = computeMatchedPhrases(segmentText, [snippet]);
assert(phrases.length >= 1, `Test 1a: harus ada frasa (dapat ${phrases.length})`);
const expected = 'pengalaman kerja di bidang pemasaran digital selama lima tahun';
const first = phrases[0];
assert.strictEqual(
  segmentText.slice(first.start, first.end).toLowerCase(),
  expected.toLowerCase(),
  `Test 1b: offset slice cocok — "${segmentText.slice(first.start, first.end)}" vs "${first.text}"`
);
for (const p of phrases) {
  assert.strictEqual(segmentText.slice(p.start, p.end), p.text, 'Test 1c: slice===text untuk semua frasa');
  assert(typeof p.start === 'number' && typeof p.end === 'number' && p.start < p.end, 'Test 1d: offset number valid');
}

// ---- Test 2: teks tidak mirip → array kosong ----
const none = computeMatchedPhrases(
  'Hobi saya memasak rendang dan bermain badminton setiap minggu pagi.',
  [snippet]
);
assert.strictEqual(none.length, 0, 'Test 2: teks tak mirip → []');

// ---- Test 3: tanpa snippet / snippet kosong → [] ----
assert.strictEqual(computeMatchedPhrases(segmentText, []).length, 0, 'Test 3a: tanpa snippet → []');
assert.strictEqual(computeMatchedPhrases('', [snippet]).length, 0, 'Test 3b: segmen kosong → []');

// ---- Test 4: run < 2 kata ditolak (kata tunggal tidak jadi frasa) ----
const single = computeMatchedPhrases('pengalaman kerja di tempat lain sangat berbeda sekali ceritanya.', ['pengalaman']);
assert.strictEqual(single.length, 0, 'Test 4: hanya kata tunggal cocok → []');

// ---- Test 5: run tergabung (beberapa kalimat bertanda berurutan → 1 run) ----
const seg2 = 'Pengalaman kerja di bidang pemasaran digital selama lima tahun dan analisis data menggunakan python untuk visualisasi tren penjualan.';
const p2 = computeMatchedPhrases(seg2, [snippet]);
assert(p2.length >= 1, 'Test 5a: ada frasa');
assert(seg2.slice(p2[0].start, p2[0].end).toLowerCase().includes('pengalaman kerja'), 'Test 5b: run mencakup frasa utama');

// ---- Test 6: E2E ringan — processSegments dgn mock SerpApi ----
const originalGet = axios.get;
axios.get = async () => ({
  data: {
    organic_results: [
      {
        link: 'https://sumber1.example/artikel',
        title: 'Artikel Pemasaran Digital',
        snippet: 'Pengalaman kerja di bidang pemasaran digital selama lima tahun sangat dicari perusahaan.',
      },
    ],
  },
});
(async () => {
  try {
    const input = ['Pengalaman kerja di bidang pemasaran digital selama lima tahun menjadi nilai tambah bagi kandidat yang melamar.'];
    const { processed } = await processSegments(input);
    assert.strictEqual(processed.length, 1, 'Test 6a: 1 segmen diproses');
    assert(processed[0].text.includes('Pengalaman kerja'), 'Test 6b: segments[].text (teks USER) tersimpan');
    assert(processed[0].textSnippet, 'Test 6c: textSnippet tetap ada (kompatibilitas)');
    assert(processed[0].matchedSources.length >= 1, 'Test 6d: matchedSources terisi');
    assert(processed[0].matchedPhrases.length >= 1, 'Test 6e: matchedPhrases terisi dari snippet yang lolos threshold');
    const ph = processed[0].matchedPhrases[0];
    assert.strictEqual(
      processed[0].text.slice(ph.start, ph.end),
      ph.text,
      'Test 6f: offset pada .text (bukan textSnippet) konsisten'
    );
    console.log(`OK — similarity-phrases.test.js: semua asersi lolos (unit: ${phrases.length} frasa; e2e-mock: ${processed[0].matchedPhrases.length} frasa)`);
  } finally {
    axios.get = originalGet; // restore
  }
})().catch((e) => {
  axios.get = originalGet;
  console.error('FAIL:', e.message);
  process.exit(1);
});
