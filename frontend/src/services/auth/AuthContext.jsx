import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getMe } from '../api/auth.js';

const STORAGE_KEY = 'carbanana_auth';

const AuthContext = createContext(null);

const safeJsonParse = (raw) => {
  try {
    return JSON.parse(String(raw || ''));
  } catch {
    return null;
  }
};

const decodeJwtPayload = (token) => {
  const t = String(token || '').trim();
  if (!t) return null;
  const parts = t.split('.');
  if (parts.length < 2) return null;
  const raw = String(parts[1] || '');
  const b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=');
  try {
    const json = atob(padded);
    return safeJsonParse(json);
  } catch {
    try {
      const json = decodeURIComponent(
        atob(padded)
          .split('')
          .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
          .join('')
      );
      return safeJsonParse(json);
    } catch {
      return null;
    }
  }
};

const normalizeEmail = (v) => String(v || '').trim().toLowerCase();

const validateAuth = ({ token, user }) => {
  const t = token || null;
  const u = user || null;
  if (!t || !u) return { token: null, user: null };
  const payload = decodeJwtPayload(t);
  if (!payload) return { token: t, user: u };
  const sub = String(payload?.sub || '').trim();
  const email = normalizeEmail(payload?.email);
  const userId = String(u?.id || u?._id || '').trim();
  const userEmail = normalizeEmail(u?.email);
  if (sub && userId && sub !== userId) return { token: null, user: null };
  if (email && userEmail && email !== userEmail) return { token: null, user: null };
  return { token: t, user: u };
};

const readFromStorage = (storage) => {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return { token: null, user: null };
    const parsed = safeJsonParse(raw);
    return { token: parsed?.token || null, user: parsed?.user || null };
  } catch {
    return { token: null, user: null };
  }
};

const writeToStorage = (storage, next) => {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
};

const clearStorage = (storage) => {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {}
};

const readStoredAuth = () => {
  const fromSession = validateAuth(readFromStorage(sessionStorage));
  if (fromSession.token) return fromSession;

  const fromLocal = validateAuth(readFromStorage(localStorage));
  if (fromLocal.token) writeToStorage(sessionStorage, fromLocal);
  return fromLocal;
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const stored = readStoredAuth();
    setToken(stored.token);
    setUser(stored.user);
  }, []);

  const persist = useCallback((next) => {
    writeToStorage(sessionStorage, next);
    writeToStorage(localStorage, next);
  }, []);

  const setAuth = useCallback(({ token: nextToken, user: nextUser }) => {
    setToken(nextToken || null);
    setUser(nextUser || null);
    persist({ token: nextToken || null, user: nextUser || null });
  }, [persist]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    clearStorage(sessionStorage);
    clearStorage(localStorage);
  }, []);

  useEffect(() => {
    if (!token) return;
    let alive = true;

    const refreshMe = async () => {
      try {
        const data = await getMe({ token });
        const nextUser = data?.user || null;
        if (!alive || !nextUser) return;

        setUser((prev) => {
          const same =
            prev &&
            String(prev?.id || '') === String(nextUser?.id || '') &&
            String(prev?.role || '') === String(nextUser?.role || '') &&
            Boolean(prev?.isAdmin) === Boolean(nextUser?.isAdmin) &&
            String(prev?.email || '') === String(nextUser?.email || '') &&
            String(prev?.name || '') === String(nextUser?.name || '') &&
            String(prev?.phone || '') === String(nextUser?.phone || '') &&
            String(prev?.country || '') === String(nextUser?.country || '') &&
            String(prev?.city || '') === String(nextUser?.city || '');
          if (same) return prev;
          persist({ token, user: nextUser });
          return nextUser;
        });
      } catch (e) {
        const msg = String(e?.message || '');
        if (msg === 'UNAUTHORIZED') logout();
      }
    };

    refreshMe();
    const onFocus = () => refreshMe();
    window.addEventListener('focus', onFocus);
    const intervalId = window.setInterval(refreshMe, 30000);

    return () => {
      alive = false;
      window.removeEventListener('focus', onFocus);
      window.clearInterval(intervalId);
    };
  }, [logout, persist, token]);

  const value = useMemo(
    () => ({
      token,
      user,
      setAuth,
      logout,
      isAuthed: Boolean(token)
    }),
    [logout, setAuth, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

