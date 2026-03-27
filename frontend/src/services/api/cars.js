import { apiFetch } from './client.js';

export const getCars = async ({ metrics } = {}) => {
  const qs = metrics ? '?metrics=1' : '';
  const data = await apiFetch(`/api/cars${qs}`);
  const items = Array.isArray(data.items) ? data.items : [];
  return items.map((c) => ({
    ...c,
    name: c?.name || '',
    brand: c?.brand || '',
    category: c?.category || '',
    engineCc: Number.isFinite(c?.engineCc) ? c.engineCc : c?.engineCc ?? null,
    specs: c?.specs && typeof c.specs === 'object' ? c.specs : {},
    image: c?.image || '',
    model3d: c?.model3d || '',
    createdAt: c?.createdAt || '',
    modCount: Number.isFinite(c?.modCount) ? c.modCount : c?.modCount ?? 0
  }));
};

export const getBrands = async ({ vehicleType, type } = {}) => {
  const value = type ?? vehicleType;
  const qs = value ? `?vehicleType=${encodeURIComponent(value)}` : '';
  const data = await apiFetch(`/brands${qs}`);
  return Array.isArray(data.items) ? data.items : [];
};

export const getBackgrounds = async () => {
  const data = await apiFetch('/api/backgrounds');
  return Array.isArray(data.items) ? data.items : [];
};
