/**
 * User — akun B2C. Koleksi: users
 * Field & index persis 01-database-design.md §3.1.
 * passwordHash: select:false (tidak pernah keluar tanpa eksplisit) + pre-save bcrypt 12 rounds.
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email wajib diisi'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true, // unique index { email: 1 }
    },
    passwordHash: {
      type: String,
      required: [true, 'Password wajib diisi'],
      select: false, // tidak pernah ikut query biasa
    },
    name: {
      type: String,
      required: [true, 'Nama wajib diisi'],
      trim: true,
      maxlength: [100, 'Nama maksimal 100 karakter'],
    },
    avatarUrl: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    emailVerifiedAt: {
      type: Date,
      default: null, // diaktifkan fase security bila diputuskan
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Pre-save: hash password (hanya jika dimodifikasi)
userSchema.pre('save', async function preSaveHash(next) {
  if (!this.isModified('passwordHash')) return next();
  try {
    this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
    return next();
  } catch (err) {
    return next(err);
  }
});

// Instance method: cek password (async)
userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

// Statik: cari user by email dengan passwordHash (utk login)
userSchema.statics.findByEmailWithPassword = function findByEmailWithPassword(email) {
  return this.findOne({ email: String(email).toLowerCase() }).select('+passwordHash');
};

// Instance: versi aman untuk respons API (toJSON transform menghapus passwordHash/__v)
userSchema.methods.toSafeJSON = function toSafeJSON() {
  return this.toJSON();
};

const User = mongoose.model('User', userSchema);
module.exports = { User };
