/**
 * ATS Score service — GRATIS, tidak terkait pembayaran.
 * Checklist sederhana (rule-based, tanpa AI/API):
 *  - format tanggal konsisten (YYYY atau YYYY-MM)
 *  - section wajib terisi (personalInfo, ringkasan, pengalaman, pendidikan, skill)
 *  - penilaian skill & kelengkapan umum
 * Opsional: cocokkan keyword dengan deskripsi lowongan (atsKeywordMatch).
 *
 * Skor: mulai 100; error -15, warning -8, info -2 (min 0).
 */
const { normalizeWhitespace, extractKeywords, shortHash } = require('../utils/helpers');

const DATE_RE = /^\d{4}(-\d{2})?$/; // YYYY atau YYYY-MM

function isBlank(v) {
  return typeof v !== 'string' || normalizeWhitespace(v).length === 0;
}

function analyze(content = {}, jobDescription = null) {
  const feedback = [];
  const push = (severity, message, section) => feedback.push({ severity, message, section });

  const personal = content.personalInfo || {};
  const experiences = Array.isArray(content.workExperiences) ? content.workExperiences : [];
  const educations = Array.isArray(content.educations) ? content.educations : [];
  const skills = Array.isArray(content.skills) ? content.skills.filter((s) => isBlank(s) === false) : [];
  const certifications = Array.isArray(content.certifications) ? content.certifications : [];
  const projects = Array.isArray(content.projects) ? content.projects : [];
  const languages = Array.isArray(content.languages) ? content.languages : [];

  // ---- Checklist ATS ----
  if (isBlank(personal.fullName)) push('error', 'Nama lengkap kosong — identitas utama CV wajib ada.', 'personalInfo');
  if (isBlank(personal.email)) push('error', 'Email kosong — rekruter tidak bisa menghubungi kamu.', 'personalInfo');
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personal.email)) push('warning', 'Format email tidak valid.', 'personalInfo');
  if (isBlank(personal.phone)) push('warning', 'Nomor HP kosong — sebaiknya dilengkapi.', 'personalInfo');
  if (isBlank(content.profileSummary)) push('warning', 'Ringkasan profil kosong — 2–3 kalimat ringkas membantu ATS & rekruter.', 'profileSummary');

  if (experiences.length === 0) {
    push('error', 'Belum ada pengalaman kerja — section wajib untuk CV lamaran kerja.', 'workExperiences');
  } else {
    const badDate = experiences.some((e) => {
      const sd = (e.startDate || '').trim();
      const ed = (e.endDate || '').trim();
      if (!e.isCurrent && !isBlank(ed) && !DATE_RE.test(ed)) return true;
      return !isBlank(sd) && !DATE_RE.test(sd);
    });
    if (badDate) push('error', 'Format tanggal pengalaman tidak konsisten — gunakan YYYY atau YYYY-MM di semua item.', 'workExperiences');
    const emptyRole = experiences.filter((e) => isBlank(e.jobTitle) || isBlank(e.company)).length;
    if (emptyRole > 0) push('warning', `${emptyRole} item pengalaman ada field posisi/perusahaan kosong.`, 'workExperiences');
  }

  if (educations.length === 0) {
    push('warning', 'Belum ada pendidikan — sangat disarankan untuk fresh graduate.', 'educations');
  } else {
    const badDate = educations.some((e) => {
      const sd = (e.startDate || '').trim();
      const ed = (e.endDate || '').trim();
      if (!isBlank(ed) && !DATE_RE.test(ed)) return true;
      return !isBlank(sd) && !DATE_RE.test(sd);
    });
    if (badDate) push('error', 'Format tanggal pendidikan tidak konsisten — gunakan YYYY atau YYYY-MM.', 'educations');
  }

  if (skills.length === 0) push('error', 'Skill kosong — flat list skill (pisahkan koma) sangat ATS-friendly.', 'skills');
  else if (skills.length < 3) push('warning', `Hanya ${skills.length} skill — tambahkan minimal 3–5 skill relevan.`, 'skills');

  if (certifications.length > 0) {
    const empty = certifications.filter((c) => isBlank(c.name)).length;
    if (empty > 0) push('info', `${empty} sertifikasi tanpa nama — lengkapi atau hapus.`, 'certifications');
  } else {
    push('info', 'Section sertifikasi kosong — boleh diisi jika ada sertifikasi relevan.', 'certifications');
  }
  if (projects.length === 0) push('info', 'Section proyek kosong — proyek pribadi memperkuat CV (opsional).', 'projects');
  if (languages.length === 0) push('info', 'Section bahasa kosong — opsional, tapi berguna.', 'languages');

  // ---- Skor ----
  let score = 100;
  for (const f of feedback) {
    if (f.severity === 'error') score -= 15;
    else if (f.severity === 'warning') score -= 8;
    else score -= 2;
  }
  score = Math.max(0, Math.min(100, score));

  // ---- Keyword match (opsional) ----
  let keywordMatch = null;
  if (jobDescription && normalizeWhitespace(jobDescription).length >= 10) {
    const jdKeywords = extractKeywords(jobDescription, 15);
    const cvText = [
      personal.fullName,
      content.profileSummary,
      ...experiences.map((e) => `${e.jobTitle} ${e.company} ${e.description}`),
      ...educations.map((e) => `${e.degree} ${e.institution}`),
      ...skills.join(' '),
      ...projects.map((p) => `${p.name} ${p.description} ${(p.techStack || []).join(' ')}`),
    ].join(' ').toLowerCase();

    const matched = jdKeywords.filter((k) => cvText.includes(k));
    const missing = jdKeywords.filter((k) => !cvText.includes(k));
    const kwScore = jdKeywords.length === 0 ? null : Math.round((matched.length / jdKeywords.length) * 100);

    keywordMatch = {
      jobDescriptionHash: shortHash(jobDescription),
      score: kwScore,
      matchedKeywords: matched,
      missingKeywords: missing,
    };
  }

  return { score, feedback, keywordMatch };
}

module.exports = { analyze };
