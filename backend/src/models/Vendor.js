const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    shopName: { type: String, required: true, index: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    approvedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: '' },
    description: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    address: { type: String, default: '' },
    website: { type: String, default: '' },
    facebook: { type: String, default: '' },
    zalo: { type: String, default: '' },
    logo: { type: String, default: '' },
    coverImage: { type: String, default: '' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Vendor', vendorSchema);
