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

export const getMyConfigurations = async ({ token }) => {
  const data = await apiFetch('/configurations/user', { token });
  return data.items || [];
};
