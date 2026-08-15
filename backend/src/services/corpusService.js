/**
 * CORPUS SERVICE — Local Corpus Checker (Winnowing fingerprinting).
 * Bandingkan segmen dokumen USER terhadap fingerprint dokumen USER LAIN yang
 * sudah 'completed'. TERPISAH dari web checker (sumber web vs sumber internal).
 *
 * PRIVASI: corpus hanya berisi hash + metadata (checkId, userId, nama file,
 * posisi, segmentIndex). Tidak ada teks mentah yang disimpan/diambil/ditampilkan.
 * Dokumen dengan userId SAMA selalu di-exclude (tidak membandingkan diri sendiri).
 */
const { CorpusFingerprint } = require('../models/corpusFingerprint.model');
const { computeFingerprint } = require('../utils/winnowing');
const { logger } = require('../config/logger');

const CHUNK_SIZE = 500; // batch insert per bulkWrite
const DEFAULT_MIN_OVERLAP = 2; // minimal jumlah hash BERBEDA yang cocok
const DEFAULT_MIN_RATIO = 0.1; // matchCount / |hash segmen| minimal
const TOP_MATCHES_PER_SEGMENT = 3; // top dokumen per segmen
const TOP_SOURCES = 5; // top dokumen di level check

/**
 * Simpan fingerprint tiap segmen dokumen ke corpus (bulkWrite chunk ~500).
 * Dipanggil SETELAH check selesai → dokumen ini bisa dibandingkan oleh dokumen
 * lain berikutnya. Best-effort: error chunk → warn & lanjut.
 * @returns {Promise<number>} jumlah hash yang tersimpan
 */
async function saveFingerprints({ checkId, userId, originalFilename, segments }) {
  let total = 0;
  for (let si = 0; si < (segments || []).length; si += 1) {
    const seg = segments[si];
    if (!seg || !seg.text) continue;
    const fps = computeFingerprint(seg.text);
    if (fps.length === 0) continue;

    const docs = fps.map((fp) => ({
      insertOne: {
        document: {
          checkId,
          userId,
          originalFilename: originalFilename || '',
          hash: fp.hash,
          position: fp.position,
          segmentIndex: si,
        },
      },
    }));

    for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
      const chunk = docs.slice(i, i + CHUNK_SIZE);
      try {
        const res = await CorpusFingerprint.bulkWrite(chunk);
        total += (res && res.insertedCount) || chunk.length;
      } catch (err) {
        logger.warn({ err, checkId }, '[corpus] bulkWrite fingerprint gagal (chunk dilewati)');
      }
    }
  }
  return total;
}

/**
 * Cari kecocokan segmen terhadap corpus dokumen LAIN.
 * @param {Array} segments — segmen TERPROSES (dari processSegments; pakai .text)
 * @param {{userId: string, checkId: string, minOverlap?: number, minRatio?: number}} opts
 * @returns {Promise<{localMatchesByIndex: Array, localSources: Array}>}
 *   - localMatchesByIndex: paralel ke `segments`; tiap elemen = top 3
 *     `{ documentId, originalFilename, matchCount, score }` (score = matchCount/|hash segmen|)
 *   - localSources: dedup by checkId, sort score turun, max 5 `{ documentId, originalFilename, score }`
 */
async function findLocalMatches(segments, { userId, checkId, minOverlap = DEFAULT_MIN_OVERLAP, minRatio = DEFAULT_MIN_RATIO }) {
  const localMatchesByIndex = [];
  const sourceMap = new Map(); // checkId -> { documentId, originalFilename, matchCount, score }

  for (const seg of segments) {
    const fps = computeFingerprint(seg.text);
    const hashes = fps.map((f) => f.hash);
    let matches = [];

    if (hashes.length > 0) {
      // Query memakai index `hash`; exclude diri sendiri & dokumen yang sedang
      // diproses (aman walau fingerprint belum di-insert).
      const found = await CorpusFingerprint.find({
        hash: { $in: hashes },
        userId: { $ne: userId },
        checkId: { $ne: checkId },
      })
        .select('checkId userId originalFilename hash')
        .lean();

      // Group by checkId; hitung hash BERBEDA yang cocok (matchCount).
      const byDoc = new Map();
      for (const f of found) {
        if (String(f.userId) === String(userId)) continue; // filter JS (jaga-jaga)
        if (String(f.checkId) === String(checkId)) continue;
        const key = String(f.checkId);
        if (!byDoc.has(key)) {
          byDoc.set(key, { documentId: f.checkId, originalFilename: f.originalFilename, hashSet: new Set() });
        }
        byDoc.get(key).hashSet.add(f.hash);
      }

      const segHashCount = new Set(hashes).size || 1;
      const docMatches = [];
      for (const info of byDoc.values()) {
        const matchCount = info.hashSet.size;
        const ratio = matchCount / segHashCount;
        if (matchCount >= minOverlap && ratio >= minRatio) {
          docMatches.push({ documentId: info.documentId, originalFilename: info.originalFilename, matchCount, score: ratio });
          const existing = sourceMap.get(String(info.documentId));
          if (!existing || matchCount > existing.matchCount) {
            sourceMap.set(String(info.documentId), {
              documentId: info.documentId,
              originalFilename: info.originalFilename,
              matchCount,
              score: ratio,
            });
          }
        }
      }
      docMatches.sort((a, b) => b.score - a.score || String(a.documentId).localeCompare(String(b.documentId)));
      matches = docMatches.slice(0, TOP_MATCHES_PER_SEGMENT);
    }

    localMatchesByIndex.push(matches);
  }

  const localSources = [...sourceMap.values()]
    .sort((a, b) => b.score - a.score || String(a.documentId).localeCompare(String(b.documentId)))
    .slice(0, TOP_SOURCES)
    .map((s) => ({ documentId: s.documentId, originalFilename: s.originalFilename, score: s.score }));

  return { localMatchesByIndex, localSources };
}

/** Hapus semua fingerprint milik sebuah check (retensi/hapus → integritas). */
async function deleteFingerprints(checkId) {
  const res = await CorpusFingerprint.deleteMany({ checkId });
  return res.deletedCount || 0;
}

module.exports = { saveFingerprints, findLocalMatches, deleteFingerprints };
