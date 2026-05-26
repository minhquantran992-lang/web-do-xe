const { asyncHandler } = require('../../../middleware/asyncHandler');
const partsService = require('../services/partsService');

const listParts = asyncHandler(async (req, res) => {
  const type = String(req.query?.type || '').trim();
  const carId = String(req.query?.carId || req.query?.bikeId || '').trim();
  const strictRaw = req.query?.strict ?? req.query?.onlyCompatible ?? req.query?.only_compatible;
  const strictExplicit =
    strictRaw === true ||
    strictRaw === 1 ||
    strictRaw === '1' ||
    String(strictRaw || '').trim().toLowerCase() === 'true';
  const strict = carId ? (strictRaw === undefined ? true : strictExplicit) : strictExplicit;
  const items = await partsService.listParts({ type, carId, strict });
  res.json({ items });
});

module.exports = { listParts };
