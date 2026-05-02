const Brand = require('../models/Brand');
const { asyncHandler } = require('../middleware/asyncHandler');

const normalizeBrandType = (raw) => {
  const v = String(raw || '').trim().toLowerCase();
  if (v === 'pkl' || v === 'scooter' || v === 'oto') return v;
  if (v === 'bike') return 'pkl';
  if (v === 'car') return 'oto';
  return 'pkl';
};

const listBrands = asyncHandler(async (req, res) => {
  const vehicleType = normalizeBrandType(req.query?.vehicleType || req.query?.type);
  const hasFilter = Boolean(String(req.query?.vehicleType || req.query?.type || '').trim());
  const q = !hasFilter
    ? {}
    : vehicleType === 'pkl'
      ? { $or: [{ vehicleType: 'pkl' }, { vehicleType: 'bike' }, { vehicleType: { $exists: false } }] }
      : vehicleType === 'oto'
        ? { $or: [{ vehicleType: 'oto' }, { vehicleType: 'car' }] }
        : { vehicleType: 'scooter' };
  const items = await Brand.find(q).sort({ name: 1 }).lean();
  res.json({ items });
});

module.exports = { listBrands };
