const mongoose = require('mongoose');

const vendorCarSchema = new mongoose.Schema(
  {
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
    title: { type: String, required: true, index: true },
    description: { type: String, default: '' },
    images: { type: [String], default: [] },
    coverImage: { type: String, default: '' }
  },
  { timestamps: true }
);

vendorCarSchema.index({ vendorId: 1, createdAt: -1 });

module.exports = mongoose.model('VendorCar', vendorCarSchema);

