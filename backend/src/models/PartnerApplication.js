const mongoose = require('mongoose');

const partnerApplicationSchema = new mongoose.Schema(
  {
    shopName: { type: String, required: true, index: true },
    representativeName: { type: String, required: true, default: '' },
    province: { type: String, required: true, default: '', index: true },
    phone: { type: String, required: true, default: '' },
    email: { type: String, required: true, default: '' },
    status: { type: String, enum: ['pending', 'reviewed'], default: 'pending', index: true }
  },
  { timestamps: true }
);

partnerApplicationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('PartnerApplication', partnerApplicationSchema);
