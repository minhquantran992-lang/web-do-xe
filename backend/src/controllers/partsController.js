const Part = require('../models/Part');
const { asyncHandler } = require('../middleware/asyncHandler');

const listParts = asyncHandler(async (req, res) => {
  const type = String(req.query?.type || '').trim();
  const q = type ? { type } : {};
  const parts = await Part.find(q).sort({ createdAt: -1 }).lean();
  res.json({ items: parts });
});

module.exports = { listParts };

