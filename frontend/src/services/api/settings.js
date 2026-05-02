import { apiFetch, getApiBaseUrl } from './client.js';

const getBaseUrl = () => getApiBaseUrl();

export const getHeroImages = async () => {
  const data = await apiFetch('/api/settings/hero-images');
  return Array.isArray(data.images) ? data.images : [];
};

export const getLandingHeroImages = async () => {
  const data = await apiFetch('/api/settings/landing-hero-images');
  return Array.isArray(data.images) ? data.images : [];
};

export const getDashboardHeroImages = async () => {
  const data = await apiFetch('/api/settings/dashboard-hero-images');
  return Array.isArray(data.images) ? data.images : [];
};

export const getAdminHeroImages = async ({ token }) => {
  const data = await apiFetch('/api/admin/settings/hero-images', { token });
  return Array.isArray(data.images) ? data.images : [];
};

export const setAdminHeroImages = async ({ token, images }) => {
  const data = await apiFetch('/api/admin/settings/hero-images', { token, method: 'PUT', body: { images } });
  return Array.isArray(data.images) ? data.images : [];
};

export const getAdminLandingHeroImages = async ({ token }) => {
  const data = await apiFetch('/api/admin/settings/landing-hero-images', { token });
  return Array.isArray(data.images) ? data.images : [];
};

export const setAdminLandingHeroImages = async ({ token, images }) => {
  const data = await apiFetch('/api/admin/settings/landing-hero-images', { token, method: 'PUT', body: { images } });
  return Array.isArray(data.images) ? data.images : [];
};

export const getAdminDashboardHeroImages = async ({ token }) => {
  const data = await apiFetch('/api/admin/settings/dashboard-hero-images', { token });
  return Array.isArray(data.images) ? data.images : [];
};

export const setAdminDashboardHeroImages = async ({ token, images }) => {
  const data = await apiFetch('/api/admin/settings/dashboard-hero-images', { token, method: 'PUT', body: { images } });
  return Array.isArray(data.images) ? data.images : [];
};

export const uploadAdminHeroImage = async ({ token, file }) => {
  const base = getBaseUrl();
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${base}/api/admin/settings/upload-hero-image`, {
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
