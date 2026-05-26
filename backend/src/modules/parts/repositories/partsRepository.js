const mongoose = require('mongoose');
const { Part } = require('../models/Part');

const listParts = async ({ type, carId, strict } = {}) => {
  const cleanType = String(type || '').trim();
  const carIdRaw = String(carId || '').trim();
  const carObjectId = mongoose.isValidObjectId(carIdRaw) ? new mongoose.Types.ObjectId(carIdRaw) : null;
  const onlyCompatible = Boolean(strict);

  const q = cleanType ? { type: cleanType } : {};
  if (carObjectId) {
    if (onlyCompatible) {
      q.compatibleCars = carObjectId;
    } else {
      q.$or = [
        { compatibleCars: { $exists: false } },
        { compatibleCars: { $size: 0 } },
        { compatibleCars: carObjectId }
      ];
    }
  }

  return Part.find(q).sort({ createdAt: -1 }).lean();
};

module.exports = { listParts };
