const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, default: '' },
    email: { type: String, required: true, unique: true, index: true },
    role: { type: String, enum: ['USER', 'VENDOR', 'ADMIN'], default: 'USER', index: true },
    password: { type: String, default: null, select: false },
    passwordHash: { type: String, default: null, select: false },
    provider: { type: String, enum: ['local', 'google', 'facebook'], default: 'local', index: true },
    providerId: { type: String, default: undefined, index: true },
    avatar: { type: String, default: '' },
    resetTokenHash: { type: String, default: null, select: false },
    resetTokenExpires: { type: Date, default: null, select: false },
    resetCodeHash: { type: String, default: null, select: false },
    emailVerified: { type: Boolean, default: false },
    verifyCodeHash: { type: String, default: null, select: false },
    verifyCodeExpires: { type: Date, default: null, select: false }
  },
  { timestamps: true }
);

userSchema.index(
  { provider: 1, providerId: 1 },
  { unique: true, partialFilterExpression: { providerId: { $type: 'string' } } }
);

module.exports = mongoose.model('User', userSchema);
