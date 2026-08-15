/**
 * PlagiarismCheck — satu dokumen = satu kali pemeriksaan. Koleksi: plagiarismChecks
 * Field & index persis 01-database-design.md §3.3.
 * ETIKA: teks SUMBER pihak ketiga hanya disimpan sebagai `snippet`/`textSnippet`
 * (cuplikan singkat). Yang boleh disimpan PENUH adalah teks USER:
 * `segments[].text` = teks asli segmen milik user (cap 1200 char di service).
 */
const mongoose = require('mongoose');

const matchedSourceSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    title: { type: String, default: '' },
    snippet: { type: String, default: '' }, // cuplikan SINGKAT dari hasil pencarian
    matchScore: { type: Number, default: 0 }, // skor kemiripan segmen vs sumber ini
  },
  { _id: false }
);

const matchedPhraseSchema = new mongoose.Schema(
  {
    text: { type: String, default: '' }, // frasa (run) yang cocok dengan sumber
    start: { type: Number, default: 0 }, // offset char awal pada segments[].text
    end: { type: Number, default: 0 }, // offset char akhir (exclusive) pada segments[].text
  },
  { _id: false }
);

const segmentSchema = new mongoose.Schema(
  {
    text: { type: String, default: '' }, // teks ASLI segmen USER (cap 1200 char di service) — milik user, boleh penuh
    textSnippet: { type: String, required: true }, // cuplikan singkat segmen (kompatibilitas & ringan)
    score: { type: Number, default: 0 }, // 0-1 per segmen
    matchedSources: { type: [matchedSourceSchema], default: [] },
    // Frasa terindikasi plagiasi dengan offset char presisi (utk <mark> di frontend).
    // Field baru (default) → dokumen lama tetap kompatibel tanpa migrasi.
    matchedPhrases: { type: [matchedPhraseSchema], default: [] },
    // Kecocokan LOKAL (corpus internal — dokumen USER LAIN). Terpisah dari web.
    // PRIVASI: hanya nama file + skor; teks dokumen lain tidak pernah ditampilkan.
    localMatches: {
      type: [
        {
          documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'PlagiarismCheck' },
          originalFilename: { type: String, default: '' }, // nama file asli (TANPA isi)
          matchCount: { type: Number, default: 0 }, // jumlah hash berbeda yang cocok
          score: { type: Number, default: 0 }, // 0-1 (matchCount / |hash segmen|)
          _id: false,
        },
      ],
      default: [],
    },
    localScore: { type: Number, default: 0 }, // skor lokal terbaik segmen (0 kalau kosong)
  },
  { _id: false }
);

const sourceSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    title: { type: String, default: '' },
    snippet: { type: String, default: '' },
  },
  { _id: false }
);

const plagiarismCheckSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId wajib'],
      index: true,
    },
    originalFilename: { type: String, required: true, trim: true },
    uploadedFileUrl: { type: String, required: true }, // Cloudinary
    fileType: {
      type: String,
      enum: ['pdf', 'docx', 'doc', 'txt'],
      required: true,
    },
    status: {
      type: String,
      enum: ['processing', 'completed', 'failed'],
      default: 'processing',
    },
    overallScore: { type: Number, default: null, min: 0, max: 100 },
    segments: { type: [segmentSchema], default: [] },
    sources: { type: [sourceSchema], default: [] },
    // Sumber LOKAL (dokumen user lain di sistem) — terpisah dari sumber web.
    localSources: {
      type: [
        {
          documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'PlagiarismCheck' },
          originalFilename: { type: String, default: '' }, // nama file asli (privasi: TANPA isi)
          score: { type: Number, default: 0 }, // 0-1
          _id: false,
        },
      ],
      default: [],
    },
    // Transparansi & mode SCAN ADAPTIF 2-tahap (keputusan user 2026-08-14):
    // null = dokumen lama / tidak diketahui / gagal sebelum sampling.
    // totalSegments === scannedSegments → scan penuh (semua segmen di-query).
    totalSegments: { type: Number, default: null }, // jumlah segmen hasil splitSegments (≤ 60)
    scannedSegments: { type: Number, default: null }, // jumlah segmen yang benar-benar di-query SerpApi
    scanMode: { type: String, enum: ['sample', 'full'], default: null }, // 'full' = scan penuh; 'sample' = hanya sampling
    errorMessage: { type: String, default: null }, // SELALU terisi saat failed (kontrak UI)
    paidStatus: {
      type: String,
      enum: ['unpaid', 'paid'],
      default: 'unpaid',
    },
    paidAt: { type: Date, default: null },
    files: {
      type: {
        previewPdfUrl: { type: String, default: null },
        previewPdfPublicId: { type: String, default: null }, // utk signed URL segar
        finalPdfUrl: { type: String, default: null },
        finalPdfPublicId: { type: String, default: null }, // utk signed URL segar
        _id: false,
      },
      default: () => ({}),
    },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Index sesuai desain
plagiarismCheckSchema.index({ userId: 1, createdAt: -1 });
plagiarismCheckSchema.index({ userId: 1, paidStatus: 1 });
plagiarismCheckSchema.index({ status: 1 }); // worker polling / recovery job mati

plagiarismCheckSchema.methods.isPaid = function isPaid() {
  return this.paidStatus === 'paid';
};

plagiarismCheckSchema.methods.toSafeJSON = function toSafeJSON() {
  return this.toJSON();
};

const PlagiarismCheck = mongoose.model('PlagiarismCheck', plagiarismCheckSchema);
module.exports = { PlagiarismCheck };
