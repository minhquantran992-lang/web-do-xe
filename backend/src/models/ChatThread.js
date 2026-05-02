const mongoose = require('mongoose');

const chatThreadSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
    lastMessageAt: { type: Date, default: null, index: true },
    lastMessageText: { type: String, default: '' },
    lastMessageSenderType: { type: String, enum: ['', 'user', 'shop'], default: '' },
    userHiddenAt: { type: Date, default: null },
    shopHiddenAt: { type: Date, default: null }
  },
  { timestamps: true }
);

chatThreadSchema.index({ userId: 1, shopId: 1 }, { unique: true });

module.exports = mongoose.model('ChatThread', chatThreadSchema);
