/**
 * AI Content Detector — v1 heuristik LOKAL (gratis, tanpa API key).
 *
 * Prinsip (dokumentasi desain):
 * - Model bahasa AI cenderung: (1) panjang kalimat SERAGAM (variansi rendah —
 *   "burstiness" rendah), (2) kosakata repetitif (TTR & hapax rendah),
 *   (3) memakai frasa transisi khas (disamping itu, furthermore, dst),
 *   (4) mengulang pola 3-kata. Skor dibangun dari 4 metrik ini.
 *
 * BUKAN bukti mutlak — hanya indikator statistik. Engine 'local' siap
 * di-upgrade ke OpenAI: tambah deteksi via env OPENAI_API_KEY (BELUM
 * diimplementasikan) lalu set engine 'openai' pada hasil.
 *
 * Murni fungsi, CJS, tanpa dependensi — bisa di-require dari mana saja.
 */

/** Frasa khas penulisan AI — bahasa Indonesia & Inggris (≥ 20). */
const AI_PHRASES = [
  'dengan demikian', 'selain itu', 'selanjutnya', 'secara keseluruhan',
  'menariknya', 'penting untuk dicatat', 'dapat disimpulkan', 'sebagai hasilnya',
  'di sisi lain', 'lebih lanjut', 'tidak dapat dipungkiri', 'sangat penting',
  'berbagai aspek', 'dalam konteks', 'perlu diperhatikan', 'serta',
  'selain daripada', 'pada dasarnya', 'secara umum',
  'in conclusion', 'furthermore', 'moreover', 'additionally',
  'it is important to note', 'in addition', 'overall',
];

const WORD_RE = /[A-Za-zÀ-ÿ0-9']+/g;
const SENTENCE_RE = /[^.!?\n]+[.!?\n]*/g;

const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const round = (n) => Math.round(n);

function stdDev(values) {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {string} text
 * @returns {object} lihat kontrak di README memory: score, label, engine,
 *   textStats, breakdown, note — atau { insufficient: true, words } bila < 100 kata.
 */
function detectAi(text) {
  const raw = String(text || '');
  const words = raw.match(WORD_RE) || [];
  const wordCount = words.length;
  const chars = raw.length;

  if (wordCount < 100) {
    return { insufficient: true, words: wordCount };
  }

  // --- tokenisasi kalimat & statistik dasar ---
  const sentenceMatches = raw.match(SENTENCE_RE) || [];
  const sentenceWordCounts = sentenceMatches
    .map((s) => (s.match(WORD_RE) || []).length)
    .filter((n) => n > 0);
  const sentenceCount = sentenceWordCounts.length;
  const avgWordsPerSentence = sentenceCount
    ? Math.round((wordCount / sentenceCount) * 10) / 10
    : 0;

  // --- 1. Burstiness: stdDev panjang kalimat (kata). AI = seragam → deviasi rendah. ---
  const sentenceStd = stdDev(sentenceWordCounts);
  // Baseline 5 kata: manusia menulis campuran kalimat pendek/panjang
  // (stdDev 4–7+), model AI hampir selalu seragam (stdDev 1–3).
  const baseline = 5;
  const burstiness = clamp(Math.round(((baseline - sentenceStd) / baseline) * 100));

  // --- 2. Vocabulary: type-token ratio + hapax legomena ratio. ---
  const freq = new Map();
  for (const w of words) freq.set(w.toLowerCase(), (freq.get(w.toLowerCase()) || 0) + 1);
  const ttr = freq.size / wordCount;
  let hapax = 0;
  for (const n of freq.values()) if (n === 1) hapax += 1;
  const hapaxRatio = hapax / wordCount;
  // TTR manusia tipikal 0.4–0.7 → skor rendah; AI repetitif TTR < 0.35 → skor tinggi.
  // CATATAN JUJUR: TTR baru diskriminatif di teks panjang; bobot sengaja kecil (0.05).
  const ttrScore = clamp(100 - ttr * 100 * 1.4);
  const hapaxScore = clamp(100 - hapaxRatio * 100 * 1.4);
  const vocabulary = clamp(Math.round(0.5 * ttrScore + 0.5 * hapaxScore));

  // --- 3. Frasa khas AI per 1000 kata (≥ 8/1000 → 100). ---
  const lower = raw.toLowerCase();
  let phraseHits = 0;
  for (const phrase of AI_PHRASES) {
    const re = new RegExp(escapeRegExp(phrase), 'g');
    phraseHits += (lower.match(re) || []).length;
  }
  const perThousand = (phraseHits / wordCount) * 1000;
  const aiPhrases = clamp(Math.round(perThousand * 12.5));

  // --- 4. Repetition: pengulangan 2-gram (window 2 kata) — KEMUNCULAN BERLEBIH ---
  // (sum of count-1 utk bigram yang muncul ≥2) / total bigram. AI mengulang
  // bigram khas ("selain itu", "kecerdasan buatan") berkali-kali; manusia tidak.
  const bi = new Map();
  for (let i = 0; i + 1 < wordCount; i += 1) {
    const key = `${words[i].toLowerCase()} ${words[i + 1].toLowerCase()}`;
    bi.set(key, (bi.get(key) || 0) + 1);
  }
  const totalBigrams = wordCount - 1;
  let extraOccurrences = 0;
  for (const n of bi.values()) if (n >= 2) extraOccurrences += n - 1;
  const repetition = clamp(Math.round((extraOccurrences / Math.max(1, totalBigrams)) * 100));

  // --- skor final (bobot jumlah = 1) ---
  // Burstiness & frasa khas = sinyal terkuat; vocabulary sengaja kecil
  // (lemah utk teks 100–300 kata, lihat catatan di atas).
  const score = round(0.4 * burstiness + 0.05 * vocabulary + 0.4 * aiPhrases + 0.15 * repetition);

  let label;
  if (score <= 24) label = 'Kemungkinan besar ditulis manusia';
  else if (score <= 49) label = 'Sebagian besar ditulis manusia';
  else if (score <= 74) label = 'Campuran — kemungkinan disunting AI';
  else label = 'Kemungkinan besar ditulis AI';

  return {
    score,
    label,
    engine: 'local',
    textStats: {
      words: wordCount,
      sentences: sentenceCount,
      chars,
      avgWordsPerSentence,
    },
    breakdown: { burstiness, vocabulary, aiPhrases, repetition },
    note: 'Deteksi berbasis pola statistik (gratis, tanpa API). Hasil bukan bukti mutlak — bisa meleset untuk teks pendek, teknis, atau yang sengaja disunting. Untuk akurasi lebih tinggi, sediakan OpenAI API key.',
  };
}

module.exports = { detectAi };
