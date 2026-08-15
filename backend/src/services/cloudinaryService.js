/**
 * Cloudinary service — semua interaksi file lewat sini.
 * - Upload dari buffer (PDF, gambar) dengan folder prefix dari env.
 * - Delete by public_id (avatar lama, dsb).
 */
const { cloudinary, folderPrefix } = require('../config/cloudinary');
const { logger } = require('../config/logger');

/** Upload buffer ke Cloudinary. resourceType: 'raw' (PDF) | 'auto' (gambar). */
async function uploadBuffer(buffer, { folder = '', publicId, resourceType = 'raw', format } = {}) {
  const fullFolder = [folderPrefix, folder].filter(Boolean).join('/');
  const options = {
    folder: fullFolder,
    resource_type: resourceType,
    overwrite: false,
  };
  if (publicId) options.public_id = publicId;
  if (format) options.format = format;

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(new Error(`Cloudinary upload gagal: ${error.message}`));
      resolve({
        url: result.secure_url,
        publicId: result.public_id,
        bytes: result.bytes,
      });
    });
    stream.end(buffer);
  });
}

/** Delete asset by public_id (ignore error bila tidak ada). */
async function deleteByPublicId(publicId) {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
  } catch (err) {
    logger.warn({ err }, `[cloudinary] destroy gagal (diabaikan): ${publicId}`);
  }
}

/**
 * Generate SIGNED URL segar (berlaku expiresInSec detik) — dipakai untuk
 * redirect/akses PDF. Aman untuk akun dengan Signed URLs/restricted delivery
 * AKTIF maupun nonaktif (Cloudinary selalu menerima signature). Dibuat
 * per-request sehingga tidak pernah kedaluwarsa di cache frontend.
 * @returns {string|null} signed URL, atau null bila publicId kosong
 */
function getSignedUrl({ publicId, resourceType = 'raw', expiresInSec = 3600 } = {}) {
  if (!publicId) return null;
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSec;
  return cloudinary.utils.url(publicId, {
    resource_type: resourceType,
    sign_url: true,
    secure: true,
    expires_at: expiresAt,
  });
}

/**
 * Ekstrak public_id dari URL Cloudinary polos (fallback untuk dokumen lama yang
 * dibuat sebelum field *PdfPublicId ada):
 *   https://res.cloudinary.com/<cn>/raw/upload/v123/resufy/cv/<u>/<id>/preview.pdf
 *   → resufy/cv/<u>/<id>/preview.pdf
 */
function publicIdFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean);
    const uploadIdx = parts.indexOf('upload');
    if (uploadIdx === -1) return null;
    let rest = parts.slice(uploadIdx + 1);
    while (rest.length && /^v\d+$/.test(rest[0])) rest.shift();
    return rest.length ? rest.join('/') : null;
  } catch {
    return null;
  }
}

module.exports = { uploadBuffer, deleteByPublicId, getSignedUrl, publicIdFromUrl };
