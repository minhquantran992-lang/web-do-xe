const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    buildId: { type: mongoose.Schema.Types.ObjectId, ref: 'Configuration', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
    timeSlot: { type: Date, required: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'in_progress', 'completed', 'rejected', 'expired'],
      default: 'pending',
      index: true
    },
    createdAt: { type: Date, default: () => new Date(), index: true },
    expiresAt: { type: Date, required: true, index: true },
    respondedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    rejectedReason: { type: String, default: '' },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    expiredAt: { type: Date, default: null },
    snapshot: {
      customerName: { type: String, default: '' },
      customerPhone: { type: String, default: '' },
      customerCity: { type: String, default: '' },
      customerGender: { type: String, default: '' },
      customerCountry: { type: String, default: '' },
      buildName: { type: String, default: '' },
      carName: { type: String, default: '' },
      color: { type: String, default: '' },
      previewImageUrl: { type: String, default: '' },
      parts: {
        type: [
          {
            _id: { type: mongoose.Schema.Types.ObjectId, ref: 'Part' },
            name: { type: String, default: '' },
            brandName: { type: String, default: '' },
            type: { type: String, default: '' },
            price: { type: Number, default: 0 }
          }
        ],
        default: []
      },
      totalPrice: { type: Number, default: 0 },
      legalStatus: { type: String, default: 'review' },
      legalWarnings: { type: [String], default: [] }
    }
  },
  { timestamps: false }
);

bookingSchema.index({ status: 1, expiresAt: 1 });
bookingSchema.index({ userId: 1, createdAt: -1 });
bookingSchema.index({ shopId: 1, createdAt: -1 });
bookingSchema.index({ buildId: 1, status: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
