const mongoose = require('mongoose');

const shadowTrackEventSchema = new mongoose.Schema(
  {
    kind: { type: String, default: 'SCAN', index: true },
    designId: { type: mongoose.Schema.Types.ObjectId, ref: 'Configuration', default: null, index: true },
    tokenHash: { type: String, default: '', index: true },
    ipHash: { type: String, default: '', index: true },
    uaHash: { type: String, default: '', index: true },
    ref: { type: String, default: '' },
    suspicious: { type: Boolean, default: false, index: true },
    suspiciousReasons: [{ type: String }]
  },
  { timestamps: true }
);

shadowTrackEventSchema.index({ designId: 1, createdAt: -1 });
shadowTrackEventSchema.index({ ipHash: 1, createdAt: -1 });
shadowTrackEventSchema.index({ suspicious: 1, createdAt: -1 });

module.exports = mongoose.model('ShadowTrackEvent', shadowTrackEventSchema);
