let SELECTED_BASE = null;
const PRIMARY = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
const CANDIDATES = [
  PRIMARY,
  'http://localhost:5001',
  'http://localhost:5002',
  'http://localhost:5003',
  'http://localhost:5004',
  'http://localhost:5005'
];

const doFetch = async (base, path, { token, method, body }) => {
  const headers = { Accept: 'application/json' };
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const error = new Error(data?.error || 'REQUEST_FAILED');
    error.status = res.status;
    throw error;
  }
  return data;
};

export const apiFetch = async (path, opts = {}) => {
  if (!SELECTED_BASE) {
    let lastErr;
    for (const base of CANDIDATES) {
      try {
        const r = await fetch(`${base}/health`).then((x) => x.json()).catch(() => null);
        if (r && r.ok) {
          SELECTED_BASE = base;
          break;
        }
      } catch (e) {
        lastErr = e;
      }
    }
    if (!SELECTED_BASE) {
      SELECTED_BASE = CANDIDATES[0];
    }
  }
  try {
    return await doFetch(SELECTED_BASE, path, { ...opts, method: opts.method || 'GET' });
  } catch (err) {
    if (err?.name === 'TypeError' || err?.message === 'Failed to fetch') {
      for (const base of CANDIDATES) {
        if (base === SELECTED_BASE) continue;
        try {
          const r = await fetch(`${base}/health`).then((x) => x.json()).catch(() => null);
          if (r && r.ok) {
            SELECTED_BASE = base;
            return await doFetch(SELECTED_BASE, path, { ...opts, method: opts.method || 'GET' });
          }
        } catch {}
      }
    }
    throw err;
  }
};
