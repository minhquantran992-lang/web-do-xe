const mongoose = require('mongoose');

const Car = require('../models/Car');
const Part = require('../models/Part');
const Configuration = require('../models/Configuration');
const { asyncHandler } = require('../middleware/asyncHandler');

const SLOT_RULES = {
  exhaust: ['exhaust'],
  clutch: ['clutch'],
  wheels: ['wheels'],
  brake: ['brake'],
  suspension: ['suspension'],
  suspension_front: ['suspension'],
  suspension_rear: ['suspension'],
  tire: ['tire'],
  handlebar: ['handlebar'],
  bodykit: ['bodykit'],
  seat: ['seat'],
  lighting: ['lighting'],
  throttle_housing: ['throttle_housing']
};

const normalizeSlot = (raw) => String(raw || '').trim().toLowerCase();

const validateSlot = (slot) => {
  if (!slot) return { ok: false, error: 'MISSING_SLOT' };
  if (!/^[a-z0-9_]+$/.test(slot)) return { ok: false, error: 'INVALID_SLOT' };
  if (!SLOT_RULES[slot]) return { ok: false, error: 'UNSUPPORTED_SLOT' };
  return { ok: true };
};

const buildLegacyFromPartsMap = (partsMap) => {
  const partsObj = partsMap && typeof partsMap === 'object' ? partsMap : {};
  const wheels = partsObj.wheels ? String(partsObj.wheels) : null;
  const selectedParts = Object.entries(partsObj)
    .filter(([k]) => k !== 'wheels')
    .map(([, v]) => String(v || ''))
    .filter((id) => mongoose.isValidObjectId(id));
  return { selectedWheels: wheels && mongoose.isValidObjectId(wheels) ? wheels : null, selectedParts };
};

const createConfiguration = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const carId = String(req.body?.car_id || req.body?.carId || '');
  const selectedColor = String(req.body?.selected_color || req.body?.selectedColor || '#ffffff');
  const selectedWheels = req.body?.selected_wheels || req.body?.selectedWheels || null;
  const selectedParts = req.body?.selected_parts || req.body?.selectedParts || [];
  const name = String(req.body?.name || '').trim();

  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });
  if (!carId) return res.status(400).json({ error: 'MISSING_CAR' });
  if (!mongoose.isValidObjectId(carId)) return res.status(400).json({ error: 'INVALID_CAR' });

  const car = await Car.findById(carId).lean();
  if (!car) return res.status(404).json({ error: 'CAR_NOT_FOUND' });

  const partIds = [];
  if (selectedWheels && mongoose.isValidObjectId(String(selectedWheels))) {
    partIds.push(String(selectedWheels));
  }
  if (Array.isArray(selectedParts)) {
    for (const id of selectedParts) {
      if (mongoose.isValidObjectId(String(id))) partIds.push(String(id));
    }
  }

  if (partIds.length) {
    const rows = await Part.find({ _id: { $in: partIds } })
      .select('_id type')
      .lean();
    const byId = new Map(rows.map((r) => [String(r._id), r]));
    if (rows.length !== new Set(partIds).size) return res.status(400).json({ error: 'INVALID_PARTS' });

    const parts = {};
    const wheelsId = selectedWheels && mongoose.isValidObjectId(String(selectedWheels)) ? String(selectedWheels) : '';
    if (wheelsId) parts.wheels = wheelsId;

    if (Array.isArray(selectedParts)) {
      for (const rawId of selectedParts) {
        const id = String(rawId || '').trim();
        if (!mongoose.isValidObjectId(id)) continue;
        const p = byId.get(id);
        if (!p) continue;
        const slot = normalizeSlot(p.type);
        if (!SLOT_RULES[slot]) continue;
        if (slot === 'wheels') continue;
        parts[slot] = id;
      }
    }

    const legacy = buildLegacyFromPartsMap(parts);
    const doc = await Configuration.create({
      userId,
      carId,
      selectedColor,
      selectedWheels: legacy.selectedWheels,
      selectedParts: legacy.selectedParts,
      parts,
      name
    });

    return res.status(201).json({ item: doc });
  }

  const doc = await Configuration.create({
    userId,
    carId,
    selectedColor,
    selectedWheels: selectedWheels && mongoose.isValidObjectId(String(selectedWheels)) ? String(selectedWheels) : null,
    selectedParts: Array.isArray(selectedParts) ? selectedParts.filter((id) => mongoose.isValidObjectId(String(id))) : [],
    parts: {},
    name
  });

  res.status(201).json({ item: doc });
});

const updateConfigurationPart = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const configId = String(req.params?.id || '').trim();
  let slot = normalizeSlot(req.body?.slot || req.body?.type || '');
  const partIdRaw = req.body?.partId ?? req.body?.part_id ?? req.body?.part;
  const partId = partIdRaw === null || partIdRaw === undefined || partIdRaw === '' ? null : String(partIdRaw).trim();

  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });
  if (!mongoose.isValidObjectId(configId)) return res.status(400).json({ error: 'INVALID_CONFIG' });

  if (partId !== null) {
    if (!mongoose.isValidObjectId(partId)) return res.status(400).json({ error: 'INVALID_PART' });
    const part = await Part.findById(partId).select('_id type').lean();
    if (!part) return res.status(404).json({ error: 'PART_NOT_FOUND' });
    if (!slot) slot = normalizeSlot(part.type);
    const slotCheck = validateSlot(slot);
    if (!slotCheck.ok) return res.status(400).json({ error: slotCheck.error });
    const allowedTypes = SLOT_RULES[slot] || [];
    if (!allowedTypes.includes(String(part.type || ''))) return res.status(400).json({ error: 'PART_TYPE_MISMATCH' });
  } else {
    const slotCheck = validateSlot(slot);
    if (!slotCheck.ok) return res.status(400).json({ error: slotCheck.error });
  }

  const update = partId === null ? { $unset: { [`parts.${slot}`]: 1 } } : { $set: { [`parts.${slot}`]: partId } };
  const base = await Configuration.findOneAndUpdate({ _id: configId, userId }, update, { new: true }).lean();
  if (!base) return res.status(404).json({ error: 'CONFIG_NOT_FOUND' });

  const legacy = buildLegacyFromPartsMap(base.parts || {});
  const updated = await Configuration.findOneAndUpdate(
    { _id: configId, userId },
    { $set: { selectedWheels: legacy.selectedWheels, selectedParts: legacy.selectedParts } },
    { new: true }
  )
    .populate('carId', 'name thumbnailUrl modelUrl')
    .populate('selectedWheels', 'name type thumbnailUrl modelUrl')
    .populate('selectedParts', 'name type thumbnailUrl modelUrl');

  res.json({ item: updated });
});

const listUserConfigurations = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });

  const items = await Configuration.find({ userId })
    .sort({ createdAt: -1 })
    .populate('carId', 'name thumbnailUrl modelUrl')
    .populate('selectedWheels', 'name type thumbnailUrl modelUrl')
    .populate('selectedParts', 'name type thumbnailUrl modelUrl')
    .lean();

  res.json({ items });
});

module.exports = { createConfiguration, updateConfigurationPart, listUserConfigurations };
