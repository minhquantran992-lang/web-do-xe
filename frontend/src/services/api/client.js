let SELECTED_BASE = null;
const HOSTNAME = typeof window !== 'undefined' && window.location?.hostname ? window.location.hostname : 'localhost';
const DEFAULT_BASE = `http://${HOSTNAME}:5000`;
let PRIMARY = DEFAULT_BASE;
try {
  const v = typeof window !== 'undefined' ? localStorage.getItem('carbanana.apiBase') : null;
  if (v) PRIMARY = v;
} catch {}
if (import.meta.env.VITE_API_BASE_URL) PRIMARY = import.meta.env.VITE_API_BASE_URL;
const CANDIDATES = Array.from(
  new Set([
    PRIMARY,
    DEFAULT_BASE,
    `http://${HOSTNAME}:5001`,
    `http://${HOSTNAME}:5002`,
    `http://${HOSTNAME}:5003`,
    `http://${HOSTNAME}:5004`,
    `http://${HOSTNAME}:5005`
  ])
);

const HEALTH_TIMEOUT_MS = 1200;
const REQUEST_TIMEOUT_MS = 12000;

const fetchWithTimeout = async (url, options = {}, timeoutMs = 0) => {
  if (!timeoutMs) return fetch(url, options);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
};

const isNetworkishError = (err) => {
  const name = String(err?.name || '').trim();
  const msg = String(err?.message || '').trim();
  if (name === 'AbortError') return true;
  if (name === 'TypeError') return true;
  if (msg === 'Failed to fetch') return true;
  return false;
};

const emitApiError = (detail) => {
  try {
    if (typeof window === 'undefined') return;
    if (typeof window.dispatchEvent !== 'function') return;
    window.dispatchEvent(new CustomEvent('carbanana:api-error', { detail: detail && typeof detail === 'object' ? detail : {} }));
  } catch {}
};

const probeHealth = async (base) => {
  const r = await fetchWithTimeout(
    `${base}/health?ts=${Date.now()}`,
    { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } },
    HEALTH_TIMEOUT_MS
  )
    .then((x) => x.json())
    .catch(() => null);
  return Boolean(r && r.ok && r.service === 'carbanana-backend');
};

const doFetch = async (base, path, { token, method, body }) => {
  const headers = { Accept: 'application/json' };
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetchWithTimeout(
    `${base}${path}`,
    {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
    },
    REQUEST_TIMEOUT_MS
  );

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status >= 500) {
      emitApiError({ kind: 'server', status: res.status, path, base, message: String(data?.error || 'REQUEST_FAILED') });
    }
    const error = new Error(data?.error || 'REQUEST_FAILED');
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
};

const doFetchForm = async (base, path, { token, method, formData }) => {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetchWithTimeout(
    `${base}${path}`,
    {
    method,
    headers,
    body: formData
    },
    REQUEST_TIMEOUT_MS
  );

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status >= 500) {
      emitApiError({ kind: 'server', status: res.status, path, base, message: String(data?.error || 'REQUEST_FAILED') });
    }
    const error = new Error(data?.error || 'REQUEST_FAILED');
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
};

export const getApiBaseUrl = () => {
  if (SELECTED_BASE) return String(SELECTED_BASE || '').trim().replace(/\/+$/, '');
  let base = DEFAULT_BASE;
  try {
    const v = typeof window !== 'undefined' ? localStorage.getItem('carbanana.apiBase') : null;
    if (v) base = v;
  } catch {}
  if (import.meta.env.VITE_API_BASE_URL) base = import.meta.env.VITE_API_BASE_URL;
  return String(base || '').trim().replace(/\/+$/, '');
};

export const apiFetch = async (path, opts = {}) => {
  if (!SELECTED_BASE) {
    let lastErr;
    for (const base of CANDIDATES) {
      try {
        const ok = await probeHealth(base);
        if (ok) {
          SELECTED_BASE = base;
          try {
            localStorage.setItem('carbanana.apiBase', SELECTED_BASE);
          } catch {}
          break;
        }
      } catch (e) {
        lastErr = e;
      }
    }
    if (!SELECTED_BASE) {
      SELECTED_BASE = CANDIDATES[0];
      try {
        localStorage.setItem('carbanana.apiBase', SELECTED_BASE);
      } catch {}
    }
  }
  try {
    return await doFetch(SELECTED_BASE, path, { ...opts, method: opts.method || 'GET' });
  } catch (err) {
    const shouldFailover = isNetworkishError(err) || (Boolean(opts?.failoverOnNotFound) && String(err?.message || '') === 'NOT_FOUND');
    if (shouldFailover) {
      for (const base of CANDIDATES) {
        if (base === SELECTED_BASE) continue;
        try {
          const ok = await probeHealth(base);
          if (ok) {
            SELECTED_BASE = base;
            try {
              localStorage.setItem('carbanana.apiBase', SELECTED_BASE);
            } catch {}
            return await doFetch(SELECTED_BASE, path, { ...opts, method: opts.method || 'GET' });
          }
        } catch {}
      }
    }
    if (isNetworkishError(err)) {
      emitApiError({ kind: 'network', status: Number(err?.status) || 0, path, base: String(SELECTED_BASE || ''), message: String(err?.message || 'NETWORK_ERROR') });
    } else if (Number(err?.status) >= 500) {
      emitApiError({ kind: 'server', status: Number(err?.status) || 500, path, base: String(SELECTED_BASE || ''), message: String(err?.message || 'SERVER_ERROR') });
    }
    throw err;
  }
};

export const apiFetchForm = async (path, opts = {}) => {
  if (!SELECTED_BASE) {
    await apiFetch('/health').catch(() => {});
  }
  try {
    return await doFetchForm(SELECTED_BASE, path, { ...opts, method: opts.method || 'POST' });
  } catch (err) {
    if (isNetworkishError(err)) {
      for (const base of CANDIDATES) {
        if (base === SELECTED_BASE) continue;
        try {
          const ok = await probeHealth(base);
          if (ok) {
            SELECTED_BASE = base;
            try {
              localStorage.setItem('carbanana.apiBase', SELECTED_BASE);
            } catch {}
            return await doFetchForm(SELECTED_BASE, path, { ...opts, method: opts.method || 'POST' });
          }
        } catch {}
      }
    }
    if (isNetworkishError(err)) {
      emitApiError({ kind: 'network', status: Number(err?.status) || 0, path, base: String(SELECTED_BASE || ''), message: String(err?.message || 'NETWORK_ERROR') });
    } else if (Number(err?.status) >= 500) {
      emitApiError({ kind: 'server', status: Number(err?.status) || 500, path, base: String(SELECTED_BASE || ''), message: String(err?.message || 'SERVER_ERROR') });
    }
    throw err;
  }
};
