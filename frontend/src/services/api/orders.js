import { apiFetch, apiFetchForm } from './client.js';

export const createOrder = async ({ token, shopId, buildId, note }) => {
  return apiFetch('/api/orders', { token, method: 'POST', body: { shopId, buildId, note } });
};

export const listMyOrders = async ({ token, limit, status }) => {
  const params = new URLSearchParams();
  if (limit != null) params.set('limit', String(limit));
  if (status) params.set('status', String(status));
  const qs = params.toString() ? `?${params.toString()}` : '';
  return apiFetch(`/api/orders/my${qs}`, { token });
};

export const getMyOrderDetail = async ({ token, id }) => {
  return apiFetch(`/api/orders/${encodeURIComponent(String(id))}`, { token });
};

export const confirmMyOrder = async ({ token, id, note }) => {
  return apiFetch(`/api/orders/${encodeURIComponent(String(id))}/confirm`, { token, method: 'POST', body: { note } });
};

export const rejectMyOrder = async ({ token, id, note }) => {
  return apiFetch(`/api/orders/${encodeURIComponent(String(id))}/reject`, { token, method: 'POST', body: { note } });
};

export const cancelMyOrder = async ({ token, id, reason }) => {
  return apiFetch(`/api/orders/${encodeURIComponent(String(id))}/cancel`, { token, method: 'POST', body: { reason } });
};

export const reviewMyOrder = async ({ token, id, rating, comment }) => {
  return apiFetch(`/api/orders/${encodeURIComponent(String(id))}/review`, { token, method: 'POST', body: { rating, comment } });
};

export const listVendorOrders = async ({ token, limit, status }) => {
  const params = new URLSearchParams();
  if (limit != null) params.set('limit', String(limit));
  if (status) params.set('status', String(status));
  const qs = params.toString() ? `?${params.toString()}` : '';
  return apiFetch(`/api/vendor/orders${qs}`, { token });
};

export const getVendorOrderDetail = async ({ token, id }) => {
  return apiFetch(`/api/vendor/orders/${encodeURIComponent(String(id))}`, { token });
};

export const quoteVendorOrder = async ({ token, id, quotedPrice, note }) => {
  return apiFetch(`/api/vendor/orders/${encodeURIComponent(String(id))}/quote`, { token, method: 'POST', body: { quotedPrice, note } });
};

export const startVendorOrder = async ({ token, id, note, imageUrl }) => {
  return apiFetch(`/api/vendor/orders/${encodeURIComponent(String(id))}/start`, { token, method: 'POST', body: { note, imageUrl } });
};

export const completeVendorOrder = async ({ token, id, note, imageUrl }) => {
  return apiFetch(`/api/vendor/orders/${encodeURIComponent(String(id))}/complete`, { token, method: 'POST', body: { note, imageUrl } });
};

export const uploadVendorOrderProof = async ({ token, id, file }) => {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetchForm(`/api/vendor/orders/${encodeURIComponent(String(id))}/upload-proof`, { token, method: 'POST', formData });
};
