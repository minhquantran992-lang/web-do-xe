import { apiFetch } from './client.js';

export const createBooking = async ({
  token,
  buildId,
  shopId,
  timeSlot,
  customerName,
  customerPhone,
  customerCity,
  customerGender,
  customerCountry
}) => {
  return apiFetch('/api/bookings', {
    token,
    method: 'POST',
    body: { buildId, shopId, timeSlot, customerName, customerPhone, customerCity, customerGender, customerCountry }
  });
};

export const getMyBooking = async ({ token, id }) => {
  return apiFetch(`/api/bookings/${encodeURIComponent(String(id || ''))}`, { token });
};

export const listVendorBookings = async ({ token, status } = {}) => {
  const qs = status ? `?status=${encodeURIComponent(String(status))}` : '';
  return apiFetch(`/api/vendor/bookings${qs}`, { token });
};

export const acceptVendorBooking = async ({ token, id, timeSlot }) => {
  const body = timeSlot ? { timeSlot } : undefined;
  return apiFetch(`/api/vendor/bookings/${encodeURIComponent(String(id || ''))}/accept`, { token, method: 'POST', body });
};

export const rejectVendorBooking = async ({ token, id, reason }) => {
  return apiFetch(`/api/vendor/bookings/${encodeURIComponent(String(id || ''))}/reject`, {
    token,
    method: 'POST',
    body: { reason: String(reason || '').trim() }
  });
};

export const updateVendorBookingStatus = async ({ token, id, status }) => {
  return apiFetch(`/api/vendor/bookings/${encodeURIComponent(String(id || ''))}/status`, {
    token,
    method: 'POST',
    body: { status }
  });
};

export const rescheduleVendorBooking = async ({ token, id, timeSlot }) => {
  return apiFetch(`/api/vendor/bookings/${encodeURIComponent(String(id || ''))}/reschedule`, {
    token,
    method: 'POST',
    body: { timeSlot }
  });
};
