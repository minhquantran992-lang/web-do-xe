const mongoose = require('mongoose');

const carSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    brand: { type: String, default: '', index: true },
    category: { type: String, default: '', index: true },
    engineCc: { type: Number, default: null, index: true },
    image: { type: String, default: '' },
    model3d: { type: String, default: '' },
    specs: {
      powerHp: { type: Number, default: null },
      torqueNm: { type: Number, default: null },
      weightKg: { type: Number, default: null },
      topSpeedKph: { type: Number, default: null },
      fuelL: { type: Number, default: null },
      engineType: { type: String, default: '' },
      gearbox: { type: String, default: '' }
    },

    thumbnailUrl: { type: String, default: '' },
    modelUrl: { type: String, default: '' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Car', carSchema);
