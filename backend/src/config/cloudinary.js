/** Cloudinary SDK config — satu titik inisialisasi. */
const cloudinary = require('cloudinary').v2;
const { env } = require('./env');

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

/** Root folder semua asset resufy (dari env, default 'resufy/'). */
const folderPrefix = env.CLOUDINARY_FOLDER_PREFIX.replace(/\/$/, '');

module.exports = { cloudinary, folderPrefix };
