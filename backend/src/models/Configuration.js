const mongoose = require('mongoose');

const configurationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    carId: { type: mongoose.Schema.Types.ObjectId, ref: 'Car', required: true },
    selectedColor: { type: String, default: '#ffffff' },
    slotColors: { type: Map, of: String, default: {} },
    selectedWheels: { type: mongoose.Schema.Types.ObjectId, ref: 'Part', default: null },
    selectedParts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Part' }],
    parts: { type: Map, of: mongoose.Schema.Types.ObjectId, default: {} },
    name: { type: String, default: '' },
    isPublic: { type: Boolean, default: false, index: true },
    publishedAt: { type: Date, default: null, index: true },
    likesCount: { type: Number, default: 0, index: true },
    likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    favoritesCount: { type: Number, default: 0, index: true },
    viewsCount: { type: Number, default: 0, index: true },
    thumbnailUrl: { type: String, default: '' },
    backgroundKey: { type: String, default: '' },
    camera: {
      position: [{ type: Number }],
      target: [{ type: Number }]
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Configuration', configurationSchema);
