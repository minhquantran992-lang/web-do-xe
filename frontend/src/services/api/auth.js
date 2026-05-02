import { apiFetch, apiFetchForm } from './client.js';

export const registerOtp = async ({ name, dob, gender, country, identifier, password }) => {
  return apiFetch('/api/auth/register', {
    method: 'POST',
    body: { name, dob, gender, country, identifier, password }
  });
};

export const verifyOtp = async ({ identifier, code }) => {
  return apiFetch('/api/auth/verify-otp', { method: 'POST', body: { identifier, code } });
};

export const resendOtp = async ({ identifier }) => {
  return apiFetch('/api/auth/resend-otp', { method: 'POST', body: { identifier } });
};

export const verifyOAuthOtp = async ({ ticket, code }) => {
  return apiFetch('/api/auth/oauth/verify-otp', { method: 'POST', body: { ticket, code } });
};

export const resendOAuthOtp = async ({ ticket }) => {
  return apiFetch('/api/auth/oauth/resend-otp', { method: 'POST', body: { ticket } });
};

export const register = async ({ email, password, name, isVendor, shopName, phone, address, website, dob, gender, country, identifier }) => {
  const id = identifier || email || phone;
  if (dob || gender || country || identifier) {
    return registerOtp({ name, dob, gender, country, identifier: id, password });
  }
  return apiFetch('/api/auth/register', {
    method: 'POST',
    body: { email, password, name, isVendor, shopName, phone, address, website }
  });
};

export const login = async ({ email, password }) => {
  return apiFetch('/api/auth/login', { method: 'POST', body: { email, password } });
};

export const changePassword = async ({ token, oldPassword, newPassword }) => {
  return apiFetch('/api/auth/change-password', {
    method: 'POST',
    token,
    body: { oldPassword, newPassword }
  });
};

export const requestReset = async ({ email }) => {
  return apiFetch('/api/auth/forgot-password', { method: 'POST', body: { email } });
};

export const resetPassword = async ({ token, newPassword }) => {
  return apiFetch('/api/auth/reset-password', { method: 'POST', body: { token, newPassword } });
};

export const resetByCode = async ({ email, code, newPassword }) => {
  return apiFetch('/api/auth/reset-by-code', { method: 'POST', body: { email, code, newPassword } });
};

export const verifyResetCode = async ({ email, code }) => {
  return apiFetch('/api/auth/verify-reset-code', { method: 'POST', body: { email, code } });
};

export const getMe = async ({ token }) => {
  return apiFetch('/api/auth/me', { token });
};

export const updateMe = async ({ token, payload }) => {
  return apiFetch('/api/auth/me', { token, method: 'PUT', body: payload });
};

export const uploadMyAvatar = async ({ token, file }) => {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetchForm('/api/auth/me/avatar', { token, method: 'POST', formData });
};
