const mongoose = require('mongoose');

const partSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: {
      type: String,
      enum: [
        'exhaust',
        'clutch',
        'wheels',
        'brake',
        'suspension',
        'tire',
        'handlebar',
        'bodykit',
        'seat',
        'lighting',
        'throttle_housing'
      ],
      required: true,
      index: true
    },
    thumbnailUrl: { type: String, default: '' },
    modelUrl: { type: String, required: true },
    mountPoint: { type: String, default: '' },
    mountPoints: { type: [String], default: [] },
    price: { type: Number, default: 0 },
    specs: { type: Object, default: {} }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Part', partSchema);
