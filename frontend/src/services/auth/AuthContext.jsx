import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getMe } from '../api/auth.js';

const STORAGE_KEY = 'carbanana_auth';

const AuthContext = createContext(null);

const readStoredAuth = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { token: null, user: null };
    const parsed = JSON.parse(raw);
    return { token: parsed?.token || null, user: parsed?.user || null };
  } catch {
    return { token: null, user: null };
  }
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const setAuth = useCallback(({ token: nextToken, user: nextUser }) => {
    setToken(nextToken || null);
    setUser(nextUser || null);
    persist({ token: nextToken || null, user: nextUser || null });
  }, [persist]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
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

