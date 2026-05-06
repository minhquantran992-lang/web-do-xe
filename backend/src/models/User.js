const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, default: '' },
    email: { type: String, required: true, unique: true, index: true },
    phone: { type: String, default: '', index: true },
    dob: { type: Date, default: null },
    gender: { type: String, enum: ['', 'male', 'female'], default: '' },
    country: { type: String, default: '' },
    city: { type: String, default: '', index: true },
    role: { type: String, enum: ['USER', 'VENDOR', 'ADMIN', 'ACCOUNTANT'], default: 'USER', index: true },
    password: { type: String, default: null, select: false },
    passwordHash: { type: String, default: null, select: false },
    provider: { type: String, enum: ['local', 'google', 'facebook'], default: 'local', index: true },
    providerId: { type: String, default: undefined, index: true },
    avatar: { type: String, default: '' },
    ownedCars: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Car' }],
    registrationPending: { type: Boolean, default: false, index: true },
    otpLastSentAt: { type: Date, default: null, select: false },
    otpVerifyFailCount: { type: Number, default: 0, select: false },
    otpVerifyLockedUntil: { type: Date, default: null, select: false },
    oauthLoginTicketHash: { type: String, default: null, select: false, index: true },
    oauthLoginTicketExpires: { type: Date, default: null, select: false },
    oauthLoginOtpHash: { type: String, default: null, select: false },
    oauthLoginOtpExpires: { type: Date, default: null, select: false },
    oauthLoginOtpLastSentAt: { type: Date, default: null, select: false },
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
