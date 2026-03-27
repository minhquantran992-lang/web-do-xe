const BackgroundPreset = require('../models/BackgroundPreset');
const { asyncHandler } = require('../middleware/asyncHandler');

const listBackgrounds = asyncHandler(async (_req, res) => {
  const items = await BackgroundPreset.find({ enabled: true })
    .sort({ sortOrder: 1, createdAt: -1 })
    .select('key label kind color css imageUrl enabled sortOrder')
    .lean();
  res.json({ items });
});

module.exports = { listBackgrounds };

