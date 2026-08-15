/**
 * PDF generation — pilihan library: PDFKIT (bukan puppeteer).
 * Alasan:
 *  1. Template CV ATS-safe = single-column, text-based (keputusan db/UI) —
 *     pdfkit (text primitives) mencukupi 100%, tanpa Chromium.
 *  2. Hemat resource: tanpa headless browser (~150-300MB + CPU) — penting utk
 *     model pay-per-print Rp2.000 (margin tipis).
 *  3. Puppeteer dicadangkan HANYA jika suatu saat template butuh layout HTML penuh.
 * Watermark: teks diagonal semi-transparan "PREVIEW — BERWATERMARK" di tiap halaman
 * (PDFKit bufferPages + switchToPage). Preview & final = dua asset terpisah di
 * Cloudinary (keputusan lintas fase) — konten beda (watermark vs tanpa).
 */
const PDFDocument = require('pdfkit');

const WATERMARK_TEXT = 'PREVIEW — resufy.app';
const FONT = 'Helvetica';
const FONT_BOLD = 'Helvetica-Bold';

function formatDateRange(startDate, endDate, isCurrent) {
  const s = (startDate || '').trim();
  const e = isCurrent ? 'Sekarang' : (endDate || '').trim();
  if (!s && !e) return '';
  return `${s || '?'} — ${e || '?'}`;
}

/**
 * Gambar watermark diagonal di halaman aktif (PREVIEW/UNPAID saja).
 * - Teks brand 'PREVIEW — resufy.app', merah semi-transparan, ukuran sedang.
 * - Miring 40° (spec ±40-45°), berpusat di tengah halaman, TIDAK bisa
 *   diedit/seleksi konten (di-render sebagai teks dekoratif setelah semua
 *   konten — bukan bagian field/struktur dokumen).
 * - Final (paid) TIDAK memanggil ini (generateCvPdf watermark:false).
 */
function drawWatermark(doc) {
  const { width, height } = doc.page;
  doc.save();
  doc.translate(width / 2, height / 2);
  doc.rotate(40);
  doc.font(FONT_BOLD).fontSize(44);
  const textWidth = doc.widthOfString(WATERMARK_TEXT);
  doc.fillColor('#DC2626').fillOpacity(0.10);
  doc.text(WATERMARK_TEXT, -textWidth / 2, -12, { width: textWidth, align: 'center' });
  doc.fillOpacity(1);
  doc.restore();
}

function sectionTitle(doc, text) {
  doc.moveDown(0.6);
  doc.font(FONT_BOLD).fontSize(12).fillColor('#111827');
  doc.text(text.toUpperCase());
  doc.moveDown(0.15);
  doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).lineWidth(1).strokeColor('#D1D5DB').stroke();
  doc.moveDown(0.4);
  doc.font(FONT).fillColor('#111827');
}

/**
 * Generate PDF CV ATS-safe (single-column).
 * @param {object} cv dokumen cvDocuments (field .content, .title, .templateId)
 * @param {object} opts { watermark: boolean }
 * @returns {Promise<Buffer>}
 */
function generateCvPdf(cv, { watermark = false } = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 48,
        bufferPages: true,
        info: { Title: cv.title || 'CV', Author: 'resufy' },
      });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const c = cv.content || {};
      const p = c.personalInfo || {};

      // Header
      doc.font(FONT_BOLD).fontSize(22).fillColor('#111827').text(p.fullName || 'Nama Lengkap');
      doc.moveDown(0.2);
      const contact = [p.email, p.phone, p.location, p.website, p.linkedinUrl].filter(Boolean).join('  |  ');
      if (contact) doc.font(FONT).fontSize(9).fillColor('#4B5563').text(contact);
      doc.moveDown(0.8);

      // Ringkasan
      if (c.profileSummary) {
        sectionTitle(doc, 'Ringkasan Profil');
        doc.fontSize(10.5).text(c.profileSummary, { align: 'justify' });
      }

      // Pengalaman
      const exps = Array.isArray(c.workExperiences) ? c.workExperiences : [];
      if (exps.length) {
        sectionTitle(doc, 'Pengalaman Kerja');
        for (const e of exps) {
          doc.font(FONT_BOLD).fontSize(10.5).text(e.jobTitle || 'Posisi');
          doc.font(FONT).fontSize(9).fillColor('#4B5563')
            .text(`${[e.company, e.location].filter(Boolean).join(', ')}   ${formatDateRange(e.startDate, e.endDate, e.isCurrent)}`);
          doc.font(FONT).fontSize(10).fillColor('#111827');
          if (e.description) doc.text(e.description, { align: 'justify' });
          doc.moveDown(0.35);
        }
      }

      // Pendidikan
      const edus = Array.isArray(c.educations) ? c.educations : [];
      if (edus.length) {
        sectionTitle(doc, 'Pendidikan');
        for (const e of edus) {
          doc.font(FONT_BOLD).fontSize(10.5).text(e.degree || 'Program Studi');
          doc.font(FONT).fontSize(9).fillColor('#4B5563')
            .text(`${[e.institution, e.location].filter(Boolean).join(', ')}   ${formatDateRange(e.startDate, e.endDate, false)}${e.gpa ? `   GPA: ${e.gpa}` : ''}`);
          doc.font(FONT).fontSize(10).fillColor('#111827');
          doc.moveDown(0.35);
        }
      }

      // Skill (flat list — paling ATS-friendly)
      const skills = Array.isArray(c.skills) ? c.skills.filter(Boolean) : [];
      if (skills.length) {
        sectionTitle(doc, 'Keahlian');
        doc.fontSize(10.5).text(skills.join(', '));
      }

      // Sertifikasi
      const certs = Array.isArray(c.certifications) ? c.certifications.filter((x) => x && x.name) : [];
      if (certs.length) {
        sectionTitle(doc, 'Sertifikasi');
        for (const ct of certs) {
          doc.font(FONT_BOLD).fontSize(10.5).text(ct.name || '');
          if (ct.issuer || ct.date) {
            doc.font(FONT).fontSize(9).fillColor('#4B5563').text([ct.issuer, ct.date].filter(Boolean).join(' — '));
          }
          doc.font(FONT).fontSize(10).fillColor('#111827');
          doc.moveDown(0.3);
        }
      }

      // Proyek
      const projs = Array.isArray(c.projects) ? c.projects.filter((x) => x && x.name) : [];
      if (projs.length) {
        sectionTitle(doc, 'Proyek');
        for (const pr of projs) {
          doc.font(FONT_BOLD).fontSize(10.5).text(pr.name || '');
          if ((pr.techStack || []).length) doc.font(FONT).fontSize(8.5).fillColor('#4B5563').text(`Tech: ${pr.techStack.join(', ')}`);
          doc.font(FONT).fontSize(10).fillColor('#111827');
          if (pr.description) doc.text(pr.description, { align: 'justify' });
          doc.moveDown(0.3);
        }
      }

      // Bahasa
      const langs = Array.isArray(c.languages) ? c.languages.filter((x) => x && x.name) : [];
      if (langs.length) {
        sectionTitle(doc, 'Bahasa');
        doc.fontSize(10.5).text(langs.map((l) => `${l.name}${l.proficiency ? ` (${l.proficiency})` : ''}`).join(', '));
      }

      // Watermark di SEMUA halaman (bufferPages + switchToPage)
      if (watermark) {
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
          doc.switchToPage(i);
          drawWatermark(doc);
        }
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generate PDF laporan plagiarisme.
 * @param {object} check dokumen plagiarismChecks
 * @param {object} opts { watermark }
 * @returns {Promise<Buffer>}
 */
