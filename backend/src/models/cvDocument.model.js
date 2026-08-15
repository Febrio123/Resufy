/**
 * CvDocument — satu dokumen = satu versi CV. Koleksi: cvDocuments
 * Field & index persis 01-database-design.md §3.2.
 * content (CvContent) di-EMBED penuh; templateId = config backend (bukan koleksi).
 */
const mongoose = require('mongoose');

const cvContentSchema = new mongoose.Schema(
  {
    personalInfo: {
      fullName: { type: String, default: '' },
      email: { type: String, default: '' },
      phone: { type: String, default: '' },
      location: { type: String, default: '' },
      website: { type: String, default: '' },
      linkedinUrl: { type: String, default: '' },
    },
    profileSummary: { type: String, default: '' },
    workExperiences: [
      {
        jobTitle: { type: String, default: '' },
        company: { type: String, default: '' },
        location: { type: String, default: '' },
        startDate: { type: String, default: '' }, // format bebas string (divalidasi ATS: YYYY/YYYY-MM)
        endDate: { type: String, default: '' },
        isCurrent: { type: Boolean, default: false },
        description: { type: String, default: '' },
      },
    ],
    educations: [
      {
        degree: { type: String, default: '' },
        institution: { type: String, default: '' },
        location: { type: String, default: '' },
        startDate: { type: String, default: '' },
        endDate: { type: String, default: '' },
        gpa: { type: String, default: '' },
      },
    ],
    skills: { type: [String], default: [] }, // flat list — paling ATS-friendly
    certifications: [
      {
        name: { type: String, default: '' },
        issuer: { type: String, default: '' },
        date: { type: String, default: '' },
        url: { type: String, default: '' },
      },
    ],
    projects: [
      {
        name: { type: String, default: '' },
        description: { type: String, default: '' },
        url: { type: String, default: '' },
        techStack: { type: [String], default: [] },
      },
    ],
    languages: [
      {
        name: { type: String, default: '' },
        proficiency: { type: String, default: '' },
      },
    ],
  },
  { _id: false }
);

const cvDocumentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId wajib'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Judul CV wajib diisi'],
      trim: true,
      maxlength: [120, 'Judul maksimal 120 karakter'],
    },
    templateId: {
      type: String,
      required: [true, 'templateId wajib'],
      default: 'ats-single-column', // config backend (hardcode), bukan koleksi
    },
    content: {
      type: cvContentSchema,
      default: () => ({}),
    },
    atsScore: { type: Number, default: null, min: 0, max: 100 },
    atsFeedback: {
      type: [
        {
          severity: { type: String, enum: ['error', 'warning', 'info'], required: true },
          message: { type: String, required: true },
          section: { type: String, default: '' },
          _id: false,
        },
      ],
      default: [],
    },
    atsKeywordMatch: {
      type: {
        jobDescriptionHash: { type: String, default: '' },
        score: { type: Number, default: null },
        matchedKeywords: { type: [String], default: [] },
        missingKeywords: { type: [String], default: [] },
        _id: false,
      },
      default: null,
    },
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
        docxUrl: { type: String, default: null }, // opsional (prioritas kedua)
        _id: false,
      },
      default: () => ({}),
    },
    deletedAt: { type: Date, default: null }, // soft delete (audit payment/file)
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

// Index sesuai desain: dashboard riwayat, filter paid, exclude soft-deleted
cvDocumentSchema.index({ userId: 1, createdAt: -1 });
cvDocumentSchema.index({ userId: 1, paidStatus: 1 });
cvDocumentSchema.index({ userId: 1, deletedAt: 1 });

cvDocumentSchema.methods.isPaid = function isPaid() {
  return this.paidStatus === 'paid';
};

cvDocumentSchema.methods.toSafeJSON = function toSafeJSON() {
  return this.toJSON();
};

const CvDocument = mongoose.model('CvDocument', cvDocumentSchema);
module.exports = { CvDocument, cvContentSchema };
