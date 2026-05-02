import { apiFetch } from './client.js';

export const checkModLegality = async ({ motorcycle, partName, partType } = {}) => {
  const body = {
    motorcycle: String(motorcycle || '').trim(),
    partName: String(partName || '').trim(),
    partType: String(partType || '').trim()
  };
  return apiFetch('/api/ai/mod-legality', { method: 'POST', body });
};

