import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { login } from '../services/api/auth.js';
import { useAuth } from '../services/auth/AuthContext.jsx';
import { getApiBaseUrl } from '../services/api/client.js';
import { useI18n } from '../services/i18n.jsx';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { validateEmail } from '../services/validation.js';

const getLoginCarBgUrl = () => {
  try {
    const v = typeof window !== 'undefined' ? localStorage.getItem('carbanana.loginCarBg') : '';
    if (v) {
      if (v === '/bg/login-car.png' || v.endsWith('/bg/login-car.png')) return '/bg/login-car.jpg';
      return v;
    }
  } catch {}
  return '/bg/login-car.jpg';
};

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
  const [carBgUrl, setCarBgUrl] = useState(getLoginCarBgUrl());
  const [carBgReady, setCarBgReady] = useState(false);
  const rightRef = useRef(null);
  const parallaxX = useMotionValue(0);
  const parallaxY = useMotionValue(0);
  const parallaxXSmooth = useSpring(parallaxX, { stiffness: 120, damping: 18, mass: 0.6 });
  const parallaxYSmooth = useSpring(parallaxY, { stiffness: 120, damping: 18, mass: 0.6 });
  const glowX = useTransform(parallaxXSmooth, (v) => v * -0.3);
  const glowY = useTransform(parallaxYSmooth, (v) => v * -0.25);

  const next = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return normalizeNext(params.get('next'));
  }, [location.search]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const prefill = String(params.get('email') || '').trim();
    if (!prefill) return;
    setEmail((prev) => prev || prefill);
  }, [location.search]);

  useEffect(() => {
    sessionStorage.setItem('post_auth_redirect', next);
  }, [next]);

  useEffect(() => {
    const nextUrl = getLoginCarBgUrl();
    setCarBgUrl(nextUrl);
    setCarBgReady(false);
    const img = new Image();
    img.onload = () => setCarBgReady(true);
    img.onerror = () => setCarBgReady(false);
    img.src = nextUrl;
  }, []);

  const startOAuth = (provider) => {
    sessionStorage.setItem('post_auth_redirect', next);
    const frontend = typeof window !== 'undefined' ? window.location.origin : '';
    const url = new URL(`${getApiBaseUrl()}/auth/${encodeURIComponent(provider)}`);
    if (frontend) url.searchParams.set('frontend', frontend);
    window.location.href = url.toString();
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const checked = validateEmail(email);
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    setLoading(true);
    try {
      const data = await login({ email: checked.value, password });
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
      <div className="relative mx-auto grid min-h-[100svh] w-full grid-cols-1 lg:grid-cols-12">
        <div className="relative flex items-center lg:col-span-5">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-b from-black via-[#070a10] to-black" />
            <div className="absolute inset-0 bg-[radial-gradient(900px_620px_at_40%_20%,rgba(255,255,255,0.06),rgba(0,0,0,0)_55%)]" />
          </div>

          <div className="relative w-full px-6 py-10 sm:px-10 lg:px-12">
            <div className="mx-auto w-full max-w-[520px] lg:mx-0">
              <div className="mb-7 flex items-center justify-between gap-3">
                <Link to="/" className="inline-flex items-center">
                  <span className="flex items-center gap-3">
                    <img
                      src="/logo-mark.png"
                      alt="ELORIDE"
                      className="h-20 w-20 shrink-0 select-none drop-shadow-[0_18px_40px_rgba(56,189,248,0.35)]"
                      draggable={false}
                    />
                    <span className="min-w-0 text-left">
                      <span className="block text-[18px] font-black leading-none tracking-[0.28em] text-white">ELORIDE</span>
                      <span className="mt-1 block text-[9px] font-semibold leading-none tracking-[0.22em] text-white/70">
                        MOD YOUR RIDE | SYSTEM CUSTOMS
                      </span>
                    </span>
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={toggle}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 shadow-[0_8px_30px_rgba(0,0,0,0.5)] transition hover:bg-white/10"
                >
                  {lang === 'vi' ? t('lang_en') : t('lang_vi')}
                </button>
              </div>

              <div className="relative">
                <div className="pointer-events-none absolute -inset-3 rounded-[26px] bg-[radial-gradient(700px_520px_at_30%_10%,rgba(34,211,238,0.18),rgba(0,0,0,0)_62%)] blur-3xl" />
                <div className="relative rounded-2xl border border-white/10 bg-black/40 p-7 shadow-[0_26px_80px_rgba(0,0,0,0.75),0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur-2xl">
                  <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_32%_18%,rgba(255,255,255,0.10),transparent_48%)]" />
                  <div className="space-y-1">
                    <div className="text-xs font-semibold tracking-[0.22em] text-cyan-300/90">
                      {t('auth_section_label')}
                    </div>
                    <h1 className="text-2xl font-black tracking-tight text-zinc-50">{t('auth_login_title')}</h1>
                    <div className="h-px w-14 bg-gradient-to-r from-cyan-300/90 via-sky-500/70 to-transparent" />
                    <div className="text-sm text-zinc-400">{t('auth_login_desc')}</div>
                  </div>

                  <form onSubmit={onSubmit} autoComplete="off" className="mt-6 space-y-4">
                    <label className="block">
                      <div className="mb-1.5 text-sm font-semibold text-zinc-200">Email</div>
                      <input
                        name="cb_email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="off"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        className="w-full rounded-xl border border-white/10 bg-white/90 px-4 py-3 text-sm text-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] outline-none transition focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/25"
                        placeholder="you@company.com"
                      />
                    </label>
                    <label className="block">
                      <div className="mb-1.5 text-sm font-semibold text-zinc-200">{t('auth_password_label')}</div>
                      <input
                        name="cb_password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
                        className="w-full rounded-xl border border-white/10 bg-white/90 px-4 py-3 text-sm text-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] outline-none transition focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/25"
                        placeholder="••••••••"
                      />
                    </label>

                    {error ? (
                      <div className="rounded-xl border border-red-900/40 bg-red-950/30 px-4 py-3 text-sm text-red-200">
                        {t('common_error_prefix')}
                        {error}
                      </div>
                    ) : null}

                    <button
                      disabled={loading}
                      className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-cyan-300 via-sky-500 to-blue-600 px-4 py-3 text-sm font-black text-white shadow-[0_0_0_1px_rgba(34,211,238,0.18),0_18px_50px_rgba(0,0,0,0.55)] transition hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 disabled:opacity-60"
                    >
                      <motion.span
                        aria-hidden="true"
                        className="pointer-events-none absolute -left-1/2 top-0 h-full w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-25 blur-[1px]"
                        animate={{ x: ['-20%', '240%'] }}
                        transition={{ duration: 8.5, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1.6 }}
                      />
                      <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                        <span className="absolute -left-10 top-1/2 h-24 w-24 -translate-y-1/2 rounded-full bg-white/25 blur-2xl" />
                        <span className="absolute -right-10 top-1/2 h-24 w-24 -translate-y-1/2 rounded-full bg-white/18 blur-2xl" />
                      </span>
                      <span className="relative">{loading ? t('auth_processing') : t('auth_login_btn')}</span>
                    </button>
                  </form>

                  <div className="my-6 flex items-center gap-3">
                    <div className="h-px flex-1 bg-white/10" />
                    <div className="text-xs font-semibold text-zinc-500">{t('common_or')}</div>
                    <div className="h-px flex-1 bg-white/10" />
                  </div>

                  <div className="grid gap-2">
                    <button
                      type="button"
                      onClick={() => startOAuth('google')}
                      className="group relative inline-flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl border border-sky-400/25 bg-gradient-to-r from-sky-500/15 via-cyan-500/10 to-sky-500/15 px-4 py-3 text-sm font-bold text-zinc-50 shadow-[0_18px_70px_-52px_rgba(56,189,248,0.45)] backdrop-blur transition hover:border-sky-300/40 hover:from-sky-500/20 hover:via-cyan-500/15 hover:to-sky-500/20 hover:shadow-[0_22px_80px_-52px_rgba(56,189,248,0.65)] focus:outline-none focus:ring-2 focus:ring-sky-400/35"
                    >
                      <span className="pointer-events-none absolute -inset-10 bg-[radial-gradient(420px_200px_at_50%_30%,rgba(56,189,248,0.25),transparent_60%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                      <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.16),transparent)]" />
                      <span className="relative inline-flex items-center justify-center gap-3">
                        <svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.8 6 29.7 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.2-.4-3.5z"/>
                          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.8 6 29.7 4 24 4c-7.7 0-14.4 4.3-17.7 10.7z"/>
                          <path fill="#4CAF50" d="M24 44c5.6 0 10.7-2.1 14.6-5.5l-6.8-5.6C29.8 34.5 27 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.6 5.1C9.4 39.7 16.2 44 24 44z"/>
                          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3-3.2 5.2-5.9 6.5l.1.1 6.8 5.6c-.5.4 7.7-5.6 7.7-16.2 0-1.3-.1-2.2-.4-3.5z"/>
                        </svg>
                        {t('auth_login_google')}
                      </span>
                    </button>
                  </div>

                  <div className="mt-6 flex items-center justify-between text-sm">
                    <Link to="/forgot-password" className="font-semibold text-cyan-300 hover:text-cyan-200">
                      {t('auth_forgot_pass')}
                    </Link>
                    <div className="text-zinc-400">
                      {t('auth_no_account')}{' '}
                      <Link to={`/register?next=${encodeURIComponent(next)}`} className="font-semibold text-cyan-300 hover:text-cyan-200">
                        {t('auth_register_link')}
                      </Link>
                    </div>
                  </div>

                  <div className="mt-4 text-xs text-zinc-500">
                    <Link to="/" className="hover:text-zinc-300">
                      {t('common_back_to_landing')}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          ref={rightRef}
          onMouseLeave={() => {
            parallaxX.set(0);
            parallaxY.set(0);
          }}
          onMouseMove={(e) => {
            const el = rightRef.current;
            if (!el) return;
            const r = el.getBoundingClientRect();
            const nx = (e.clientX - r.left) / Math.max(1, r.width) - 0.5;
            const ny = (e.clientY - r.top) / Math.max(1, r.height) - 0.5;
            parallaxX.set(nx * 18);
            parallaxY.set(ny * 12);
          }}
          className="relative hidden overflow-hidden lg:col-span-7 lg:block"
        >
          <div className="absolute inset-0 bg-black" />
          <div className="pointer-events-none absolute inset-y-0 left-0 w-px bg-gradient-to-b from-white/25 via-white/10 to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-cyan-400/30 via-sky-500/10 to-transparent opacity-70 blur-sm" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1200px_760px_at_80%_45%,rgba(0,0,0,0)_52%,rgba(0,0,0,0.72)_100%)]" />
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-28 opacity-60"
            style={{
              x: glowX,
              y: glowY,
              backgroundImage: 'radial-gradient(closest-side, rgba(34,211,238,0.22), transparent 62%)'
            }}
          />
          <motion.img
            src={carBgUrl}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
            style={{
              x: parallaxXSmooth,
              y: parallaxYSmooth,
              objectPosition: '78% 55%',
              filter: 'saturate(1.06) contrast(1.06) brightness(1.01)',
              transformOrigin: '78% 55%',
              willChange: 'transform'
            }}
            animate={{ scale: [1.01, 1.025, 1.01], opacity: carBgReady ? 1 : 0 }}
            transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut', opacity: { duration: 0.42, ease: 'easeOut' } }}
          />
        </div>
      </div>
    </div>
  );
};

export default Login;
