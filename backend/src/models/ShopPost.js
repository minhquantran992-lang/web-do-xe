const mongoose = require('mongoose');

const ShopPostSchema = new mongoose.Schema(
  {
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
    type: { type: String, enum: ['post', 'video'], required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    content: { type: String, trim: true, maxlength: 8000 },
    mediaUrl: { type: String, trim: true },
    thumbnailUrl: { type: String, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('ShopPost', ShopPostSchema);
