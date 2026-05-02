const mongoose = require('mongoose');

const Part = require('../models/Part');
const Configuration = require('../models/Configuration');
const { asyncHandler } = require('../middleware/asyncHandler');
const { buildSearchText } = require('../utils/search');

const allowedSpecKeysByType = {
  exhaust: ['powerHp', 'torqueNm', 'weightKg', 'topSpeedKph'],
  clutch: ['torqueNm'],
  wheels: ['weightKg', 'topSpeedKph'],
  brake: ['weightKg'],
  suspension: ['weightKg'],
  tire: ['topSpeedKph', 'weightKg'],
  handlebar: ['weightKg'],
  bodykit: ['weightKg'],
  seat: ['weightKg'],
  lighting: ['weightKg'],
  throttle_housing: ['powerHp', 'torqueNm', 'topSpeedKph'],
  topbox: ['weightKg']
};

const allowedEmissionKeysByType = {
  exhaust: ['coMultiplier', 'hcMultiplier', 'hasCatalytic'],
  clutch: ['coMultiplier', 'hcMultiplier'],
  wheels: ['coMultiplier', 'hcMultiplier'],
  brake: ['coMultiplier', 'hcMultiplier'],
  suspension: ['coMultiplier', 'hcMultiplier'],
  tire: ['coMultiplier', 'hcMultiplier'],
  handlebar: ['coMultiplier', 'hcMultiplier'],
  bodykit: ['coMultiplier', 'hcMultiplier'],
  seat: ['coMultiplier', 'hcMultiplier'],
  lighting: ['coMultiplier', 'hcMultiplier'],
  throttle_housing: ['coMultiplier', 'hcMultiplier'],
  topbox: ['coMultiplier', 'hcMultiplier']
};

const parseNumberFlexible = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const raw = String(value || '').trim();
  if (!raw) return null;

  const match = raw.replace(/\s+/g, '').match(/-?[\d.,]+/);
  if (!match) return null;

  let token = String(match[0] || '');
  if (token.includes('.') && token.includes(',')) {
    const lastDot = token.lastIndexOf('.');
    const lastComma = token.lastIndexOf(',');
    if (lastComma > lastDot) token = token.replace(/\./g, '').replace(',', '.');
    else token = token.replace(/,/g, '');
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

const normalizeTags = (value) => {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,\n]/g)
      : [];
  const out = [];
  for (const x of raw) {
    const t = String(x || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');
    if (!t) continue;
    if (!out.includes(t)) out.push(t);
  }
  return out.slice(0, 50);
};

const normalizeBoundingBox = (raw) => {
  const v = raw && typeof raw === 'object' ? raw : {};
  const pick = (k) => parseNumberFlexible(v?.[k]);
  const x = pick('x') ?? pick('width') ?? pick('w') ?? 0;
  const y = pick('y') ?? pick('height') ?? pick('h') ?? 0;
  const z = pick('z') ?? pick('depth') ?? pick('d') ?? 0;
  return { x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : 0, z: Number.isFinite(z) ? z : 0 };
};

const normalizePartSpecs = (raw, type) => {
  const s = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const allowedKeys = allowedSpecKeysByType[String(type || '').trim()] || [];
  const out = {};
  for (const key of allowedKeys) {
    if (s[key] === undefined) continue;
    out[key] = parseNumberFlexible(s[key]);
  }
  return out;
};

const filterSpecsToAllowedKeys = (raw, type) => {
  const s = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const allowedKeys = allowedSpecKeysByType[String(type || '').trim()] || [];
  const out = {};
  for (const key of allowedKeys) {
    if (s[key] === undefined) continue;
    out[key] = parseNumberFlexible(s[key]);
  }
  return out;
};

const normalizeBoolean = (value, fallback) => {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const s = String(value || '').trim().toLowerCase();
  if (s === '1' || s === 'true' || s === 'yes' || s === 'y') return true;
  if (s === '0' || s === 'false' || s === 'no' || s === 'n') return false;
  return fallback;
};

const normalizePartEmissions = (raw, type) => {
  const e = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const allowedKeys = allowedEmissionKeysByType[String(type || '').trim()] || [];
  const out = {};
  for (const key of allowedKeys) {
    if (e[key] === undefined) continue;
    if (key === 'hasCatalytic') out[key] = normalizeBoolean(e[key], true);
    else out[key] = parseNumberFlexible(e[key]);
  }
  if (String(type || '').trim() === 'exhaust') {
    if (out.coMultiplier === null) delete out.coMultiplier;
    if (out.hcMultiplier === null) delete out.hcMultiplier;
  }
  return out;
};

const filterEmissionsToAllowedKeys = (raw, type) => {
  const e = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const allowedKeys = allowedEmissionKeysByType[String(type || '').trim()] || [];
  const out = {};
  for (const key of allowedKeys) {
    if (e[key] === undefined) continue;
    if (key === 'hasCatalytic') out[key] = normalizeBoolean(e[key], true);
    else out[key] = parseNumberFlexible(e[key]);
  }
  return out;
};

