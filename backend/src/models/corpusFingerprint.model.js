/**
 * CORPUS FINGERPRINT — fingerprint Winnowing dokumen plagiarism yang sudah
 * selesai ('completed'). Basis "Local Corpus Checker": deteksi plagiasi antar
 * dokumen USER LAIN di sistem (mirip MOSS/Turnitin), terpisah dari web checker.
 *
 * PRIVASI (keputusan user): HANYA hash + metadata yang disimpan. Teks mentah
 * dokumen lain TIDAK PERNAH disimpan/diambil/ditampilkan. Yang ditampilkan ke
 * user hanya: `originalFilename` (nama file asli) + skor.
 *
 * STRATEGI PENCARIAN: `hash` memakai INDEX BIASA → query
 * `{ hash: { $in: [..] } }` memakai index untuk menemukan kandidat sangat cepat
 * (persis argumen arsitektur: "Fingerprint hash bisa di-index di database biasa").
 */
const mongoose = require('mongoose');

const corpusFingerprintSchema = new mongoose.Schema(
  {
    checkId: { type: mongoose.Schema.Types.ObjectId, ref: 'PlagiarismCheck', index: true }, // dokumen sumber corpus
    userId: { type: mongoose.Schema.Types.ObjectId, index: true }, // pemilik dokumen
    originalFilename: { type: String, default: '' }, // nama file asli (utk laporan; TANPA isi)
    hash: { type: String, index: true }, // kunci pencarian cepat (index biasa)
    position: { type: Number, default: 0 }, // posisi kata awal k-gram dalam segmen asal
    segmentIndex: { type: Number, default: 0 }, // indeks segmen asal (pemetaan balik)
  },
  { timestamps: true }
);

// Index komposit opsional: ambil fingerprint per dokumen/sumber + hapus cepat per check
corpusFingerprintSchema.index({ checkId: 1, segmentIndex: 1 });

// OPTIMASI FASE 08: index komposit untuk query HOT findLocalMatches
// `{ hash: {$in:[..]}, userId: {$ne:..}, checkId: {$ne:..} }`. `hash` ($in → banyak
// point range) + filter userId/checkId ter-resolve DI INDEX sehingga dokumen milik
// user lain tidak ikut di-load dari disk (corpus tumbuh seiring user).
corpusFingerprintSchema.index({ hash: 1, userId: 1, checkId: 1 });

const CorpusFingerprint = mongoose.model('CorpusFingerprint', corpusFingerprintSchema);
module.exports = { CorpusFingerprint };
