const mongoose = require('mongoose');
const { buildSearchText } = require('../utils/search');

const brandSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    vehicleType: { type: String, enum: ['pkl', 'scooter', 'oto', 'bike', 'car'], default: 'pkl', index: true },
    key: { type: String, required: true, trim: true, unique: true, index: true },
    logo: { type: String, default: '' },
    searchText: { type: String, default: '', index: true }
  },
  { timestamps: true }
);

brandSchema.pre('save', function () {
  this.searchText = buildSearchText(this.name, this.key, this.vehicleType, this._id);
});

module.exports = mongoose.model('Brand', brandSchema);
