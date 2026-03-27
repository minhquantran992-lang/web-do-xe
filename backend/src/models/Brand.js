const mongoose = require('mongoose');

const brandSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    vehicleType: { type: String, enum: ['pkl', 'scooter', 'oto', 'bike', 'car'], default: 'pkl', index: true },
    key: { type: String, required: true, trim: true, unique: true, index: true },
    logo: { type: String, default: '' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Brand', brandSchema);
