const mongoose = require('mongoose');

const shadowAdminAuditSchema = new mongoose.Schema(
  {
    adminUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    adminEmail: { type: String, default: '', index: true },
    action: { type: String, required: true, index: true },
    path: { type: String, default: '' },
    meta: { type: Object, default: {} }
  },
  { timestamps: true }
);

shadowAdminAuditSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ShadowAdminAudit', shadowAdminAuditSchema);