function generatePlagiarismPdf(check, { watermark = false } = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 48,
        bufferPages: true,
        info: { Title: `Laporan Plagiarisme — ${check.originalFilename}`, Author: 'resufy' },
      });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const score = check.overallScore ?? 0;
      const segments = Array.isArray(check.segments) ? check.segments : [];
      const sources = Array.isArray(check.sources) ? check.sources : [];

      // Header laporan
      doc.font(FONT_BOLD).fontSize(18).fillColor('#111827').text('LAPORAN CEK PLAGIARISME');
      doc.moveDown(0.3);
      doc.font(FONT).fontSize(9).fillColor('#4B5563')
        .text(`Dokumen: ${check.originalFilename || '-'}`);
      doc.font(FONT).fontSize(9).fillColor('#4B5563')
        .text(`Tanggal: ${new Date(check.createdAt || Date.now()).toLocaleDateString('id-ID')}`);
      doc.moveDown(1);

      // Skor keseluruhan
      doc.font(FONT_BOLD).fontSize(11).fillColor('#111827').text('SKOR SIMILARITY KESELURUHAN');
      doc.moveDown(0.3);
      doc.font(FONT_BOLD).fontSize(42).fillColor(score >= 60 ? '#DC2626' : score >= 30 ? '#F59E0B' : '#22C55E')
        .text(`${score}%`, { align: 'center' });
      doc.moveDown(0.3);
      doc.font(FONT).fontSize(9).fillColor('#4B5563').text(
        `Berdasarkan ${segments.length} segmen yang diperiksa terhadap sumber internet (cuplikan singkat, bukan reproduksi konten penuh).`,
        { align: 'center' }
      );
      doc.moveDown(0.8);

      // Daftar sumber
      sectionTitle(doc, 'Daftar Sumber Terindikasi Mirip');
      if (sources.length === 0) {
        doc.fontSize(10).text('Tidak ada sumber yang terindikasi mirip.');
      } else {
        doc.fontSize(9.5);
        sources.slice(0, 15).forEach((s, i) => {
          doc.fillColor('#111827').font(FONT).text(`${i + 1}. ${s.title || '(tanpa judul)'}`);
          doc.fillColor('#2563EB').font(FONT).fontSize(8.5).text(`   ${s.url}`);
          doc.fillColor('#4B5563').font(FONT).fontSize(8.5).text(`   ${s.snippet || ''}`);
          doc.moveDown(0.25);
        });
      }

      // Segmen + skor
      doc.addPage();
      sectionTitle(doc, 'Rincian Segmen');
      const topSegments = [...segments].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 15);
      if (topSegments.length === 0) {
        doc.fontSize(10).text('Tidak ada data segmen.');
      } else {
        for (const seg of topSegments) {
          doc.font(FONT_BOLD).fontSize(10).fillColor('#111827').text(`Segmen (kemiripan ${Math.round((seg.score || 0) * 100)}%)`);
          doc.font(FONT).fontSize(9.5).fillColor('#374151').text(seg.textSnippet || '');
          const ms = (seg.matchedSources || []).slice(0, 3);
          if (ms.length) {
            doc.font(FONT).fontSize(8).fillColor('#2563EB');
            for (const m of ms) {
              doc.text(`  • ${m.url}${m.matchScore ? ` (${Math.round(m.matchScore * 100)}%)` : ''}`);
            }
          }
          doc.moveDown(0.4);
        }
      }

      doc.moveDown(0.8);
      doc.font(FONT).fontSize(8).fillColor('#9CA3AF')
        .text('Laporan ini dibuat oleh resufy. Skor adalah estimasi kemiripan berdasarkan cuplikan sumber internet — keputusan final tetap pada penilai (dosen/editor).');

      if (watermark) {
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
          doc.switchToPage(i);
          drawWatermark(doc);
        }
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateCvPdf, generatePlagiarismPdf };
