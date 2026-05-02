const mongoose = require('mongoose');

const vendorReviewSchema = new mongoose.Schema(
  {
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null, index: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, default: '' }
  },
  { timestamps: true }
);

vendorReviewSchema.index({ vendorId: 1, createdAt: -1 });
vendorReviewSchema.index({ vendorId: 1, userId: 1, bookingId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('VendorReview', vendorReviewSchema);

