import { apiFetch } from './client.js';

export const register = async ({ email, password, name, isVendor, shopName, phone, address, website }) => {
  return apiFetch('/auth/register', {
    method: 'POST',
    body: { email, password, name, isVendor, shopName, phone, address, website }
  });
};

export const login = async ({ email, password }) => {
  return apiFetch('/auth/login', { method: 'POST', body: { email, password } });
};

export const changePassword = async ({ token, oldPassword, newPassword }) => {
  return apiFetch('/auth/change-password', {
    method: 'POST',
    token,
    body: { oldPassword, newPassword }
  });
};

export const requestReset = async ({ email }) => {
  return apiFetch('/auth/request-reset', { method: 'POST', body: { email } });
};

export const resetPassword = async ({ token, newPassword }) => {
  return apiFetch('/auth/reset-password', { method: 'POST', body: { token, newPassword } });
};

export const resetByCode = async ({ email, code, newPassword }) => {
  return apiFetch('/auth/reset-by-code', { method: 'POST', body: { email, code, newPassword } });
};
