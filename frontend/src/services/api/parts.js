import { apiFetch } from './client.js';

export const getParts = async ({ type } = {}) => {
  const qs = type ? `?type=${encodeURIComponent(type)}` : '';
  const data = await apiFetch(`/parts${qs}`);
  return data.items || [];
};

