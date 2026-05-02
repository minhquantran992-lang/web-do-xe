const mongoose = require('mongoose');

const ticketLogSchema = new mongoose.Schema(
  {
    ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true, index: true },
    action: {
      type: String,
      enum: [
        'created',
        'evidence_added',
        'evidence_requested',
        'status_changed',
        'admin_note_updated',
        'shop_flagged',
        'shop_responded'
      ],
      required: true,
      index: true
    },
    actorRole: { type: String, enum: ['USER', 'ADMIN', 'VENDOR'], required: true, index: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    note: { type: String, default: '' },
    meta: { type: Object, default: {} }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ticketLogSchema.index({ ticketId: 1, createdAt: -1 });

module.exports = mongoose.model('TicketLog', ticketLogSchema);
