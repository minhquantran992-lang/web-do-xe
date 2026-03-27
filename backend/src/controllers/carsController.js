const Car = require('../models/Car');
const Configuration = require('../models/Configuration');
const { asyncHandler } = require('../middleware/asyncHandler');

const listCars = asyncHandler(async (req, res) => {
  const withMetrics = String(req.query?.metrics || '').trim() === '1';
  const cars = await Car.find({}).sort({ createdAt: -1 }).lean();

  let modCountByCarId = new Map();
  if (withMetrics) {
    const rows = await Configuration.aggregate([
      { $group: { _id: '$carId', count: { $sum: 1 } } }
    ]);
    modCountByCarId = new Map(rows.map((r) => [String(r._id), Number(r.count) || 0]));
  }

  const items = cars.map((c) => ({
    _id: c._id,
    name: c.name,
    brand: c.brand || '',
    category: c.category || '',
    engineCc: Number.isFinite(c.engineCc) ? c.engineCc : c.engineCc ?? null,
    image: c.image || c.thumbnailUrl || '',
    model3d: c.model3d || c.modelUrl || '',
    specs: c.specs || {},
    createdAt: c.createdAt,
    modCount: withMetrics ? modCountByCarId.get(String(c._id)) || 0 : undefined
  }));
  res.json({ items });
});

module.exports = { listCars };
