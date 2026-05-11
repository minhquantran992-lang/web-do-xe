const mongoose = require('mongoose');

const refreshSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true, select: false },
    createdAt: { type: Date, default: () => new Date(), index: true },
    expiresAt: { type: Date, required: true },
    lastUsedAt: { type: Date, default: null },
    rotatedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null, index: true },
    ip: { type: String, default: '' },
    ua: { type: String, default: '' }
  },
  { timestamps: false }
);

refreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('RefreshSession', refreshSessionSchema);
