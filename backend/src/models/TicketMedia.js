const mongoose = require('mongoose');

const ticketMediaSchema = new mongoose.Schema(
  {
    ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true, index: true },
    fileUrl: { type: String, required: true },
    fileType: { type: String, enum: ['image', 'video'], required: true, index: true },
    uploadedByRole: { type: String, enum: ['USER', 'ADMIN', 'VENDOR'], required: true, index: true },
    uploadedById: { type: mongoose.Schema.Types.ObjectId, default: null, index: true }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ticketMediaSchema.index({ ticketId: 1, createdAt: -1 });

module.exports = mongoose.model('TicketMedia', ticketMediaSchema);
