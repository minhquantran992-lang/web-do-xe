const { buildSearchText } = require('../../../utils/search');
const { notifyFollowers } = require('../../../services/notifications');
const { httpError } = require('../../../shared/errors/httpError');
const { normalizeObjectIdArray } = require('../validators/adminPartsValidators');
const { Part } = require('../models/Part');

const allowedSpecKeysByType = {
  exhaust: ['powerHp', 'torqueNm', 'weightKg', 'topSpeedKph', 'soundDb', 'pipeDiameterMm', 'hasDbKiller'],
  clutch: ['torqueNm'],
  wheels: ['weightKg', 'topSpeedKph', 'rimFrontDiameterIn', 'rimFrontWidthIn', 'rimRearDiameterIn', 'rimRearWidthIn'],
  brake: ['weightKg', 'discDiameterMm', 'pistonCount', 'masterCylinderMm'],
  suspension: ['weightKg', 'travelMm', 'lengthMm', 'preloadLevels', 'reboundAdjust', 'compressionAdjust'],
  tire: ['topSpeedKph', 'weightKg', 'tireFrontWidthMm', 'tireFrontAspect', 'tireFrontRimIn', 'tireRearWidthMm', 'tireRearAspect', 'tireRearRimIn', 'isTubeless'],
  handlebar: ['weightKg', 'barWidthMm', 'barRiseMm'],
  bodykit: ['weightKg'],
  seat: ['weightKg'],
  lighting: ['weightKg', 'lumen', 'colorTempK'],
  throttle_housing: ['powerHp', 'torqueNm', 'topSpeedKph'],
  topbox: ['weightKg', 'volumeL', 'maxLoadKg']
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

const booleanSpecKeys = new Set(['hasDbKiller', 'reboundAdjust', 'compressionAdjust', 'isTubeless']);

const parseBooleanFlexible = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const s = String(value || '').trim().toLowerCase();
  if (!s) return null;
  if (s === '1' || s === 'true' || s === 'yes' || s === 'y' || s === 'on') return true;
  if (s === '0' || s === 'false' || s === 'no' || s === 'n' || s === 'off') return false;
  return null;
};

const normalizeTags = (value) => {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,\n]/g) : [];
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
    out[key] = booleanSpecKeys.has(key) ? parseBooleanFlexible(s[key]) : parseNumberFlexible(s[key]);
  }
  return out;
};

