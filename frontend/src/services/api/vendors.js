import { apiFetch } from './client.js';

export const listPartneredShops = async ({ lat, lng } = {}) => {
  const qs = new URLSearchParams();
  if (Number.isFinite(Number(lat))) qs.set('lat', String(lat));
  if (Number.isFinite(Number(lng))) qs.set('lng', String(lng));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const data = await apiFetch(`/api/vendors/partnered${suffix}`);
  return Array.isArray(data?.items) ? data.items : [];
};

