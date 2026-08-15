/**
 * ToolboxUsageLog — telemetri tool gratis. Koleksi: toolboxUsageLogs
 * Field & index persis 01-database-design.md §3.6.
 * userId NULL = anonymous (Toolbox publik). File input/output TIDAK disimpan permanen.
 * toolType: 'image_compressor' DIHAPUS (fitur diganti paraphraser) & 'file_converter'
 * DIHAPUS (fitur converter dihapus atas keputusan user, Aug 2026 — §39). Dokumen
 * lama ber-enum itu TIDAK divalidasi ulang (enum hanya berlaku saat save) — aman.
 */
const mongoose = require('mongoose');

const fileMetaSchema = new mongoose.Schema(
  {
    name: { type: String, default: '' },
    sizeBytes: { type: Number, default: 0 },
    mimeType: { type: String, default: '' },
  },
  { _id: false }
);

const toolboxUsageLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // anonymous diizinkan
      index: true,
    },
    toolType: {
      type: String,
      enum: ['file_compressor', 'paraphraser', 'ai_checker'],
      required: true,
    },
    inputFile: { type: fileMetaSchema, default: () => ({}) },
    outputFile: { type: fileMetaSchema, default: () => ({}) },
    // ai_checker: ringkasan input teks (hanya jumlah karakter — teks TIDAK disimpan)
    inputText: { chars: { type: Number, default: null } },
    // ai_checker: ringkasan output
    output: {
      score: { type: Number, default: null },
      engine: { type: String, default: null },
    },
    status: { type: String, enum: ['success', 'failed'], required: true },
    durationMs: { type: Number, default: null },
    errorMessage: { type: String, default: null },
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

toolboxUsageLogSchema.index({ createdAt: -1 });
toolboxUsageLogSchema.index({ toolType: 1, createdAt: -1 });
toolboxUsageLogSchema.index({ userId: 1, createdAt: -1 });

const ToolboxUsageLog = mongoose.model('ToolboxUsageLog', toolboxUsageLogSchema);
module.exports = { ToolboxUsageLog };
