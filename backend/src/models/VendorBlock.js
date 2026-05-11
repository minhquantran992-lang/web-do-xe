const mongoose = require('mongoose');

const vendorBlockSchema = new mongoose.Schema(
  {
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reason: { type: String, default: '' },
    expiresAt: { type: Date, default: null },
    createdAt: { type: Date, default: () => new Date(), index: true }
  },
  { timestamps: false }
);

vendorBlockSchema.index({ shopId: 1, userId: 1 }, { unique: true });
vendorBlockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('VendorBlock', vendorBlockSchema);
