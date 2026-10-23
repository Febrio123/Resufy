/**
 * PDF generation — PDFKIT (A4, ATS-friendly single-column layout).
 * 2 Template ATS Standar:
 *   1. 'with-photo': Layout foto di sisi kiri pojok atas (top-left 3x4),
 *      nama & kontak di sebelah kanannya, lalu single-column body.
 *   2. 'without-photo': Layout standar tanpa foto, header nama & kontak
 *      full-width, single-column body.
 *
 * Kerapihan, layouting presisi, dan lulus parser ATS.
 * Tanpa watermark, 100% gratis.
 */
const PDFDocument = require('pdfkit');
const axios = require('axios');
const sharp = require('sharp');
const { logger } = require('../config/logger');

const FONT = 'Times-Roman';
const FONT_BOLD = 'Times-Bold';
const FONT_ITALIC = 'Times-Italic';

function formatDateRange(startDate, endDate, isCurrent) {
  const s = (startDate || '').trim();
  const e = isCurrent ? 'Sekarang' : (endDate || '').trim();
  if (!s && !e) return '';
  return `${s || '?'} — ${e || '?'}`;
}

function renderSectionTitle(doc, text) {
  // Cek jika posisi mendekati batas bawah halaman untuk mencegah orphan header
  if (doc.y > doc.page.height - doc.page.margins.bottom - 45) {
    doc.addPage();
  }
  doc.moveDown(0.4);
  doc.font(FONT_BOLD).fontSize(9.5).fillColor('#111827');
  doc.text(text.toUpperCase(), doc.page.margins.left, doc.y, { characterSpacing: 0.5 });
  doc.moveDown(0.12);
  doc.moveTo(doc.page.margins.left, doc.y)
     .lineTo(doc.page.width - doc.page.margins.right, doc.y)
     .lineWidth(0.5)
     .strokeColor('#D1D5DB')
     .stroke();
  doc.moveDown(0.25);
  doc.font(FONT).fontSize(8.5).fillColor('#1F2937');
}

/**
 * Generate PDF CV ATS-safe (Format Ringkas, Padat, & Rapi).
 * @param {object} cv dokumen CV (content, template, photoUrl, photoCrop, title)
 * @returns {Promise<Buffer>}
 */
