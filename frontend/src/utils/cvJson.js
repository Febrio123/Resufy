/**
 * cvJson — ekspor/impor CV via JSON (fitur "Buat CV dari JSON").
 *
 * KONTAK BACKEND AKTUAL (diverifikasi):
 * - Zod (validations/cv.validation.js): project pakai `link`, certification pakai
 *   `credentialUrl` (bukan `url`).
 * - Mongoose (models/cvDocument.model.js): project & certification pakai `url`.
 * - Zod strip unknown keys; Mongoose strict strip unknown keys →
 *   **URL proyek/sertifikasi TIDAK PERNAH tersimpan** (gap backend; dilaporkan,
 *   frontend TIDAK mengubah backend).
 * - Karena itu EKSPOR menghilangkan field `url` kosong (jangan ekspor field yang
 *   tidak tersimpan), dan IMPOR tetap menerima alias `url`/`link`/`credentialUrl`
 *   agar tidak crash pada struktur apa pun (nilai dimasukkan ke form; perilaku
 *   save sama dengan form existing — URL akan di-strip backend).
 */

const toString = (v) => (v === undefined || v === null ? '' : String(v));
const toBool = (v) =>
  typeof v === 'boolean'
    ? v
    : ['true', '1', 1, true].includes(v) || String(v).toLowerCase() === 'true';

const isPlainObject = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

/** Ambil key yang dikenal → string (default ''), urut sesuai skema. */
const pick = (obj, keys) =>
  keys.reduce((acc, k) => {
    acc[k] = toString(obj[k]);
    return acc;
  }, {});

const arrayOfObjects = (raw, mapper) =>
  Array.isArray(raw) ? raw.filter(isPlainObject).map(mapper) : [];

const arrayOfStrings = (raw, max = 50) =>
  Array.isArray(raw)
    ? raw.map(toString).filter((s) => s !== '').slice(0, max)
    : [];

const PERSONAL_INFO_KEYS = ['fullName', 'email', 'phone', 'location', 'website', 'linkedinUrl'];
const EDU_KEYS = ['degree', 'institution', 'location', 'startDate', 'endDate', 'gpa'];
const CERT_KEYS = ['name', 'issuer', 'date'];
const PROJECT_KEYS = ['name', 'description'];
const LANG_KEYS = ['name', 'proficiency'];

/**
 * Sanitasi payload JSON bebas → struktur yang DILINDUNGI whitelist skema CV.
 * Tidak pernah crash pada struktur salah; field/array-item tak dikenal di-drop;
 * string dipaksa String; isCurrent dipaksa boolean; tanggal tetap string.
 */
export function sanitizeContent(raw) {
  if (!isPlainObject(raw)) return {};
  const out = {};

  if (isPlainObject(raw.personalInfo)) {
    out.personalInfo = pick(raw.personalInfo, PERSONAL_INFO_KEYS);
  }
  if (typeof raw.profileSummary === 'string') out.profileSummary = raw.profileSummary;

  out.workExperiences = arrayOfObjects(raw.workExperiences, (it) => ({
    ...pick(it, ['jobTitle', 'company', 'location', 'startDate', 'endDate']),
    isCurrent: toBool(it.isCurrent),
    description: toString(it.description),
  }));

  out.educations = arrayOfObjects(raw.educations, (it) => pick(it, EDU_KEYS));

  out.skills = arrayOfStrings(raw.skills);

  // url: terima alias `url` (format dokumen/mongoose) & `credentialUrl` (zod)
  out.certifications = arrayOfObjects(raw.certifications, (it) => ({
    ...pick(it, CERT_KEYS),
    url: toString(it.url ?? it.credentialUrl),
  }));

  // url: terima alias `url` & `link` (zod)
  out.projects = arrayOfObjects(raw.projects, (it) => ({
    ...pick(it, PROJECT_KEYS),
    url: toString(it.url ?? it.link),
    techStack: arrayOfStrings(it.techStack),
  }));

  out.languages = arrayOfObjects(raw.languages, (it) => pick(it, LANG_KEYS));

  return out;
}

/** Hilangkan field `url` KOSONG dari projects/certifications (tidak tersimpan backend). */
function stripEmptyUrls(content) {
  if (!isPlainObject(content)) return content;
  const out = { ...content };
  for (const key of ['projects', 'certifications']) {
    if (Array.isArray(out[key])) {
      out[key] = out[key].map((item) => {
        if (!isPlainObject(item)) return item;
        const copy = { ...item };
        if (!String(copy.url || '').trim()) delete copy.url;
        return copy;
      });
    }
  }
  return out;
}

/** Payload ekspor: { title, content } — hanya data yang BENAR-BENAR tersimpan. */
export function buildCvExport({ title, content } = {}) {
  return { title: toString(title), content: stripEmptyUrls(content) };
}

const hasValue = (v) => {
  if (v === undefined || v === null) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (typeof v === 'boolean') return false; // isCurrent dll — bukan isi substantif
  if (typeof v === 'number') return v !== 0;
  return true;
};

/** Apakah content memuat minimal SATU data terisi (untuk guard "isi CV dulu"). */
export function hasCvContent(content) {
  if (!isPlainObject(content)) return false;
  if (hasValue(content.profileSummary)) return true;
  if (isPlainObject(content.personalInfo) && Object.values(content.personalInfo).some(hasValue)) return true;
  if (Array.isArray(content.skills) && content.skills.length) return true;
  for (const key of ['workExperiences', 'educations', 'certifications', 'projects', 'languages']) {
    const arr = content[key];
    if (
      Array.isArray(arr) &&
      arr.some((item) => isPlainObject(item) && Object.values(item).some(hasValue))
    ) {
      return true;
    }
  }
  return false;
}
