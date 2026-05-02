const mongoose = require('mongoose');

const VendorCar = require('../models/VendorCar');
const { asyncHandler } = require('./asyncHandler');

const requireVendorCarOwnership = asyncHandler(async (req, res, next) => {
  const vendorId = String(req.vendor?._id || '');
  const id = String(req.params.id || '');
  if (!vendorId) return res.status(403).json({ error: 'FORBIDDEN' });
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });

  const item = await VendorCar.findOne({ _id: id, vendorId }).lean();
  if (!item) return res.status(404).json({ error: 'NOT_FOUND' });

  req.vendorCar = item;
  return next();
});

module.exports = { requireVendorCarOwnership };

