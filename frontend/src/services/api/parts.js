import { apiFetch } from './client.js';

export const getParts = async ({ type } = {}) => {
  const qs = type ? `?type=${encodeURIComponent(type)}` : '';
  const data = await apiFetch(`/parts${qs}`);
  return data.items || [];
};

export const getPartsForCar = async ({ carId, type, strict } = {}) => {
  const params = new URLSearchParams();
  if (type) params.set('type', String(type));
  if (carId) params.set('carId', String(carId));
  if (strict === true) params.set('strict', '1');
  const qs = params.toString() ? `?${params.toString()}` : '';
  const data = await apiFetch(`/parts${qs}`);
  return data.items || [];
};
