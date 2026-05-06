const mongoose = require('mongoose');

const ORDER_STATUSES = ['REQUESTED', 'QUOTED', 'REJECTED', 'CANCELLED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'];

const orderProgressSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    fromStatus: { type: String, enum: ORDER_STATUSES, default: null, index: true },
    toStatus: { type: String, enum: ORDER_STATUSES, required: true, index: true },
    actorRole: { type: String, enum: ['USER', 'WORKSHOP', 'SYSTEM'], required: true, index: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    note: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    happenedAt: { type: Date, default: () => new Date(), index: true }
  },
  { timestamps: true }
);

orderProgressSchema.index({ orderId: 1, happenedAt: -1 });

module.exports = mongoose.model('OrderProgress', orderProgressSchema);
