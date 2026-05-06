import { apiFetch } from './client.js';

export const toggleFollow = async ({ token, itemType, itemId }) => {
  return apiFetch('/api/follow/toggle', { token, method: 'POST', body: { itemType, itemId } });
};

export const getFollowStatus = async ({ token, itemType, itemId }) => {
  const qs = `?itemType=${encodeURIComponent(String(itemType || ''))}&itemId=${encodeURIComponent(String(itemId || ''))}`;
  return apiFetch(`/api/follow/status${qs}`, { token });
};

export const listFollowing = async ({ token, itemType, limit }) => {
  const params = new URLSearchParams();
  if (itemType) params.set('itemType', String(itemType));
  if (limit != null) params.set('limit', String(limit));
  const qs = params.toString() ? `?${params.toString()}` : '';
  return apiFetch(`/api/follow/list${qs}`, { token });
};

