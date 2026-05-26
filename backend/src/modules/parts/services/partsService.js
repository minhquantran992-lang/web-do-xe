const { listParts: listPartsRepo } = require('../repositories/partsRepository');

const listParts = async ({ type, carId, strict } = {}) => {
  const parts = await listPartsRepo({ type, carId, strict });
  return (Array.isArray(parts) ? parts : []).map((p) => ({
    ...p,
    mount_point: String(p?.mountPoint || '').trim(),
    bounding_box: p?.boundingBox && typeof p.boundingBox === 'object' ? p.boundingBox : { x: 0, y: 0, z: 0 },
    compatibility_tags: Array.isArray(p?.compatibilityTags) ? p.compatibilityTags : [],
    exclusion_tags: Array.isArray(p?.exclusionTags) ? p.exclusionTags : []
  }));
};

module.exports = { listParts };
