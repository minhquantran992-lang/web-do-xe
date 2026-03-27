import { apiFetch } from './client.js';

export const getAdminCars = async ({ token }) => {
  const data = await apiFetch('/api/admin/cars', { token });
  return Array.isArray(data.items) ? data.items : [];
};

export const createAdminCar = async ({ token, payload }) => {
  const data = await apiFetch('/api/admin/cars', { token, method: 'POST', body: payload });
  return data.item;
};

export const deleteAdminCar = async ({ token, id }) => {
  return apiFetch(`/api/admin/cars/${encodeURIComponent(id)}`, { token, method: 'DELETE' });
};

export const updateAdminCar = async ({ token, id, payload }) => {
  const data = await apiFetch(`/api/admin/cars/${encodeURIComponent(id)}`, { token, method: 'PUT', body: payload });
  return data.item;
};

export const uploadAdminCarModel = async ({ token, file }) => {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

  const form = new FormData();
  form.append('file', file);

  const res = await fetch(`${API_BASE_URL}/api/admin/cars/upload-model`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const error = new Error(data?.error || 'UPLOAD_FAILED');
    error.status = res.status;
    throw error;
  }
  return data;
};

export const getAdminParts = async ({ token, type } = {}) => {
  const qs = type ? `?type=${encodeURIComponent(type)}` : '';
  const data = await apiFetch(`/api/admin/parts${qs}`, { token });
  return Array.isArray(data.items) ? data.items : [];
};

export const createAdminPart = async ({ token, payload }) => {
  const data = await apiFetch('/api/admin/parts', { token, method: 'POST', body: payload });
  return data.item;
};

export const deleteAdminPart = async ({ token, id }) => {
  return apiFetch(`/api/admin/parts/${encodeURIComponent(id)}`, { token, method: 'DELETE' });
};

export const uploadAdminPartModel = async ({ token, file }) => {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

  const form = new FormData();
  form.append('file', file);

  const res = await fetch(`${API_BASE_URL}/api/admin/parts/upload-model`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const error = new Error(data?.error || 'UPLOAD_FAILED');
    error.status = res.status;
    throw error;
  }
  return data;
};

export const getAdminBrands = async ({ token, vehicleType, type } = {}) => {
  const value = type ?? vehicleType;
  const qs = value ? `?vehicleType=${encodeURIComponent(value)}` : '';
  const data = await apiFetch(`/api/admin/brands${qs}`, { token });
  return Array.isArray(data.items) ? data.items : [];
};

export const createAdminBrand = async ({ token, payload }) => {
  const data = await apiFetch('/api/admin/brands', { token, method: 'POST', body: payload });
  return data.item;
};

export const updateAdminBrand = async ({ token, id, payload }) => {
  const data = await apiFetch(`/api/admin/brands/${encodeURIComponent(id)}`, { token, method: 'PATCH', body: payload });
  return data.item;
};

export const deleteAdminBrand = async ({ token, id }) => {
  return apiFetch(`/api/admin/brands/${encodeURIComponent(id)}`, { token, method: 'DELETE' });
};

export const uploadAdminBrandLogo = async ({ token, file }) => {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

  const form = new FormData();
  form.append('file', file);

  const res = await fetch(`${API_BASE_URL}/api/admin/brands/upload-logo`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const error = new Error(data?.error || 'UPLOAD_FAILED');
    error.status = res.status;
    throw error;
  }
  return data;
};

export const importAdminBrandLogoFromUrl = async ({ token, url }) => {
  const data = await apiFetch('/api/admin/brands/import-logo', {
    token,
    method: 'POST',
    body: { url }
  });
  return data;
};

export const getAdminBackgrounds = async ({ token }) => {
  const data = await apiFetch('/api/admin/backgrounds', { token });
  return Array.isArray(data.items) ? data.items : [];
};

export const createAdminBackground = async ({ token, payload }) => {
  const data = await apiFetch('/api/admin/backgrounds', { token, method: 'POST', body: payload });
  return data.item;
};

export const updateAdminBackground = async ({ token, id, payload }) => {
  const data = await apiFetch(`/api/admin/backgrounds/${encodeURIComponent(id)}`, { token, method: 'PATCH', body: payload });
  return data.item;
};

export const deleteAdminBackground = async ({ token, id }) => {
  return apiFetch(`/api/admin/backgrounds/${encodeURIComponent(id)}`, { token, method: 'DELETE' });
};

export const uploadAdminBackgroundImage = async ({ token, file }) => {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

  const form = new FormData();
  form.append('file', file);

  const res = await fetch(`${API_BASE_URL}/api/admin/backgrounds/upload-image`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const error = new Error(data?.error || 'UPLOAD_FAILED');
    error.status = res.status;
    throw error;
  }
  return data;
};