function generateCvPdf(cv) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 32, bottom: 32, left: 36, right: 36 },
        bufferPages: true,
        info: {
          Title: cv.title || 'Curriculum Vitae',
          Author: (cv.content && cv.content.personalInfo && cv.content.personalInfo.fullName) || 'CV',
          Subject: 'Curriculum Vitae Standar ATS - HireUp',
          Creator: 'HireUp',
        },
      });

      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const c = cv.content || {};
      const p = c.personalInfo || {};
      const template = cv.template || 'without-photo';

      const marginLeft = doc.page.margins.left;
      const marginRight = doc.page.margins.right;
      const contentWidth = doc.page.width - marginLeft - marginRight;

      // =========================================================================
      // HEADER TEMPLATE
      // =========================================================================
      if (template === 'with-photo') {
        // -----------------------------------------------------------------------
        // TEMPLATE 1: DENGAN FOTO (Foto di sisi kiri pojok atas 3:4 ringkas)
        // -----------------------------------------------------------------------
        const photoWidth = 60; // pt (~21.2 mm)
        const photoHeight = 80; // pt (~28.2 mm, rasio 3:4)
        const photoX = marginLeft;
        const photoY = doc.page.margins.top;

        let imageBuffer = null;
        if (cv.photoUrl) {
          try {
            const response = await axios.get(cv.photoUrl, {
              responseType: 'arraybuffer',
              timeout: 10000,
            });
            imageBuffer = Buffer.from(response.data);
          } catch (err) {
            logger.warn({ err, photoUrl: cv.photoUrl }, '[pdf] gagal fetch foto CV dari Cloudinary');
          }
        }

        if (imageBuffer) {
          try {
            const { x = 0, y = 0, width = 1, height = 1 } = cv.photoCrop || {};
            const meta = await sharp(imageBuffer).metadata();
            const cropLeft = Math.max(0, Math.round(x * meta.width));
            const cropTop = Math.max(0, Math.round(y * meta.height));
            const cropWidth = Math.min(meta.width - cropLeft, Math.round(width * meta.width));
            const cropHeight = Math.min(meta.height - cropTop, Math.round(height * meta.height));

            const processedBuffer = await sharp(imageBuffer)
              .extract({ left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight })
              .resize(Math.round(photoWidth * 2), Math.round(photoHeight * 2), { fit: 'cover' })
              .toFormat('png')
              .toBuffer();

            doc.image(processedBuffer, photoX, photoY, { width: photoWidth, height: photoHeight });
            // Border tipis rapi di sekeliling foto
            doc.rect(photoX, photoY, photoWidth, photoHeight)
               .lineWidth(0.5)
               .strokeColor('#D1D5DB')
               .stroke();
          } catch (err) {
            logger.warn({ err }, '[pdf] gagal memproses crop foto');
          }
        } else {
          // Placeholder foto 3x4 rapi jika belum ada foto
          doc.rect(photoX, photoY, photoWidth, photoHeight)
             .lineWidth(0.5)
             .strokeColor('#CBD5E1')
             .fillColor('#F8FAFC')
             .fillAndStroke();
          doc.font(FONT).fontSize(7.5).fillColor('#94A3B8')
             .text('FOTO 3×4', photoX, photoY + (photoHeight / 2) - 5, { width: photoWidth, align: 'center' });
        }

        // Teks Nama & Kontak di sisi kanan foto
        const textX = photoX + photoWidth + 14;
        const textWidth = doc.page.width - marginRight - textX;

        doc.y = photoY + 1;
        doc.font(FONT_BOLD).fontSize(16).fillColor('#111827')
           .text(p.fullName || 'Nama Lengkap', textX, doc.y, { width: textWidth });

        doc.moveDown(0.15);

        // Kontak terstruktur rapi
        const contactItems = [
          p.email,
          p.phone,
          p.location,
          p.linkedinUrl ? `LinkedIn: ${p.linkedinUrl}` : null,
          p.website,
        ].filter(Boolean);

        doc.font(FONT).fontSize(8.5).fillColor('#4B5563');
        for (let i = 0; i < contactItems.length; i += 2) {
          const row = [contactItems[i], contactItems[i + 1]].filter(Boolean).join('   |   ');
          doc.text(row, textX, doc.y, { width: textWidth, lineGap: 1.5 });
        }

        // Pastikan Y turun di bawah batas maksimal antara foto dan teks nama
        const headerBottom = Math.max(photoY + photoHeight, doc.y) + 8;
        doc.y = headerBottom;
        doc.x = marginLeft;

        // Garis pemisah header
        doc.moveTo(marginLeft, doc.y)
           .lineTo(doc.page.width - marginRight, doc.y)
           .lineWidth(0.5)
           .strokeColor('#D1D5DB')
           .stroke();
        doc.moveDown(0.25);

      } else {
        // -----------------------------------------------------------------------
        // TEMPLATE 2: TANPA FOTO (Full-width clean ATS layout ringkas)
        // -----------------------------------------------------------------------
        doc.y = doc.page.margins.top;
        doc.x = marginLeft;

        // Nama Kandidat Tegas
        doc.font(FONT_BOLD).fontSize(17).fillColor('#111827')
           .text(p.fullName || 'Nama Lengkap', marginLeft, doc.y, { width: contentWidth });

        doc.moveDown(0.15);

        // Kontak (Inline Baris Bersih dipisah Pipe)
        const contactLine = [p.email, p.phone, p.location, p.linkedinUrl, p.website]
          .filter(Boolean)
          .join('   |   ');

        if (contactLine) {
          doc.font(FONT).fontSize(8.5).fillColor('#4B5563')
             .text(contactLine, marginLeft, doc.y, { width: contentWidth, lineGap: 1.5 });
        }

        doc.moveDown(0.25);

        // Garis pemisah header
        doc.moveTo(marginLeft, doc.y)
           .lineTo(doc.page.width - marginRight, doc.y)
           .lineWidth(0.5)
           .strokeColor('#D1D5DB')
           .stroke();
        doc.moveDown(0.25);
      }

      // =========================================================================
      // SECTIONS (Standar ATS: Linear 1 Kolom Ringkas & Padat)
      // =========================================================================

      // 1. RINGKASAN PROFIL
      if (c.profileSummary && c.profileSummary.trim()) {
        renderSectionTitle(doc, 'Ringkasan Profil');
        doc.font(FONT).fontSize(8.5).fillColor('#374151')
           .text(c.profileSummary.trim(), marginLeft, doc.y, {
             width: contentWidth,
             align: 'justify',
             lineGap: 2,
           });
        doc.moveDown(0.2);
      }

      // 2. PENGALAMAN KERJA
      const experiences = Array.isArray(c.workExperiences) ? c.workExperiences : [];
      if (experiences.length > 0) {
        renderSectionTitle(doc, 'Pengalaman Kerja');
        for (const exp of experiences) {
          if (!exp.jobTitle && !exp.company) continue;

          // Cek page break
          if (doc.y > doc.page.height - doc.page.margins.bottom - 40) {
            doc.addPage();
          }

          // Posisi / Job Title & Tanggal
          const dateStr = formatDateRange(exp.startDate, exp.endDate, exp.isCurrent);
          doc.font(FONT_BOLD).fontSize(9.5).fillColor('#111827');

          const startY = doc.y;
          doc.text(exp.jobTitle || 'Posisi', marginLeft, startY, { width: contentWidth - 130 });
          if (dateStr) {
            doc.font(FONT).fontSize(8).fillColor('#6B7280')
               .text(dateStr, doc.page.width - marginRight - 125, startY, { width: 125, align: 'right' });
          }

          // Perusahaan & Lokasi (tanpa cetak miring)
          const compLoc = [exp.company, exp.location].filter(Boolean).join(' — ');
          if (compLoc) {
            doc.moveDown(0.12);
            doc.font(FONT).fontSize(8.5).fillColor('#4B5563')
               .text(compLoc, marginLeft, doc.y, { width: contentWidth });
          }

          // Deskripsi (tanpa bullet point, diberi spasi atas, tanpa cetak miring)
          if (exp.description && exp.description.trim()) {
            doc.moveDown(0.32);
            doc.font(FONT).fontSize(8.5).fillColor('#374151');
            const cleanDescription = exp.description
              .split('\n')
              .map((line) => line.replace(/^[\s•\-\*–—\u2022\d+\.\)]+/, '').trim())
              .filter(Boolean)
              .join('\n');

            if (cleanDescription) {
              doc.text(cleanDescription, marginLeft, doc.y, {
                width: contentWidth,
                align: 'left',
                lineGap: 2,
              });
            }
          }
          doc.moveDown(0.35);
        }
      }

      // 3. PENDIDIKAN
      const educations = Array.isArray(c.educations) ? c.educations : [];
      if (educations.length > 0) {
        renderSectionTitle(doc, 'Pendidikan');
        for (const edu of educations) {
          if (!edu.degree && !edu.institution) continue;

          if (doc.y > doc.page.height - doc.page.margins.bottom - 35) {
            doc.addPage();
          }

          const eduDate = formatDateRange(edu.startDate, edu.endDate, false);
          doc.font(FONT_BOLD).fontSize(9.5).fillColor('#111827');

          const startY = doc.y;
          doc.text(edu.degree || 'Program Studi / Jurusan', marginLeft, startY, { width: contentWidth - 130 });
          if (eduDate) {
            doc.font(FONT).fontSize(8).fillColor('#6B7280')
               .text(eduDate, doc.page.width - marginRight - 125, startY, { width: 125, align: 'right' });
          }

          const instInfo = [
            edu.institution,
            edu.location,
            edu.gpa ? `IPK/GPA: ${edu.gpa}` : null,
          ].filter(Boolean).join(' — ');

          if (instInfo) {
            doc.moveDown(0.12);
            doc.font(FONT).fontSize(8.5).fillColor('#4B5563')
               .text(instInfo, marginLeft, doc.y, { width: contentWidth });
          }
          doc.moveDown(0.32);
        }
      }

      // 4. KEAHLIAN / SKILLS (Format flat list paling disukai parser ATS)
      const skills = Array.isArray(c.skills) ? c.skills.filter(Boolean) : [];
      if (skills.length > 0) {
        renderSectionTitle(doc, 'Keahlian');
        doc.font(FONT).fontSize(8.5).fillColor('#374151')
           .text(skills.join('   •   '), marginLeft, doc.y, {
             width: contentWidth,
             lineGap: 2,
           });
        doc.moveDown(0.2);
      }

      // 5. SERTIFIKASI
      const certs = Array.isArray(c.certifications) ? c.certifications.filter((x) => x && x.name) : [];
      if (certs.length > 0) {
        renderSectionTitle(doc, 'Sertifikasi');
        for (const ct of certs) {
          if (doc.y > doc.page.height - doc.page.margins.bottom - 25) {
            doc.addPage();
          }
          doc.font(FONT_BOLD).fontSize(9).fillColor('#111827').text(ct.name, marginLeft, doc.y);
          const meta = [ct.issuer, ct.date].filter(Boolean).join(' — ');
          if (meta) {
            doc.font(FONT).fontSize(8).fillColor('#6B7280').text(meta, marginLeft, doc.y);
          }
          doc.moveDown(0.15);
        }
      }

      // 6. PROYEK
      const projects = Array.isArray(c.projects) ? c.projects.filter((x) => x && x.name) : [];
      if (projects.length > 0) {
        renderSectionTitle(doc, 'Proyek');
        for (const pr of projects) {
          if (doc.y > doc.page.height - doc.page.margins.bottom - 30) {
            doc.addPage();
          }
          doc.font(FONT_BOLD).fontSize(9).fillColor('#111827').text(pr.name, marginLeft, doc.y);
          if (Array.isArray(pr.techStack) && pr.techStack.length > 0) {
            doc.moveDown(0.1);
            doc.font(FONT_ITALIC).fontSize(8).fillColor('#4B5563')
               .text(`Teknologi: ${pr.techStack.join(', ')}`, marginLeft, doc.y);
          }
          if (pr.description) {
            doc.moveDown(0.25);
            doc.font(FONT).fontSize(8.5).fillColor('#374151')
               .text(pr.description, marginLeft, doc.y, { width: contentWidth, lineGap: 1.5 });
          }
          doc.moveDown(0.3);
        }
      }

      // 7. BAHASA
      const languages = Array.isArray(c.languages) ? c.languages.filter((x) => x && x.name) : [];
      if (languages.length > 0) {
        renderSectionTitle(doc, 'Bahasa');
        const langStr = languages
          .map((l) => `${l.name}${l.proficiency ? ` (${l.proficiency})` : ''}`)
          .join('   •   ');
        doc.font(FONT).fontSize(8.5).fillColor('#374151').text(langStr, marginLeft, doc.y, {
          width: contentWidth,
        });
        doc.moveDown(0.2);
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateCvPdf };
