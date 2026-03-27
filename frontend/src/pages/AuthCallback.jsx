import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../services/auth/AuthContext.jsx';
import { useI18n } from '../services/i18n.jsx';

const decodeJwtPayload = (token) => {
  try {
    const parts = String(token || '').split('.');
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=');
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
};

const AuthCallback = () => {
  const nav = useNavigate();
  const { setAuth } = useAuth();
  const { t } = useI18n();
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('');

  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const token = params.get('token') || '';
  const error = params.get('error') || '';

  useEffect(() => {
    const next = sessionStorage.getItem('post_auth_redirect') || '/dashboard';
    sessionStorage.removeItem('post_auth_redirect');

    if (error) {
      setStatus('error');
      setMessage(error);
      return;
    }

    if (!token) {
      setStatus('error');
      setMessage('MISSING_TOKEN');
      return;
    }

    const payload = decodeJwtPayload(token);
    const user = payload
      ? {
          id: payload.sub || '',
          email: String(payload.email || '').trim(),
          isAdmin: Boolean(payload.isAdmin),
          role: String(payload.role || '').trim() || (Boolean(payload.isAdmin) ? 'ADMIN' : 'USER')
        }
      : null;

    setAuth({ token, user });
    setStatus('done');
    nav(next, { replace: true });
  }, [error, nav, setAuth, token]);

  if (status === 'processing') {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md items-center justify-center">
        <div className="w-full rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6 text-center text-sm text-zinc-300">
          {t('auth_oauth_processing')}
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md items-center justify-center">
        <div className="w-full space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6">
          <div className="text-lg font-semibold">{t('auth_oauth_failed_title')}</div>
          <div className="text-sm text-zinc-400">{message || 'OAUTH_FAILED'}</div>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-500"
            >
              {t('auth_back_to_login')}
            </Link>
            <Link to="/" className="text-sm text-zinc-300 hover:text-white">
              {t('common_back_home')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default AuthCallback;
