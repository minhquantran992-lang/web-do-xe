const { asyncHandler } = require('../../../middleware/asyncHandler');
const carsService = require('../services/carsService');

const listCars = asyncHandler(async (req, res) => {
  const withMetrics = String(req.query?.metrics || '').trim() === '1';
  const data = await carsService.listCars({ withMetrics });
  res.json(data);
});

const listCarModels = asyncHandler(async (req, res) => {
  const data = await carsService.listCarModels();
  res.json(data);
});

module.exports = { listCars, listCarModels };
