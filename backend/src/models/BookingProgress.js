const mongoose = require('mongoose');

const BOOKING_STATUSES = ['pending', 'quoted', 'accepted', 'in_progress', 'completed', 'rejected', 'cancelled', 'expired'];

const bookingProgressSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    fromStatus: { type: String, enum: BOOKING_STATUSES, default: null, index: true },
    toStatus: { type: String, enum: BOOKING_STATUSES, required: true, index: true },
    actorRole: { type: String, enum: ['USER', 'WORKSHOP', 'SYSTEM'], required: true, index: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    note: { type: String, default: '' },
    happenedAt: { type: Date, default: () => new Date(), index: true }
  },
  { timestamps: true }
);

bookingProgressSchema.index({ bookingId: 1, happenedAt: -1 });

module.exports = mongoose.model('BookingProgress', bookingProgressSchema);
