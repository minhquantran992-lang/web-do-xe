const mongoose = require('mongoose');

const Configuration = require('../models/Configuration');
const { asyncHandler } = require('../middleware/asyncHandler');

const getVendorBuildDetail = asyncHandler(async (req, res) => {
  const vendorId = String(req.vendor?._id || '').trim();
  const id = String(req.params?.id || '').trim();
  if (!vendorId) return res.status(403).json({ error: 'FORBIDDEN' });
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_BUILD' });

  const item = await Configuration.findById(id)
    .populate('userId', 'name avatar email phone')
    .populate('carId', 'name thumbnailUrl modelUrl model3d emissions')
    .populate('selectedWheels', 'name type price thumbnailUrl modelUrl emissions mountPoint mountPoints')
    .populate('selectedParts', 'name type price thumbnailUrl modelUrl emissions mountPoint mountPoints')
    .lean();
  if (!item) return res.status(404).json({ error: 'BUILD_NOT_FOUND' });

  res.json({ item });
});

module.exports = { getVendorBuildDetail };
