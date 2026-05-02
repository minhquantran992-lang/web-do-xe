const Part = require('../models/Part');
const { asyncHandler } = require('../middleware/asyncHandler');

const listParts = asyncHandler(async (req, res) => {
  const type = String(req.query?.type || '').trim();
  const q = type ? { type } : {};
  const parts = await Part.find(q).sort({ createdAt: -1 }).lean();
  const items = (Array.isArray(parts) ? parts : []).map((p) => ({
    ...p,
    mount_point: String(p?.mountPoint || '').trim(),
    bounding_box: p?.boundingBox && typeof p.boundingBox === 'object' ? p.boundingBox : { x: 0, y: 0, z: 0 },
    compatibility_tags: Array.isArray(p?.compatibilityTags) ? p.compatibilityTags : [],
    exclusion_tags: Array.isArray(p?.exclusionTags) ? p.exclusionTags : []
  }));
  res.json({ items });
});

module.exports = { listParts };
