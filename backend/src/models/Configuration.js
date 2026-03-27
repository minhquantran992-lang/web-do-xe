const mongoose = require('mongoose');

const configurationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    carId: { type: mongoose.Schema.Types.ObjectId, ref: 'Car', required: true },
    selectedColor: { type: String, default: '#ffffff' },
    selectedWheels: { type: mongoose.Schema.Types.ObjectId, ref: 'Part', default: null },
    selectedParts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Part' }],
    parts: { type: Map, of: mongoose.Schema.Types.ObjectId, default: {} },
    name: { type: String, default: '' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Configuration', configurationSchema);
