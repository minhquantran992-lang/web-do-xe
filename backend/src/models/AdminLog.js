const mongoose = require('mongoose');

const adminLogSchema = new mongoose.Schema(
  {
    adminUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: { type: String, required: true, index: true },
    path: { type: String, default: '' },
    ipAddress: { type: String, default: '' },
    meta: { type: Object, default: {} }
  },
  { timestamps: true }
);

adminLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AdminLog', adminLogSchema);
