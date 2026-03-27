const mongoose = require('mongoose');

const Part = require('../models/Part');
const Configuration = require('../models/Configuration');
const { asyncHandler } = require('../middleware/asyncHandler');

const listPartsAdmin = asyncHandler(async (req, res) => {
  const type = String(req.query?.type || '').trim();
  const q = type ? { type } : {};
  const parts = await Part.find(q).sort({ createdAt: -1 }).lean();
  res.json({ items: parts });
});

const createPartAdmin = asyncHandler(async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const type = String(req.body?.type || '').trim();
  const thumbnailUrl = String(req.body?.thumbnailUrl || req.body?.thumbnail_url || '').trim();
  const modelUrl = String(req.body?.modelUrl || req.body?.model_url || '').trim();
  const mountPoint = String(req.body?.mountPoint || req.body?.mount_point || '').trim();
  const mountPointsRaw = req.body?.mountPoints || req.body?.mount_points;
  const mountPoints = Array.isArray(mountPointsRaw)
    ? mountPointsRaw.map((x) => String(x || '').trim()).filter(Boolean)
    : [];
  const priceRaw = req.body?.price;
  const priceNum = priceRaw === null || priceRaw === undefined || priceRaw === '' ? 0 : Number(priceRaw);
  const price = Number.isFinite(priceNum) ? priceNum : 0;
  const specs = typeof req.body?.specs === 'object' && !Array.isArray(req.body?.specs) ? req.body.specs : {};

  if (!name) return res.status(400).json({ error: 'MISSING_NAME' });
  if (!type) return res.status(400).json({ error: 'MISSING_TYPE' });
  if (!modelUrl) return res.status(400).json({ error: 'MISSING_MODEL_URL' });

  const doc = await Part.create({
    name,
    type,
    thumbnailUrl,
    modelUrl,
    mountPoint,
    mountPoints,
    price,
    specs
  });

  res.status(201).json({ item: doc });
});

const updatePartAdmin = asyncHandler(async (req, res) => {
  const id = String(req.params.id || '');
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });

  const patch = {};
  if (req.body?.name !== undefined) patch.name = String(req.body.name || '').trim();
  if (req.body?.type !== undefined) patch.type = String(req.body.type || '').trim();
  if (req.body?.thumbnailUrl !== undefined) patch.thumbnailUrl = String(req.body.thumbnailUrl || '').trim();
  if (req.body?.modelUrl !== undefined) patch.modelUrl = String(req.body.modelUrl || '').trim();
  if (req.body?.mountPoint !== undefined) patch.mountPoint = String(req.body.mountPoint || '').trim();
  if (req.body?.price !== undefined) {
    const priceRaw = req.body.price;
    patch.price = priceRaw === null || priceRaw === '' ? 0 : Number(priceRaw);
    if (!Number.isFinite(patch.price)) patch.price = 0;
  }
  if (req.body?.specs !== undefined && typeof req.body.specs === 'object') patch.specs = req.body.specs;

  const updated = await Part.findByIdAndUpdate(id, patch, { new: true }).lean();
  if (!updated) return res.status(404).json({ error: 'NOT_FOUND' });

  res.json({ item: updated });
});

const deletePartAdmin = asyncHandler(async (req, res) => {
  const id = String(req.params.id || '');
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });

  const deleted = await Part.findByIdAndDelete(id).lean();
  if (!deleted) return res.status(404).json({ error: 'NOT_FOUND' });

  await Configuration.updateMany({ selectedWheels: id }, { $set: { selectedWheels: null } });
  await Configuration.updateMany({ selectedParts: id }, { $pull: { selectedParts: id } });

  res.json({ ok: true });
});

const uploadModelPartAdmin = asyncHandler(async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'MISSING_FILE' });
  res.status(201).json({ url: `/uploads/models/${file.filename}` });
});

module.exports = { listPartsAdmin, createPartAdmin, updatePartAdmin, deletePartAdmin, uploadModelPartAdmin };
