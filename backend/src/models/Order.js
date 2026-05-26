const mongoose = require('mongoose');

const ORDER_STATUSES = [
  'REQUESTED',
  'SHOP_REJECTED',
  'QUOTED',
  'REJECTED',
  'CANCELLED',
  'CONFIRMED',
  'IN_PROGRESS',
  'QUALITY_CHECK',
  'COMPLETED',
  'DISPUTED'
];

const orderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
    buildId: { type: mongoose.Schema.Types.ObjectId, ref: 'Configuration', required: true, index: true },
    status: { type: String, enum: ORDER_STATUSES, required: true, index: true },
    quotedPrice: { type: Number, default: null },
    quoteNote: { type: String, default: '' },
    quotedAt: { type: Date, default: null },
    quoteExpiresAt: { type: Date, default: null, index: true },
    confirmedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, default: '' },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ shopId: 1, createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
