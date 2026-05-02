const mongoose = require('mongoose');
const { buildSearchText } = require('../utils/search');

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
        'throttle_housing',
        'topbox'
      ],
      required: true,
      index: true
    },
    variantKey: { type: String, default: '' },
    thumbnailUrl: { type: String, default: '' },
    modelUrl: { type: String, default: '' },
    mountPoint: { type: String, default: '' },
    mountPoints: { type: [String], default: [] },
    boundingBox: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
      z: { type: Number, default: 0 }
    },
    compatibilityTags: { type: [String], default: [] },
    exclusionTags: { type: [String], default: [] },
    price: { type: Number, default: 0 },
    searchText: { type: String, default: '', index: true },
    specs: { type: Object, default: {} },
    emissions: {
      coMultiplier: { type: Number, default: 1 },
      hcMultiplier: { type: Number, default: 1 },
      hasCatalytic: { type: Boolean, default: true }
    }
  },
  { timestamps: true }
);

partSchema.pre('save', function () {
  this.searchText = buildSearchText(this.name, this.type, this._id);
});

module.exports = mongoose.model('Part', partSchema);
