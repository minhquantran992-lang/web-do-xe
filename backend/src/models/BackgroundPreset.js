const mongoose = require('mongoose');

const backgroundPresetSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    label: { type: String, required: true, trim: true },
    kind: { type: String, enum: ['color', 'gradient', 'image'], required: true, index: true },
    color: { type: String, default: '' },
    css: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    enabled: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0, index: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('BackgroundPreset', backgroundPresetSchema);

