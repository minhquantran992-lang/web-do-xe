const Configuration = require('../../../models/Configuration');
const { listCarsRaw, listCarModelsRaw } = require('../repositories/carsRepository');

const normalizeAnchors = (anchors) =>
  Array.isArray(anchors)
    ? anchors.map((a) => ({
        id: String(a?.id || '').trim(),
        name: String(a?.name || '').trim(),
        category: String(a?.category || '').trim(),
        position: Array.isArray(a?.position) ? a.position.slice(0, 3).map((x) => Number(x)) : [0, 0, 0],
        rotation: Array.isArray(a?.rotation) ? a.rotation.slice(0, 3).map((x) => Number(x)) : [0, 0, 0]
      }))
    : [];

const normalizeCombos = (combos) =>
  Array.isArray(combos)
    ? combos.map((x) => ({
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
    : [];

const normalizeCombinedModels = (raw) =>
  raw instanceof Map ? Object.fromEntries(raw.entries()) : raw && typeof raw === 'object' ? raw : {};

const listCars = async ({ withMetrics } = {}) => {
  const cars = await listCarsRaw();

  let modCountByCarId = new Map();
  if (withMetrics) {
    const rows = await Configuration.aggregate([{ $group: { _id: '$carId', count: { $sum: 1 } } }]);
    modCountByCarId = new Map(rows.map((r) => [String(r._id), Number(r.count) || 0]));
  }

  const items = (Array.isArray(cars) ? cars : []).map((c) => ({
    _id: c._id,
    name: c.name,
    brand: c.brand || '',
    category: c.category || '',
    engineCc: Number.isFinite(c.engineCc) ? c.engineCc : c.engineCc ?? null,
    image: c.image || c.thumbnailUrl || '',
    model3d: c.model3d || c.modelUrl || '',
    anchors: normalizeAnchors(c.anchors),
    combos: normalizeCombos(c.combos),
    combinedModelSlots: Array.isArray(c.combinedModelSlots) ? c.combinedModelSlots : [],
    combinedModels: normalizeCombinedModels(c.combinedModels),
    specs: c.specs || {},
    emissions: c.emissions || {},
    createdAt: c.createdAt,
    modCount: withMetrics ? modCountByCarId.get(String(c._id)) || 0 : undefined
  }));

  return { items };
};

const listCarModels = async () => {
  const cars = await listCarModelsRaw();
  const items = (Array.isArray(cars) ? cars : []).map((c) => ({
    _id: c._id,
    name: String(c?.name || '').trim(),
    brand: String(c?.brand || '').trim(),
    category: String(c?.category || '').trim(),
    engineCc: Number.isFinite(c?.engineCc) ? c.engineCc : c.engineCc ?? null,
    model3d: String(c?.model3d || c?.modelUrl || '').trim(),
    combinedModelSlots: Array.isArray(c?.combinedModelSlots) ? c.combinedModelSlots.map((x) => String(x || '').trim()).filter(Boolean) : [],
    combinedModels: normalizeCombinedModels(c?.combinedModels),
    combos: Array.isArray(c?.combos)
      ? c.combos.map((x) => ({
          key: String(x?.key || '').trim(),
          title: String(x?.title || '').trim(),
          modelKey: String(x?.modelKey || '').trim()
        }))
      : [],
    createdAt: c.createdAt,
    updatedAt: c.updatedAt
  }));
  return { items };
};

module.exports = { listCars, listCarModels };
