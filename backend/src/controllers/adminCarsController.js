const mongoose = require('mongoose');

const Car = require('../models/Car');
const Configuration = require('../models/Configuration');
const { asyncHandler } = require('../middleware/asyncHandler');
const { buildSearchText } = require('../utils/search');

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

const clampNum = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const normalizeAnchorName = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_:-]+/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

const normalizeAnchors = (value) => {
  const arr = Array.isArray(value) ? value : [];
  const out = [];
  const seen = new Set();
  for (const a of arr) {
    const rawName = String(a?.name || '').trim();
    const name = normalizeAnchorName(rawName);
    if (!name) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    const category = String(a?.category || '').trim().toLowerCase();
    const pos = Array.isArray(a?.position) ? a.position : [0, 0, 0];
    const rot = Array.isArray(a?.rotation) ? a.rotation : [0, 0, 0];
    out.push({
      id: String(a?.id || name).trim() || name,
      name,
      category,
      position: [clampNum(pos[0]), clampNum(pos[1]), clampNum(pos[2])],
      rotation: [clampNum(rot[0]), clampNum(rot[1]), clampNum(rot[2])]
    });
  }
  return out;
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
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const raw = String(value || '').trim();
  if (!raw) return null;
  const match = raw.replace(/\s+/g, '').match(/-?[\d.,]+/);
  if (!match) return null;
  let token = String(match[0] || '');
  if (token.includes('.') && token.includes(',')) {
    const lastDot = token.lastIndexOf('.');
    const lastComma = token.lastIndexOf(',');
    if (lastComma > lastDot) {
      token = token.replace(/\./g, '').replace(',', '.');
    } else {
      token = token.replace(/,/g, '');
    }
  } else if (token.includes(',')) {
    const parts = token.split(',');
    if (parts.length === 2 && parts[1].length === 3) token = parts.join('');
    else if (parts.length === 2) token = `${parts[0]}.${parts[1]}`;
    else token = parts.join('');
  } else if (token.includes('.')) {
    const parts = token.split('.');
    if (parts.length > 2) {
      const last = parts[parts.length - 1];
      if (last.length === 3) token = parts.join('');
      else token = `${parts.slice(0, -1).join('')}.${last}`;
    }
  }
  const n = Number(token);
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

const normalizeEmissions = (raw) => {
  const s = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const euroRaw = s.euroStandard ?? s.euro_standard ?? s.euro ?? s.standard;
  return {
    co: s.co !== undefined ? normalizeNumberOrNull(s.co) : undefined,
    hc: s.hc !== undefined ? normalizeNumberOrNull(s.hc) : undefined,
    euroStandard: euroRaw !== undefined ? normalizeText(euroRaw) : undefined
  };
};

const pickDefined = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

const normalizeComboKey = (raw) =>
  String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const normalizeCombos = (raw) => {
  const list = Array.isArray(raw) ? raw : [];
  const out = [];
  for (const item of list) {
    const key = normalizeComboKey(item?.key);
    if (!key) continue;
    const title = String(item?.title || '').trim();
    const modelKey = normalizeComboKey(item?.modelKey || '');
    const sortOrderNum = Number(item?.sortOrder);
    const sortOrder = Number.isFinite(sortOrderNum) ? sortOrderNum : 0;
    const rawSlots = item?.slots;
    const slotsObj =
      rawSlots instanceof Map
        ? Object.fromEntries(rawSlots.entries())
        : rawSlots && typeof rawSlots === 'object'
          ? rawSlots
          : {};
    const slots = {};
    for (const [slot, id] of Object.entries(slotsObj || {})) {
      const s = String(slot || '').trim();
      const v = String(id || '').trim();
      if (!s) continue;
      if (!v) continue;
      slots[s] = v;
    }
    out.push({ key, title, modelKey, sortOrder, slots });
  }
  return out;
};

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
    anchors: Array.isArray(c.anchors)
      ? c.anchors.map((a) => ({
          id: String(a?.id || '').trim(),
          name: String(a?.name || '').trim(),
          category: String(a?.category || '').trim(),
          position: Array.isArray(a?.position) ? a.position.slice(0, 3).map((x) => Number(x)) : [0, 0, 0],
          rotation: Array.isArray(a?.rotation) ? a.rotation.slice(0, 3).map((x) => Number(x)) : [0, 0, 0]
        }))
      : [],
    combos: Array.isArray(c.combos)
      ? c.combos.map((x) => ({
          key: String(x?.key || '').trim(),
          title: String(x?.title || '').trim(),
          modelKey: String(x?.modelKey || '').trim(),
          sortOrder: Number.isFinite(Number(x?.sortOrder)) ? Number(x.sortOrder) : 0,
          slots:
            x?.slots instanceof Map
              ? Object.fromEntries(x.slots.entries())
              : x?.slots && typeof x.slots === 'object'
                ? x.slots
                : {}
        }))
      : [],
    combinedModelSlots: Array.isArray(c.combinedModelSlots) ? c.combinedModelSlots : [],
    combinedModels:
      c.combinedModels instanceof Map
        ? Object.fromEntries(c.combinedModels.entries())
        : c.combinedModels && typeof c.combinedModels === 'object'
          ? c.combinedModels
          : {},
    specs: c.specs || {},
    emissions: c.emissions || {},
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
  const emissionsInput =
    req.body?.emissions !== undefined || req.body?.emission !== undefined
      ? req.body?.emissions || req.body?.emission
      : { co: req.body?.co, hc: req.body?.hc, euroStandard: req.body?.euroStandard ?? req.body?.euro_standard };
  const emissions = pickDefined(normalizeEmissions(emissionsInput || {}));

  if (!name) return res.status(400).json({ error: 'MISSING_NAME' });
  const model3d = model3dRaw || pickModel3d({ name, brand });

  const doc = await Car.create({
    name,
    brand,
    category,
    engineCc,
    image,
    model3d,
    combos: normalizeCombos(req.body?.combos),
    combinedModelSlots: Array.isArray(req.body?.combinedModelSlots) ? req.body.combinedModelSlots : [],
    combinedModels: req.body?.combinedModels && typeof req.body.combinedModels === 'object' ? req.body.combinedModels : {},
    specs,
    emissions,
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
      anchors: Array.isArray(doc.anchors)
        ? doc.anchors.map((a) => ({
            id: String(a?.id || '').trim(),
            name: String(a?.name || '').trim(),
            category: String(a?.category || '').trim(),
            position: Array.isArray(a?.position) ? a.position.slice(0, 3).map((x) => Number(x)) : [0, 0, 0],
            rotation: Array.isArray(a?.rotation) ? a.rotation.slice(0, 3).map((x) => Number(x)) : [0, 0, 0]
          }))
        : [],
      combos: Array.isArray(doc.combos)
        ? doc.combos.map((x) => ({
            key: String(x?.key || '').trim(),
            title: String(x?.title || '').trim(),
            modelKey: String(x?.modelKey || '').trim(),
            sortOrder: Number.isFinite(Number(x?.sortOrder)) ? Number(x.sortOrder) : 0,
            slots:
              x?.slots instanceof Map
                ? Object.fromEntries(x.slots.entries())
                : x?.slots && typeof x.slots === 'object'
                  ? x.slots
                  : {}
          }))
        : [],
      combinedModelSlots: Array.isArray(doc.combinedModelSlots) ? doc.combinedModelSlots : [],
      combinedModels:
        doc.combinedModels instanceof Map
          ? Object.fromEntries(doc.combinedModels.entries())
          : doc.combinedModels && typeof doc.combinedModels === 'object'
            ? doc.combinedModels
            : {},
      specs: doc.specs || {},
      emissions: doc.emissions || {},
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
  if (req.body?.anchors !== undefined) patch.anchors = normalizeAnchors(req.body.anchors);
  if (req.body?.combos !== undefined) {
    patch.combos = normalizeCombos(req.body.combos);
  }
  if (req.body?.combinedModelSlots !== undefined) {
    patch.combinedModelSlots = Array.isArray(req.body.combinedModelSlots)
      ? req.body.combinedModelSlots.map((x) => String(x || '').trim()).filter(Boolean)
      : [];
  }
  if (req.body?.combinedModels !== undefined) {
    patch.combinedModels = req.body.combinedModels && typeof req.body.combinedModels === 'object' ? req.body.combinedModels : {};
  }

  const specsInput = req.body?.specs !== undefined || req.body?.spec !== undefined ? req.body?.specs || req.body?.spec : undefined;
  if (specsInput !== undefined) {
    const next = { ...(existing.specs || {}), ...pickDefined(normalizeSpecs(specsInput)) };
    patch.specs = next;
  }

  const emissionsInput =
    req.body?.emissions !== undefined || req.body?.emission !== undefined
      ? req.body?.emissions || req.body?.emission
      : req.body?.co !== undefined || req.body?.hc !== undefined || req.body?.euroStandard !== undefined || req.body?.euro_standard !== undefined
        ? { co: req.body?.co, hc: req.body?.hc, euroStandard: req.body?.euroStandard ?? req.body?.euro_standard }
        : undefined;
  if (emissionsInput !== undefined) {
    const next = { ...(existing.emissions || {}), ...pickDefined(normalizeEmissions(emissionsInput)) };
    patch.emissions = next;
  }

  if (patch.image !== undefined) patch.thumbnailUrl = patch.image;
  if (patch.model3d !== undefined) patch.modelUrl = patch.model3d;
  if (patch.name !== undefined || patch.brand !== undefined || patch.category !== undefined) {
    const nextName = patch.name ?? existing.name;
    const nextBrand = patch.brand ?? existing.brand;
    const nextCategory = patch.category ?? existing.category;
    patch.searchText = buildSearchText(nextName, nextBrand, nextCategory, id);
  }

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
      anchors: Array.isArray(doc.anchors)
        ? doc.anchors.map((a) => ({
            id: String(a?.id || '').trim(),
            name: String(a?.name || '').trim(),
            category: String(a?.category || '').trim(),
            position: Array.isArray(a?.position) ? a.position.slice(0, 3).map((x) => Number(x)) : [0, 0, 0],
            rotation: Array.isArray(a?.rotation) ? a.rotation.slice(0, 3).map((x) => Number(x)) : [0, 0, 0]
          }))
        : [],
      combos: Array.isArray(doc.combos)
        ? doc.combos.map((x) => ({
            key: String(x?.key || '').trim(),
            title: String(x?.title || '').trim(),
            modelKey: String(x?.modelKey || '').trim(),
            sortOrder: Number.isFinite(Number(x?.sortOrder)) ? Number(x.sortOrder) : 0,
            slots:
              x?.slots instanceof Map
                ? Object.fromEntries(x.slots.entries())
                : x?.slots && typeof x.slots === 'object'
                  ? x.slots
                  : {}
          }))
        : [],
      combinedModelSlots: Array.isArray(doc.combinedModelSlots) ? doc.combinedModelSlots : [],
      combinedModels:
        doc.combinedModels instanceof Map
          ? Object.fromEntries(doc.combinedModels.entries())
          : doc.combinedModels && typeof doc.combinedModels === 'object'
            ? doc.combinedModels
            : {},
      specs: doc.specs || {},
      emissions: doc.emissions || {},
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

const uploadCombinedModelAdmin = asyncHandler(async (req, res) => {
  const id = String(req.params.id || '');
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });

  const file = req.file;
  if (!file) return res.status(400).json({ error: 'MISSING_FILE' });

  const keyRaw = req.body?.comboKey ?? req.body?.key;
  const comboKey = normalizeComboKey(keyRaw);
  if (!comboKey) return res.status(400).json({ error: 'MISSING_COMBO_KEY' });

  const existing = await Car.findById(id).lean();
  if (!existing) return res.status(404).json({ error: 'NOT_FOUND' });

  const url = `/uploads/combined-models/${file.filename}`;

  await Car.updateOne(
    { _id: id },
    { $set: { [`combinedModels.${comboKey}`]: url } }
  );

  const doc = await Car.findById(id).lean();
  return res.status(201).json({
    ok: true,
    key: comboKey,
    url,
    item: {
      _id: doc._id,
      name: doc.name,
      brand: doc.brand || '',
      category: doc.category || '',
      engineCc: Number.isFinite(doc.engineCc) ? doc.engineCc : doc.engineCc ?? null,
      image: doc.image || doc.thumbnailUrl || '',
      model3d: doc.model3d || doc.modelUrl || '',
      anchors: Array.isArray(doc.anchors)
        ? doc.anchors.map((a) => ({
            id: String(a?.id || '').trim(),
            name: String(a?.name || '').trim(),
            category: String(a?.category || '').trim(),
            position: Array.isArray(a?.position) ? a.position.slice(0, 3).map((x) => Number(x)) : [0, 0, 0],
            rotation: Array.isArray(a?.rotation) ? a.rotation.slice(0, 3).map((x) => Number(x)) : [0, 0, 0]
          }))
        : [],
      combos: Array.isArray(doc.combos)
        ? doc.combos.map((x) => ({
            key: String(x?.key || '').trim(),
            title: String(x?.title || '').trim(),
            modelKey: String(x?.modelKey || '').trim(),
            sortOrder: Number.isFinite(Number(x?.sortOrder)) ? Number(x.sortOrder) : 0,
            slots:
              x?.slots instanceof Map
                ? Object.fromEntries(x.slots.entries())
                : x?.slots && typeof x.slots === 'object'
                  ? x.slots
                  : {}
          }))
        : [],
      combinedModelSlots: Array.isArray(doc.combinedModelSlots) ? doc.combinedModelSlots : [],
      combinedModels:
        doc.combinedModels instanceof Map
          ? Object.fromEntries(doc.combinedModels.entries())
          : doc.combinedModels && typeof doc.combinedModels === 'object'
            ? doc.combinedModels
            : {},
      specs: doc.specs || {},
      emissions: doc.emissions || {},
      createdAt: doc.createdAt
    }
  });
});

const deleteCombinedModelAdmin = asyncHandler(async (req, res) => {
  const id = String(req.params.id || '');
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });

  const keyRaw = req.query?.key ?? req.body?.key;
  const comboKey = normalizeComboKey(keyRaw);
  if (!comboKey) return res.status(400).json({ error: 'MISSING_COMBO_KEY' });

  const existing = await Car.findById(id).lean();
  if (!existing) return res.status(404).json({ error: 'NOT_FOUND' });

  await Car.updateOne({ _id: id }, { $unset: { [`combinedModels.${comboKey}`]: 1 } });
  return res.json({ ok: true });
});

module.exports = {
  listCarsAdmin,
  createCarAdmin,
  updateCarAdmin,
  deleteCarAdmin,
  uploadModelAdmin,
  uploadCombinedModelAdmin,
  deleteCombinedModelAdmin
};