const listPartsAdmin = asyncHandler(async (req, res) => {
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

const createPartAdmin = asyncHandler(async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const type = String(req.body?.type || '').trim();
  const thumbnailUrl = String(req.body?.thumbnailUrl || req.body?.thumbnail_url || '').trim();
  const modelUrl = String(req.body?.modelUrl || req.body?.model_url || '').trim();
  const mountPoint = String(req.body?.mountPoint || req.body?.mount_point || '').trim();
  const variantKey = String(req.body?.variantKey || req.body?.variant_key || '').trim();
  const mountPointsRaw = req.body?.mountPoints || req.body?.mount_points;
  const mountPoints = Array.isArray(mountPointsRaw)
    ? mountPointsRaw.map((x) => String(x || '').trim()).filter(Boolean)
    : [];
  const boundingBox = normalizeBoundingBox(req.body?.boundingBox || req.body?.bounding_box);
  const compatibilityTags = normalizeTags(req.body?.compatibilityTags || req.body?.compatibility_tags);
  const exclusionTags = normalizeTags(req.body?.exclusionTags || req.body?.exclusion_tags);
  const priceRaw = req.body?.price;
  const priceNum = priceRaw === null || priceRaw === undefined || priceRaw === '' ? 0 : Number(priceRaw);
  const price = Number.isFinite(priceNum) ? priceNum : 0;
  const specsRaw = typeof req.body?.specs === 'object' && !Array.isArray(req.body?.specs) ? req.body.specs : {};
  const specs = normalizePartSpecs(specsRaw, type);
  const emissionsRaw =
    req.body?.emissions && typeof req.body.emissions === 'object' && !Array.isArray(req.body.emissions) ? req.body.emissions : {};
  const emissions = normalizePartEmissions(emissionsRaw, type);

  if (!name) return res.status(400).json({ error: 'MISSING_NAME' });
  if (!type) return res.status(400).json({ error: 'MISSING_TYPE' });

  const doc = await Part.create({
    name,
    type,
    variantKey,
    thumbnailUrl,
    modelUrl,
    mountPoint,
    mountPoints,
    boundingBox,
    compatibilityTags,
    exclusionTags,
    price,
    specs,
    emissions
  });

  res.status(201).json({ item: doc });
});

const updatePartAdmin = asyncHandler(async (req, res) => {
  const id = String(req.params.id || '');
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });

  const existing = await Part.findById(id).lean();
  if (!existing) return res.status(404).json({ error: 'NOT_FOUND' });

  const patch = {};
  if (req.body?.name !== undefined) patch.name = String(req.body.name || '').trim();
  if (req.body?.type !== undefined) patch.type = String(req.body.type || '').trim();
  if (req.body?.thumbnailUrl !== undefined) patch.thumbnailUrl = String(req.body.thumbnailUrl || '').trim();
  if (req.body?.modelUrl !== undefined) patch.modelUrl = String(req.body.modelUrl || '').trim();
  if (req.body?.mountPoint !== undefined) patch.mountPoint = String(req.body.mountPoint || '').trim();
  if (req.body?.mountPoints !== undefined) {
    const arr = Array.isArray(req.body.mountPoints) ? req.body.mountPoints : [];
    patch.mountPoints = arr.map((x) => String(x || '').trim()).filter(Boolean);
  }
  if (req.body?.variantKey !== undefined) patch.variantKey = String(req.body.variantKey || '').trim();
  if (req.body?.boundingBox !== undefined || req.body?.bounding_box !== undefined) {
    patch.boundingBox = normalizeBoundingBox(req.body?.boundingBox || req.body?.bounding_box);
  }
  if (req.body?.compatibilityTags !== undefined || req.body?.compatibility_tags !== undefined) {
    patch.compatibilityTags = normalizeTags(req.body?.compatibilityTags || req.body?.compatibility_tags);
  }
  if (req.body?.exclusionTags !== undefined || req.body?.exclusion_tags !== undefined) {
    patch.exclusionTags = normalizeTags(req.body?.exclusionTags || req.body?.exclusion_tags);
  }
  if (req.body?.price !== undefined) {
    const priceRaw = req.body.price;
    patch.price = priceRaw === null || priceRaw === '' ? 0 : Number(priceRaw);
    if (!Number.isFinite(patch.price)) patch.price = 0;
  }
  const nextType = patch.type ?? existing.type;
  if (req.body?.specs !== undefined && typeof req.body.specs === 'object') {
    const normalized = normalizePartSpecs(req.body.specs, nextType);
    const merged = { ...(existing?.specs && typeof existing.specs === 'object' ? existing.specs : {}), ...normalized };
    patch.specs = filterSpecsToAllowedKeys(merged, nextType);
  } else if (patch.type !== undefined && String(patch.type) !== String(existing.type)) {
    patch.specs = filterSpecsToAllowedKeys(existing?.specs, nextType);
  }

  if (req.body?.emissions !== undefined && typeof req.body.emissions === 'object') {
    const normalized = normalizePartEmissions(req.body.emissions, nextType);
    const merged = {
      ...(existing?.emissions && typeof existing.emissions === 'object' ? existing.emissions : {}),
      ...normalized
    };
    patch.emissions = filterEmissionsToAllowedKeys(merged, nextType);
  } else if (patch.type !== undefined && String(patch.type) !== String(existing.type)) {
    patch.emissions = filterEmissionsToAllowedKeys(existing?.emissions, nextType);
  }
  if (patch.name !== undefined || patch.type !== undefined) {
    const nextName = patch.name ?? existing.name;
    patch.searchText = buildSearchText(nextName, nextType, id);
  }

  const updated = await Part.findByIdAndUpdate(id, patch, { new: true }).lean();

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
