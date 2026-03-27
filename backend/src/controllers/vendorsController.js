const mongoose = require('mongoose');

const Vendor = require('../models/Vendor');
const { asyncHandler } = require('../middleware/asyncHandler');

const getVendorPublic = asyncHandler(async (req, res) => {
  const id = String(req.params.id || '');
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });

  const item = await Vendor.findById(id).lean();
  if (!item) return res.status(404).json({ error: 'NOT_FOUND' });

  res.json({ item });
});

module.exports = { getVendorPublic };

