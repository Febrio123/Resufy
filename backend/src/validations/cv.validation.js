/**
 * Zod schemas — CV content. Struktur PERSIS cvContentSchema (01-database-design.md §3.2).
 * Semua field opsional (user boleh menyimpan draft), maxlength konservatif.
 */
const z = require('zod');

const dateStr = z.string().trim().max(20).optional();
const longStr = z.string().max(5000).optional();
const shortStr = z.string().max(500).optional();

const personalInfoSchema = z.object({
  fullName: z.string().trim().max(120).optional(),
  email: z.string().trim().email('Format email tidak valid').max(255).optional().or(z.literal('')),
  phone: shortStr,
  location: shortStr,
  website: shortStr,
  linkedinUrl: shortStr,
});

const workExperienceSchema = z.object({
  jobTitle: shortStr,
  company: shortStr,
  location: shortStr,
  startDate: dateStr,
  endDate: dateStr,
  isCurrent: z.boolean().optional(),
  description: longStr,
});

const educationSchema = z.object({
  degree: shortStr,
  institution: shortStr,
  location: shortStr,
  startDate: dateStr,
  endDate: dateStr,
  gpa: z.string().trim().max(20).optional(),
});

const projectSchema = z.object({
  name: shortStr,
  description: longStr,
  techStack: z.array(z.string().trim().max(100)).max(20).optional(),
  // BUG FIX §33: dulu `link` → zod strip (model strict pakai `url`) → URL
  // proyek TIDAK pernah tersimpan. Selaraskan ke `url` (form frontend +
  // cvDocument.model + draft JSON semuanya pakai `url`).
  url: shortStr,
});

const certificationSchema = z.object({
  name: shortStr,
  issuer: shortStr,
  date: dateStr,
  // BUG FIX §33: dulu `credentialUrl` → zod strip → URL sertifikasi hilang.
  // Selaraskan ke `url` (konsisten dgn model & form frontend).
  url: shortStr,
});

const languageSchema = z.object({
  name: shortStr,
  proficiency: z.string().trim().max(50).optional(),
});

const contentSchema = z.object({
  personalInfo: personalInfoSchema.optional(),
  profileSummary: longStr,
  workExperiences: z.array(workExperienceSchema).max(15).optional(),
  educations: z.array(educationSchema).max(10).optional(),
  skills: z.array(z.string().trim().max(100)).max(50).optional(),
  certifications: z.array(certificationSchema).max(20).optional(),
  projects: z.array(projectSchema).max(20).optional(),
  languages: z.array(languageSchema).max(10).optional(),
});

const createCvSchema = z.object({
  title: z.string().trim().min(1, 'Judul CV wajib diisi').max(120, 'Judul maksimal 120 karakter'),
  content: contentSchema.optional(),
});

const updateCvSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  content: contentSchema.optional(),
});

const atsJobSchema = z.object({
  jobDescription: z.string().max(3000, 'Deskripsi lowongan maksimal 3000 karakter').optional(),
});

// §35: preview PDF STATELESS (POST /api/cvs/preview-pdf) — terima content SAJA
// (title tidak perlu; tidak menyentuh DB). Content wajib objek (boleh kosong
// isinya — semua field contentSchema opsional).
const previewCvSchema = z.object({
  content: contentSchema,
});

module.exports = { createCvSchema, updateCvSchema, atsJobSchema, contentSchema, previewCvSchema };
