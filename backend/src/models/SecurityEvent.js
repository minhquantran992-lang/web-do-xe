const mongoose = require('mongoose');

const securityEventSchema = new mongoose.Schema(
  {
    at: { type: Date, default: () => new Date() },
    kind: { type: String, default: '', index: true },
    outcome: { type: String, default: '', index: true },
    endpoint: { type: String, default: '', index: true },
    method: { type: String, default: '' },
    ip: { type: String, default: '', index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    ua: { type: String, default: '' },
    score: { type: Number, default: 0 },
    meta: { type: Object, default: {} }
  },
  { timestamps: false }
);

securityEventSchema.index({ at: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('SecurityEvent', securityEventSchema);
