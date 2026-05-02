import { apiFetch } from './client.js';

export const searchItems = async ({ q, limit } = {}) => {
  const query = String(q || '').trim();
  const n = Number(limit);
  const lim = Number.isFinite(n) ? Math.max(1, Math.min(50, Math.floor(n))) : undefined;
  const qs = new URLSearchParams();
  if (query) qs.set('q', query);
  if (lim) qs.set('limit', String(lim));
  const data = await apiFetch(`/api/search?${qs.toString()}`);
  return Array.isArray(data.items) ? data.items : [];
};

