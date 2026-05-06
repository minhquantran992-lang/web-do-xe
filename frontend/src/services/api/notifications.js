import { apiFetch } from './client.js';

export const listNotifications = async ({ token, limit, skip }) => {
  const params = new URLSearchParams();
  if (limit != null) params.set('limit', String(limit));
  if (skip != null) params.set('skip', String(skip));
  const qs = params.toString() ? `?${params.toString()}` : '';
  return apiFetch(`/api/notifications${qs}`, { token });
};

export const markNotificationRead = async ({ token, id }) => {
  return apiFetch(`/api/notifications/read/${encodeURIComponent(String(id))}`, { token, method: 'POST' });
};

export const markAllNotificationsRead = async ({ token }) => {
  return apiFetch('/api/notifications/read-all', { token, method: 'POST' });
};

