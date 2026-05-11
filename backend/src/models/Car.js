const mongoose = require('mongoose');
const { buildSearchText } = require('../utils/search');

const carSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    brand: { type: String, default: '', index: true },
    category: { type: String, default: '', index: true },
    engineCc: { type: Number, default: null, index: true },
    image: { type: String, default: '' },
    model3d: { type: String, default: '' },
    anchors: {
      type: [
        new mongoose.Schema(
          {
            id: { type: String, default: '' },
            name: { type: String, required: true },
            category: { type: String, default: '' },
            position: { type: [Number], default: [0, 0, 0] },
            rotation: { type: [Number], default: [0, 0, 0] }
          },
          { _id: false }
        )
      ],
      default: []
    },
    combos: {
      type: [
        new mongoose.Schema(
          {
            key: { type: String, required: true },
            title: { type: String, default: '' },
            modelKey: { type: String, default: '' },
            sortOrder: { type: Number, default: 0 },
            slots: { type: Map, of: String, default: {} }
          },
          { _id: false }
        )
      ],
      default: []
    },
    combinedModelSlots: { type: [String], default: [] },
    combinedModels: { type: Map, of: String, default: {} },
    searchText: { type: String, default: '', index: true },
    specs: {
      powerHp: { type: Number, default: null },
      torqueNm: { type: Number, default: null },
      weightKg: { type: Number, default: null },
      topSpeedKph: { type: Number, default: null },
      fuelL: { type: Number, default: null },
      engineType: { type: String, default: '' },
      gearbox: { type: String, default: '' }
    },

    emissions: {
      co: { type: Number, default: null },
      hc: { type: Number, default: null },
      euroStandard: { type: String, default: '' }
    },

    thumbnailUrl: { type: String, default: '' },
    modelUrl: { type: String, default: '' }
  },
  { timestamps: true }
);

carSchema.pre('save', function () {
  this.searchText = buildSearchText(this.name, this.brand, this.category, this._id);
});

module.exports = mongoose.model('Car', carSchema);