const filterSpecsToAllowedKeys = (raw, type) => {
  const s = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const allowedKeys = allowedSpecKeysByType[String(type || '').trim()] || [];
  const out = {};
  for (const key of allowedKeys) {
    if (s[key] === undefined) continue;
    out[key] = booleanSpecKeys.has(key) ? parseBooleanFlexible(s[key]) : parseNumberFlexible(s[key]);
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

const toAdminListItem = (p) => ({
  ...p,
  mount_point: String(p?.mountPoint || '').trim(),
  bounding_box: p?.boundingBox && typeof p.boundingBox === 'object' ? p.boundingBox : { x: 0, y: 0, z: 0 },
  compatibility_tags: Array.isArray(p?.compatibilityTags) ? p.compatibilityTags : [],
  exclusion_tags: Array.isArray(p?.exclusionTags) ? p.exclusionTags : []
});

const listPartsAdmin = async ({ type } = {}) => {
  const cleanType = String(type || '').trim();
  const q = cleanType ? { type: cleanType } : {};
  const parts = await Part.find(q).sort({ createdAt: -1 }).lean();
  return (Array.isArray(parts) ? parts : []).map(toAdminListItem);
};

const createPartAdmin = async (body) => {
  const name = String(body?.name || '').trim();
  const type = String(body?.type || '').trim();
  const thumbnailUrl = String(body?.thumbnailUrl || body?.thumbnail_url || '').trim();
  const modelUrl = String(body?.modelUrl || body?.model_url || '').trim();
  const mountPoint = String(body?.mountPoint || body?.mount_point || '').trim();
  const variantKey = String(body?.variantKey || body?.variant_key || '').trim();
  const anchorType = String(body?.anchorType || body?.anchor_type || '').trim();
  const compatibleCars = normalizeObjectIdArray(body?.compatibleCars || body?.compatible_cars);
  const mountPointsRaw = body?.mountPoints || body?.mount_points;
  const mountPoints = Array.isArray(mountPointsRaw) ? mountPointsRaw.map((x) => String(x || '').trim()).filter(Boolean) : [];
  const boundingBox = normalizeBoundingBox(body?.boundingBox || body?.bounding_box);
  const compatibilityTags = normalizeTags(body?.compatibilityTags || body?.compatibility_tags);
  const exclusionTags = normalizeTags(body?.exclusionTags || body?.exclusion_tags);
  const priceRaw = body?.price;
  const priceNum = priceRaw === null || priceRaw === undefined || priceRaw === '' ? 0 : Number(priceRaw);
  const price = Number.isFinite(priceNum) ? priceNum : 0;
  const specsRaw = typeof body?.specs === 'object' && !Array.isArray(body?.specs) ? body.specs : {};
  const specs = normalizePartSpecs(specsRaw, type);
  const emissionsRaw = body?.emissions && typeof body.emissions === 'object' && !Array.isArray(body.emissions) ? body.emissions : {};
  const emissions = normalizePartEmissions(emissionsRaw, type);

  if (!name) throw httpError(400, 'MISSING_NAME');
  if (!type) throw httpError(400, 'MISSING_TYPE');
  if (!Array.isArray(compatibleCars) || compatibleCars.length === 0) throw httpError(400, 'COMPATIBLE_CARS_REQUIRED');

  const doc = await Part.create({
    name,
    type,
    variantKey,
    thumbnailUrl,
    modelUrl,
    mountPoint,
    mountPoints,
    anchorType,
    compatibleCars,
    boundingBox,
    compatibilityTags,
    exclusionTags,
    price,
    specs,
    emissions,
    searchText: buildSearchText(name, type, '')
  });

  return doc;
};

const updatePartAdmin = async ({ id, body }) => {
  const existing = await Part.findById(id).lean();
  if (!existing) throw httpError(404, 'NOT_FOUND');

  const patch = {};
  if (body?.name !== undefined) patch.name = String(body.name || '').trim();
  if (body?.type !== undefined) patch.type = String(body.type || '').trim();
  if (body?.thumbnailUrl !== undefined) patch.thumbnailUrl = String(body.thumbnailUrl || '').trim();
  if (body?.modelUrl !== undefined) patch.modelUrl = String(body.modelUrl || '').trim();
  if (body?.mountPoint !== undefined) patch.mountPoint = String(body.mountPoint || '').trim();
  if (body?.anchorType !== undefined || body?.anchor_type !== undefined) patch.anchorType = String(body?.anchorType || body?.anchor_type || '').trim();
  if (body?.compatibleCars !== undefined || body?.compatible_cars !== undefined) patch.compatibleCars = normalizeObjectIdArray(body?.compatibleCars || body?.compatible_cars);
  if (body?.mountPoints !== undefined) {
    const arr = Array.isArray(body.mountPoints) ? body.mountPoints : [];
    patch.mountPoints = arr.map((x) => String(x || '').trim()).filter(Boolean);
  }
  if (body?.variantKey !== undefined) patch.variantKey = String(body.variantKey || '').trim();
  if (body?.boundingBox !== undefined || body?.bounding_box !== undefined) patch.boundingBox = normalizeBoundingBox(body?.boundingBox || body?.bounding_box);
  if (body?.compatibilityTags !== undefined || body?.compatibility_tags !== undefined) patch.compatibilityTags = normalizeTags(body?.compatibilityTags || body?.compatibility_tags);
  if (body?.exclusionTags !== undefined || body?.exclusion_tags !== undefined) patch.exclusionTags = normalizeTags(body?.exclusionTags || body?.exclusion_tags);
  if (body?.price !== undefined) {
    const priceRaw = body.price;
    patch.price = priceRaw === null || priceRaw === '' ? 0 : Number(priceRaw);
    if (!Number.isFinite(patch.price)) patch.price = 0;
  }

  const nextType = patch.type ?? existing.type;
  if (body?.specs !== undefined && typeof body.specs === 'object') {
    const normalized = normalizePartSpecs(body.specs, nextType);
    const merged = { ...(existing?.specs && typeof existing.specs === 'object' ? existing.specs : {}), ...normalized };
    patch.specs = filterSpecsToAllowedKeys(merged, nextType);
  } else if (patch.type !== undefined && String(patch.type) !== String(existing.type)) {
    patch.specs = filterSpecsToAllowedKeys(existing?.specs, nextType);
  }

  if (body?.emissions !== undefined && typeof body.emissions === 'object') {
    const normalized = normalizePartEmissions(body.emissions, nextType);
    const merged = { ...(existing?.emissions && typeof existing.emissions === 'object' ? existing.emissions : {}), ...normalized };
    patch.emissions = filterEmissionsToAllowedKeys(merged, nextType);
  } else if (patch.type !== undefined && String(patch.type) !== String(existing.type)) {
    patch.emissions = filterEmissionsToAllowedKeys(existing?.emissions, nextType);
  }

  if (patch.name !== undefined || patch.type !== undefined) {
    const nextName = patch.name ?? existing.name;
    patch.searchText = buildSearchText(nextName, nextType, id);
  }

  const nextCompatibleCars = patch.compatibleCars ?? existing.compatibleCars;
  if (!Array.isArray(nextCompatibleCars) || nextCompatibleCars.length === 0) throw httpError(400, 'COMPATIBLE_CARS_REQUIRED');

  const updated = await Part.findByIdAndUpdate(id, patch, { new: true }).lean();

  const prevPrice = Number(existing?.price) || 0;
  const nextPrice = Number(updated?.price) || 0;
  if (prevPrice !== nextPrice) {
    const name = String(updated?.name || existing?.name || '').trim() || 'Sản phẩm';
    await notifyFollowers({
      itemType: 'part',
      itemId: id,
      type: 'PRICE_CHANGED',
      content: `Giá sản phẩm bạn theo dõi vừa thay đổi: ${name} (${prevPrice} → ${nextPrice})`,
      meta: { itemType: 'part', itemId: id, name, prevPrice, nextPrice }
    });
  }

  return updated;
};

const deletePartAdmin = async ({ id }) => {
  const deleted = await Part.findByIdAndDelete(id).lean();
  if (!deleted) throw httpError(404, 'NOT_FOUND');
  return deleted;
};

const uploadModelPartAdmin = async ({ file }) => {
  if (!file) throw httpError(400, 'MISSING_FILE');
  return { url: `/uploads/models/${file.filename}` };
};

const bulkAssignCompatibleCars = async ({ partIds, compatibleCars }) => {
  const ids = Array.isArray(partIds) ? partIds : [];
  const cleanIds = normalizeObjectIdArray(ids);
  if (!cleanIds.length) throw httpError(400, 'MISSING_PART_IDS');

  const cars = normalizeObjectIdArray(compatibleCars);
  if (!cars.length) throw httpError(400, 'COMPATIBLE_CARS_REQUIRED');

  const res = await Part.updateMany(
    { _id: { $in: cleanIds } },
    { $set: { compatibleCars: cars } }
  );

  return {
    matchedCount: Number(res?.matchedCount) || 0,
    modifiedCount: Number(res?.modifiedCount) || 0
  };
};

module.exports = {
  listPartsAdmin,
  createPartAdmin,
  updatePartAdmin,
  deletePartAdmin,
  uploadModelPartAdmin,
  bulkAssignCompatibleCars
};
