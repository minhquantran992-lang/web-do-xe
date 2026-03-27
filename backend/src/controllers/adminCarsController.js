const mongoose = require('mongoose');

const Car = require('../models/Car');
const Configuration = require('../models/Configuration');
const { asyncHandler } = require('../middleware/asyncHandler');

const DEFAULT_MODEL3D =
  process.env.DEFAULT_MODEL3D ||
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Buggy/glTF-Binary/Buggy.glb';

const normalize = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[\s\-_.]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim();

const MODEL_LIBRARY = {
  'mclaren p1': '/uploads/models/mclarenp1.glb',
  'porsche 911':
    'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/VC/glTF-Binary/VC.glb',
  'nissan 350z':
    'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/CesiumMilkTruck/glTF-Binary/CesiumMilkTruck.glb'
};

const pickModel3d = ({ name, brand }) => {
  const key = normalize(name);
  if (MODEL_LIBRARY[key]) return MODEL_LIBRARY[key];
  const brandKey = normalize(brand);
  if (brandKey) {
    const brandNameKey = normalize(`${brandKey} ${key}`);
    if (MODEL_LIBRARY[brandNameKey]) return MODEL_LIBRARY[brandNameKey];
  }
  return DEFAULT_MODEL3D;
};

const normalizeNumberOrNull = (value) => {
  if (value === null || value === undefined) return null;
  if (value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const normalizeText = (value) => String(value || '').trim();

const normalizeSpecs = (raw) => {
  const s = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return {
    powerHp: s.powerHp !== undefined ? normalizeNumberOrNull(s.powerHp) : undefined,
    torqueNm: s.torqueNm !== undefined ? normalizeNumberOrNull(s.torqueNm) : undefined,
    weightKg: s.weightKg !== undefined ? normalizeNumberOrNull(s.weightKg) : undefined,
    topSpeedKph: s.topSpeedKph !== undefined ? normalizeNumberOrNull(s.topSpeedKph) : undefined,
    fuelL: s.fuelL !== undefined ? normalizeNumberOrNull(s.fuelL) : undefined,
    engineType: s.engineType !== undefined ? normalizeText(s.engineType) : undefined,
    gearbox: s.gearbox !== undefined ? normalizeText(s.gearbox) : undefined
  };
};

const pickDefined = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

const listCarsAdmin = asyncHandler(async (req, res) => {
  const cars = await Car.find({}).sort({ createdAt: -1 }).lean();
  const items = cars.map((c) => ({
    _id: c._id,
    name: c.name,
    brand: c.brand || '',
    category: c.category || '',
    engineCc: Number.isFinite(c.engineCc) ? c.engineCc : c.engineCc ?? null,
    image: c.image || c.thumbnailUrl || '',
    model3d: c.model3d || c.modelUrl || '',
    specs: c.specs || {},
    createdAt: c.createdAt
  }));
  res.json({ items });
});

const createCarAdmin = asyncHandler(async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const brand = String(req.body?.brand || '').trim();
  const category = String(req.body?.category || '').trim();
  const engineCcRaw = req.body?.engineCc ?? req.body?.engine_cc ?? req.body?.engineCC;
  const engineCc = normalizeNumberOrNull(engineCcRaw);
  const image = String(req.body?.image || '').trim();
  const model3dRaw = String(req.body?.model3d || '').trim();
  const specs = pickDefined(normalizeSpecs(req.body?.specs || req.body?.spec || {}));

  if (!name) return res.status(400).json({ error: 'MISSING_NAME' });
  const model3d = model3dRaw || pickModel3d({ name, brand });

  const doc = await Car.create({
    name,
    brand,
    category,
    engineCc,
    image,
    model3d,
    specs,
    thumbnailUrl: image,
    modelUrl: model3d
  });

  res.status(201).json({
    item: {
      _id: doc._id,
      name: doc.name,
      brand: doc.brand || '',
      category: doc.category || '',
      engineCc: Number.isFinite(doc.engineCc) ? doc.engineCc : doc.engineCc ?? null,
      image: doc.image || '',
      model3d: doc.model3d || '',
      specs: doc.specs || {},
      createdAt: doc.createdAt
    }
  });
});

const updateCarAdmin = asyncHandler(async (req, res) => {
  const id = String(req.params.id || '');
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });

  const existing = await Car.findById(id).lean();
  if (!existing) return res.status(404).json({ error: 'NOT_FOUND' });

  const patch = {};
  if (req.body?.name !== undefined) {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'MISSING_NAME' });
    patch.name = name;
  }
  if (req.body?.brand !== undefined) patch.brand = String(req.body?.brand || '').trim();
  if (req.body?.category !== undefined) patch.category = String(req.body?.category || '').trim();
  if (req.body?.engineCc !== undefined || req.body?.engine_cc !== undefined || req.body?.engineCC !== undefined) {
    const engineCcRaw = req.body?.engineCc ?? req.body?.engine_cc ?? req.body?.engineCC;
    patch.engineCc = normalizeNumberOrNull(engineCcRaw);
  }
  if (req.body?.image !== undefined) patch.image = String(req.body?.image || '').trim();
  if (req.body?.model3d !== undefined) patch.model3d = String(req.body?.model3d || '').trim();

  const specsInput = req.body?.specs !== undefined || req.body?.spec !== undefined ? req.body?.specs || req.body?.spec : undefined;
  if (specsInput !== undefined) {
    const next = { ...(existing.specs || {}), ...pickDefined(normalizeSpecs(specsInput)) };
    patch.specs = next;
  }

  if (patch.image !== undefined) patch.thumbnailUrl = patch.image;
  if (patch.model3d !== undefined) patch.modelUrl = patch.model3d;

  await Car.updateOne({ _id: id }, { $set: patch });
  const doc = await Car.findById(id).lean();

  res.json({
    item: {
      _id: doc._id,
      name: doc.name,
      brand: doc.brand || '',
      category: doc.category || '',
      engineCc: Number.isFinite(doc.engineCc) ? doc.engineCc : doc.engineCc ?? null,
      image: doc.image || doc.thumbnailUrl || '',
      model3d: doc.model3d || doc.modelUrl || '',
      specs: doc.specs || {},
      createdAt: doc.createdAt
    }
  });
});

const deleteCarAdmin = asyncHandler(async (req, res) => {
  const id = String(req.params.id || '');
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });

  const deleted = await Car.findByIdAndDelete(id).lean();
  if (!deleted) return res.status(404).json({ error: 'NOT_FOUND' });

  await Configuration.deleteMany({ carId: id });
  res.json({ ok: true });
});

const uploadModelAdmin = asyncHandler(async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'MISSING_FILE' });
  res.status(201).json({ url: `/uploads/models/${file.filename}` });
});

module.exports = { listCarsAdmin, createCarAdmin, updateCarAdmin, deleteCarAdmin, uploadModelAdmin };
