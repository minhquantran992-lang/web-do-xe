const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema(
  {
    threadId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatThread', required: true, index: true },
    senderType: { type: String, enum: ['user', 'shop'], required: true, index: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    text: { type: String, required: true, trim: true, maxlength: 4000 }
  },
  { timestamps: true }
);

chatMessageSchema.index({ threadId: 1, createdAt: -1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
