const mongoose = require('mongoose');
const { randomUUID } = require('crypto');

const ticketSchema = new mongoose.Schema(
  {
    ticketId: { type: String, default: () => randomUUID(), unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    issueType: { type: String, default: '', index: true },
    description: { type: String, default: '' },
    status: {
      type: String,
      enum: ['PENDING', 'DISPUTED', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED'],
      default: 'PENDING',
      index: true
    },
    adminNote: { type: String, default: '' },
    evidenceRequestNote: { type: String, default: '' },
    needsMoreEvidence: { type: Boolean, default: false, index: true },
    shopFlagged: { type: Boolean, default: false, index: true }
  },
  { timestamps: true }
);

ticketSchema.index({ bookingId: 1, createdAt: -1 });
ticketSchema.index({ shopId: 1, status: 1, createdAt: -1 });
ticketSchema.index({ userId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Ticket', ticketSchema);
