import { apiFetch } from './client.js';

export const createConfiguration = async ({ token, carId, selectedColor, selectedWheels, selectedParts, name }) => {
  return apiFetch('/configurations', {
    token,
    method: 'POST',
    body: {
      car_id: carId,
      selected_color: selectedColor,
      selected_wheels: selectedWheels || null,
      selected_parts: Array.isArray(selectedParts) ? selectedParts : [],
      name: name || ''
    }
  });
};

export const updateConfigurationPart = async ({ token, configId, slot, partId }) => {
  return apiFetch(`/configurations/${configId}/part`, {
    token,
    method: 'PUT',
    body: { slot, partId: partId ?? null }
  });
};

export const updateConfigurationPaint = async ({ token, configId, selectedColor, slotColors }) => {
  return apiFetch(`/configurations/${configId}/paint`, {
    token,
    method: 'PUT',
    body: {
      selected_color: selectedColor,
      slot_colors: slotColors && typeof slotColors === 'object' ? slotColors : undefined
    }
  });
};

export const getMyConfigurations = async ({ token }) => {
  const data = await apiFetch('/configurations/user', { token });
  return data.items || [];
};

export const setConfigurationPublic = async ({ token, configId, isPublic }) => {
  return apiFetch(`/configurations/${configId}/public`, {
    token,
    method: 'PUT',
    body: { isPublic: Boolean(isPublic) }
  });
};

export const getPublicConfigurations = async ({ limit, token } = {}) => {
  const qs = typeof limit === 'number' ? `?limit=${encodeURIComponent(String(limit))}` : '';
  const data = await apiFetch(`/configurations/public${qs}`, token ? { token } : undefined);
  return data.items || [];
};

export const likeConfiguration = async ({ token, configId }) => {
  return apiFetch(`/configurations/${configId}/like`, { token, method: 'POST' });
};

export const unlikeConfiguration = async ({ token, configId }) => {
  return apiFetch(`/configurations/${configId}/like`, { token, method: 'DELETE' });
};

export const favoriteConfiguration = async ({ token, configId }) => {
  return apiFetch(`/configurations/${configId}/favorite`, { token, method: 'POST' });
};

export const unfavoriteConfiguration = async ({ token, configId }) => {
  return apiFetch(`/configurations/${configId}/favorite`, { token, method: 'DELETE' });
};

export const deleteConfiguration = async ({ token, configId }) => {
  return apiFetch(`/configurations/${encodeURIComponent(String(configId || ''))}`, { token, method: 'DELETE' });
};

export const setConfigurationThumbnail = async ({ token, configId, imageData, backgroundKey, camera }) => {
  return apiFetch(`/configurations/${encodeURIComponent(String(configId || ''))}/thumbnail`, {
    token,
    method: 'PUT',
    body: { imageData: imageData || '', backgroundKey: backgroundKey || '', camera: camera || null }
  });
};

export const shareBuild = async ({ token, configId, name, backgroundKey, camera, imageData }) => {
  return apiFetch('/build/share', {
    token,
    method: 'POST',
    body: { configId, name: name || '', backgroundKey: backgroundKey || '', camera: camera || null, imageData: imageData || '' }
  });
};

export const getLeaderboard = async ({ range, limit, token } = {}) => {
  const qs = new URLSearchParams();
  if (range) qs.set('range', String(range));
  if (typeof limit === 'number') qs.set('limit', String(limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const data = await apiFetch(`/leaderboard${suffix}`, token ? { token } : undefined);
  return data.items || [];
};

export const getBuildDetail = async ({ id, token }) => {
  return apiFetch(`/build/${encodeURIComponent(String(id || ''))}`, token ? { token } : undefined);
};

export const voteBuild = async ({ token, buildId }) => {
  return apiFetch(`/vote/${encodeURIComponent(String(buildId || ''))}`, { token, method: 'POST' });
};

export const favoriteBuild = async ({ token, buildId }) => {
  return apiFetch(`/favorite/${encodeURIComponent(String(buildId || ''))}`, { token, method: 'POST' });
};
