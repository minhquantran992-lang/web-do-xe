import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import FormField from '../components/FormField.jsx';
import { login } from '../services/api/auth.js';
import { useAuth } from '../services/auth/AuthContext.jsx';
import { useI18n } from '../services/i18n.jsx';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

const normalizeNext = (value) => {
  const v = String(value || '').trim();
  if (!v) return '/dashboard';
  if (!v.startsWith('/')) return '/dashboard';
  if (v.startsWith('/login') || v.startsWith('/register') || v.startsWith('/auth/callback')) return '/dashboard';
  return v;
};

const Login = () => {
  const location = useLocation();
  const nav = useNavigate();
  const { setAuth } = useAuth();
  const { lang, t, toggle } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const next = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return normalizeNext(params.get('next'));
  }, [location.search]);

  useEffect(() => {
    sessionStorage.setItem('post_auth_redirect', next);
  }, [next]);

  const startOAuth = (provider) => {
    sessionStorage.setItem('post_auth_redirect', next);
    window.location.href = `${API_BASE_URL}/auth/${encodeURIComponent(provider)}`;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login({ email, password });
      setAuth({ token: data.token, user: data.user });
      nav(next, { replace: true });
    } catch (err) {
      setError(err?.message || 'LOGIN_FAILED');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="-mx-4 -my-6 relative min-h-[100svh] overflow-hidden bg-black">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-28 -top-28 h-[26rem] w-[26rem] rounded-full bg-emerald-500/14 blur-[110px]" />
        <div className="absolute -right-28 -bottom-28 h-[28rem] w-[28rem] rounded-full bg-cyan-500/12 blur-[120px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,.05)_1px,transparent_1px)] bg-[size:36px_36px] opacity-20" />
      </div>

      <div className="relative mx-auto flex min-h-[100svh] max-w-7xl items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          <div className="relative">
            <div className="absolute -inset-1 rounded-[1.75rem] bg-gradient-to-r from-emerald-500/20 via-cyan-500/15 to-violet-500/20 blur-2xl" />
            <div className="relative space-y-5 rounded-[1.75rem] border border-white/10 bg-zinc-950/65 p-6 shadow-2xl backdrop-blur">
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-emerald-300">{t('auth_section_label')}</div>
                  <button
                    type="button"
                    onClick={toggle}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-white/10"
                  >
                    {lang === 'vi' ? t('lang_en') : t('lang_vi')}
                  </button>
                </div>
                <h1 className="text-2xl font-black tracking-tight text-zinc-50">{t('auth_login_title')}</h1>
                <div className="text-sm text-zinc-400">{t('auth_login_desc')}</div>
              </div>

              <form onSubmit={onSubmit} className="space-y-3">
                <FormField label="Email" value={email} onChange={setEmail} autoComplete="email" />
                <FormField label={t('auth_password_label')} type="password" value={password} onChange={setPassword} autoComplete="current-password" />
                {error ? (
                  <div className="rounded-xl border border-red-900/40 bg-red-950/30 px-4 py-3 text-sm text-red-200">
                    {t('common_error_prefix')}
                    {error}
                  </div>
                ) : null}
                <button
                  disabled={loading}
                  className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-zinc-950 transition hover:bg-emerald-500 hover:shadow-[0_0_22px_rgba(16,185,129,0.3)] disabled:opacity-60"
                >
                  {loading ? t('auth_processing') : t('auth_login_btn')}
                </button>
              </form>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-white/10" />
                <div className="text-xs font-semibold text-zinc-500">{t('common_or')}</div>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={() => startOAuth('google')}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-100 transition hover:bg-white/10"
                >
                  <span className="h-2 w-2 rounded-full bg-white/70" />
                  {t('auth_login_google')}
                </button>
                <button
                  type="button"
                  onClick={() => startOAuth('facebook')}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-100 transition hover:bg-white/10"
                >
                  <span className="h-2 w-2 rounded-full bg-white/70" />
                  {t('auth_login_facebook')}
                </button>
              </div>

              <div className="flex items-center justify-between text-sm">
                <Link to="/forgot-password" className="font-semibold text-emerald-300 hover:text-emerald-200">
                  {t('auth_forgot_pass')}
                </Link>
                <div className="text-zinc-400">
                  {t('auth_no_account')}{' '}
                  <Link to={`/register?next=${encodeURIComponent(next)}`} className="font-semibold text-emerald-300 hover:text-emerald-200">
                    {t('auth_register_link')}
                  </Link>
                </div>
              </div>

              <div className="text-xs text-zinc-500">
                <Link to="/" className="hover:text-zinc-300">
                  {t('common_back_to_landing')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
