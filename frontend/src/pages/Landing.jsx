import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getCars } from '../services/api/cars.js';
import { getLandingHeroImages, setAdminLandingHeroImages, uploadAdminHeroImage } from '../services/api/settings.js';
import { getApiBaseUrl } from '../services/api/client.js';
import { useAuth } from '../services/auth/AuthContext.jsx';
import { useI18n } from '../services/i18n.jsx';

const DEFAULT_HERO_IMAGES = ['/bg/home-hero.jpg', '/bg/login-car.jpg', '/bg/register-bike.jpg'];

const resolveAssetUrl = (url) => {
  const API_BASE_URL = getApiBaseUrl();
  const u = String(url || '').trim();
  if (!u) return '';
  if (u.startsWith('data:') || u.startsWith('blob:')) return u;
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  if (u.startsWith('/')) return `${API_BASE_URL}${u}`;
  return `${API_BASE_URL}/${u}`;
};

const Landing = () => {
  const nav = useNavigate();
  const { lang, t, toggle } = useI18n();
  const { user, token } = useAuth();
  const isAuthed = Boolean(token);
  const isAdmin = Boolean(user?.isAdmin || String(user?.role || '').toUpperCase() === 'ADMIN');
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const heroFileRef = useRef(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getCars()
      .then((items) => {
        if (!alive) return;
        setCars(Array.isArray(items) ? items : []);
        setError('');
      })
      .catch((e) => {
        if (!alive) return;
        setError(e?.message || 'FAILED_TO_LOAD');
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const previews = useMemo(
    () =>
      cars.slice(0, 10).map((c) => ({
        id: String(c?._id || ''),
        name: String(c?.name || 'Untitled'),
        brand: String(c?.brand || ''),
        image: resolveAssetUrl(String(c?.thumbnailUrl || c?.imageUrl || c?.image || ''))
      })),
    [cars]
  );

  const [heroImages, setHeroImages] = useState(DEFAULT_HERO_IMAGES);

  const [heroIndex, setHeroIndex] = useState(0);
  const heroImage = heroImages[heroIndex] || '';

  useEffect(() => {
    let alive = true;
    getLandingHeroImages()
      .then((images) => {
        if (!alive) return;
        const resolved = (Array.isArray(images) ? images : []).map((x) => resolveAssetUrl(x)).filter(Boolean);
        if (resolved.length) setHeroImages(resolved.slice(0, 3));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (heroImages.length <= 1) return undefined;
    const id = window.setInterval(() => {
      setHeroIndex((idx) => (idx + 1) % heroImages.length);
    }, 5200);
    return () => window.clearInterval(id);
  }, [heroImages.length]);

  useEffect(() => {
    if (!heroImages.length) return;
    setHeroIndex((idx) => Math.min(Math.max(0, idx), heroImages.length - 1));
  }, [heroImages.length]);

  const onPickHeroImages = async (filesLike) => {
    if (!isAdmin) return;
    const files = Array.from(filesLike || []).slice(0, 3);
    if (!files.length) return;
    if (!token) return;
    const uploaded = await Promise.all(files.map((file) => uploadAdminHeroImage({ token, file })));
    const urls = uploaded.map((r) => String(r?.url || '').trim()).filter(Boolean).slice(0, 3);
    const next = await setAdminLandingHeroImages({ token, images: urls });
    const resolved = next.map((x) => resolveAssetUrl(x)).filter(Boolean);
    if (resolved.length) setHeroImages(resolved.slice(0, 3));
    if (heroFileRef.current) heroFileRef.current.value = '';
  };

  const onResetHeroImages = () => {
    if (!isAdmin) return;
    if (!token) return;
    setAdminLandingHeroImages({ token, images: [] })
      .then(() => {
        setHeroImages(DEFAULT_HERO_IMAGES);
      })
      .catch(() => {});
    if (heroFileRef.current) heroFileRef.current.value = '';
  };

  return (
    <div className="bg-[#070b14]">
      <div className="fixed inset-x-0 top-0 z-50">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#020617]/75 via-[#061024]/40 to-transparent" />
        <div className="relative border-b border-white/10 bg-zinc-950/30 shadow-[0_18px_60px_-46px_rgba(56,189,248,0.42)] backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4">
            <div className="flex items-center gap-2">
              <Link to="/" className="inline-flex items-center">
                <span className="flex items-center gap-3">
                  <svg viewBox="0 0 200 200" className="h-10 w-10 shrink-0 drop-shadow-[0_18px_40px_rgba(56,189,248,0.35)]" aria-hidden="true">
                    <defs>
                      <linearGradient id="elorideMarkGradLanding" x1="20" y1="40" x2="180" y2="160" gradientUnits="userSpaceOnUse">
                        <stop offset="0" stopColor="#1d4ed8" />
                        <stop offset="0.55" stopColor="#06b6d4" />
                        <stop offset="1" stopColor="#22d3ee" />
                      </linearGradient>
                    </defs>
                    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
                      <g stroke="url(#elorideMarkGradLanding)" strokeWidth="18">
                        <path d="M44 78C74 46 126 46 158 70H168" />
                        <path d="M44 100H166l-18-18m18 18-18 18" />
                        <path d="M44 122C74 154 126 154 158 130H168" />
                      </g>
                      <g stroke="#070b14" strokeWidth="10" opacity="0.95">
                        <path d="M44 78C74 46 126 46 158 70H168" />
                        <path d="M44 100H166l-18-18m18 18-18 18" />
                        <path d="M44 122C74 154 126 154 158 130H168" />
                      </g>
                    </g>
                  </svg>
                  <span className="min-w-0 text-left">
                    <span className="block text-[18px] font-black leading-none tracking-[0.28em] text-white">ELORIDE</span>
                    <span className="mt-1 block text-[9px] font-semibold leading-none tracking-[0.22em] text-white/70">
                      MOD YOUR RIDE | SYSTEM CUSTOMS
                    </span>
                  </span>
                </span>
              </Link>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin ? (
                <>
                  <input
                    ref={heroFileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    className="hidden"
                    onChange={(e) => onPickHeroImages(e.target.files)}
                  />
                  <button
                    type="button"
                    onClick={() => heroFileRef.current?.click?.()}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-white/10"
                  >
                    {t('landing_hero_upload')}
                  </button>
                  <button
                    type="button"
                    onClick={onResetHeroImages}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-white/10"
                  >
                    {t('landing_hero_reset')}
                  </button>
                </>
              ) : null}
              <button
                type="button"
                onClick={toggle}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-white/10"
              >
                {lang === 'vi' ? t('lang_en') : t('lang_vi')}
              </button>
              {isAuthed ? (
                <Link
                  to="/dashboard"
                  className="rounded-xl bg-gradient-to-r from-sky-400 to-cyan-300 px-4 py-2 text-xs font-black text-zinc-950 shadow-[0_16px_50px_-34px_rgba(56,189,248,0.75)] transition hover:brightness-110 hover:shadow-[0_0_24px_rgba(14,165,233,0.45)] focus:outline-none focus:ring-2 focus:ring-sky-400/30"
                >
                  {t('nav_dashboard')}
                </Link>
              ) : (
                <>
                  <Link
                    to="/partner-application"
                    className="rounded-xl border border-sky-400/25 bg-sky-500/10 px-3 py-2 text-xs font-black text-sky-100 transition hover:border-sky-400/40 hover:bg-sky-500/15"
                  >
                    {t('lp_cta_partner_shop')}
                  </Link>
                  <div className="inline-flex items-center gap-2">
                    <Link
                      to="/register"
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-zinc-100 transition hover:bg-white/10"
                    >
                      {t('auth_register_link')}
                    </Link>
                    <Link
                      to="/login"
                      className="rounded-xl bg-gradient-to-r from-sky-400 to-cyan-300 px-4 py-2 text-xs font-black text-zinc-950 shadow-[0_16px_50px_-34px_rgba(56,189,248,0.75)] transition hover:brightness-110 hover:shadow-[0_0_24px_rgba(14,165,233,0.45)] focus:outline-none focus:ring-2 focus:ring-sky-400/30"
                    >
                      {t('lp_cta_login')}
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <section className="relative min-h-[100svh] overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[url('/bg/elo-landing-bg.svg')] bg-cover bg-center opacity-100" />
          <motion.div
            className="absolute -left-48 -top-48 h-[36rem] w-[36rem] rounded-full bg-sky-500/10 blur-[140px]"
            animate={{ x: [0, 18, 0], y: [0, 12, 0] }}
            transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute -right-56 top-24 h-[34rem] w-[34rem] rounded-full bg-cyan-500/10 blur-[150px]"
            animate={{ x: [0, -14, 0], y: [0, 10, 0] }}
            transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
          />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,.06)_1px,transparent_1px)] bg-[size:44px_44px] opacity-[0.08]" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#020617]/55 via-[#061024]/25 to-[#020617]/60" />
          <div className="absolute inset-0 bg-[radial-gradient(900px_420px_at_18%_22%,rgba(56,189,248,0.12),transparent_55%),radial-gradient(820px_420px_at_86%_40%,rgba(34,211,238,0.10),transparent_60%)]" />
        </div>

        <div className="relative mx-auto flex min-h-[100svh] w-full max-w-7xl flex-col justify-center gap-12 px-4 pb-20 pt-28 lg:flex-row lg:items-center">

          <div className="flex-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-zinc-200 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_12px_rgba(14,165,233,0.55)]" />
              {t('lp_badge')}
            </div>
            <h1 className="mt-6 text-4xl font-black tracking-tight text-zinc-50 sm:text-5xl lg:text-6xl">
              <span className="bg-gradient-to-r from-sky-200 via-cyan-100 to-white bg-clip-text text-transparent">
                {t('lp_title')}
              </span>
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-300 sm:text-lg">
              {t('lp_desc')}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => nav('/custom')}
                className="group inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-400 to-cyan-300 px-6 py-3 text-sm font-black text-zinc-950 shadow-[0_22px_70px_-46px_rgba(56,189,248,0.75)] transition hover:brightness-110 hover:shadow-[0_0_34px_rgba(14,165,233,0.45)]"
              >
                {t('lp_cta_start')}
                <span className="text-zinc-950/80 transition group-hover:translate-x-0.5">→</span>
              </button>
              <button
                type="button"
                onClick={() => nav('/builds')}
                className="rounded-2xl border border-white/10 bg-black/20 px-6 py-3 text-sm font-semibold text-zinc-100 backdrop-blur transition hover:border-sky-400/25 hover:bg-white/10 hover:shadow-[0_0_22px_rgba(14,165,233,0.16)]"
              >
                {t('dash_cta_hot_builds')}
              </button>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_18px_60px_-55px_rgba(0,0,0,0.9)] backdrop-blur">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(260px_160px_at_18%_18%,rgba(56,189,248,0.16),transparent_60%)]" />
                <div className="relative">
                <div className="text-xs font-semibold text-zinc-400">{t('lp_stat_models_label')}</div>
                <div className="mt-1 text-lg font-black text-zinc-50">{cars.length || 0}</div>
                </div>
              </div>
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_18px_60px_-55px_rgba(0,0,0,0.9)] backdrop-blur">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(260px_160px_at_18%_18%,rgba(34,211,238,0.12),transparent_60%)]" />
                <div className="relative">
                <div className="text-xs font-semibold text-zinc-400">{t('lp_stat_flow_label')}</div>
                <div className="mt-1 text-sm font-semibold text-zinc-100">{t('lp_stat_flow_value')}</div>
                <div className="mt-1 text-xs text-zinc-500">{t('lp_stat_flow_hint')}</div>
                </div>
              </div>
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_18px_60px_-55px_rgba(0,0,0,0.9)] backdrop-blur">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(260px_160px_at_18%_18%,rgba(168,85,247,0.10),transparent_60%)]" />
                <div className="relative">
                <div className="text-xs font-semibold text-zinc-400">{t('lp_stat_market_label')}</div>
                <div className="mt-1 text-sm font-semibold text-zinc-100">{t('lp_stat_market_value')}</div>
                <div className="mt-1 text-xs text-zinc-500">{t('lp_stat_market_hint')}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1">
            <motion.div
              className="relative mx-auto max-w-xl"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
            >
              <div className="absolute -inset-1 rounded-[2.25rem] bg-sky-500/10 blur-2xl" />
              <motion.div
                className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-zinc-950/60 shadow-[0_28px_110px_-78px_rgba(0,0,0,0.95)] backdrop-blur"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
              >
                <div className="aspect-[16/10] w-full bg-zinc-900">
                  <AnimatePresence mode="wait">
                    {heroImage ? (
                      <motion.img
                        key={heroImage}
                        src={heroImage}
                        alt="3D preview"
                        className="h-full w-full object-cover"
                        onError={() => {
                          if (heroImages.length <= 1) return;
                          setHeroIndex((idx) => (idx + 1) % heroImages.length);
                        }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.35 }}
                      />
                    ) : (
                      <motion.div key="empty" className="h-full w-full bg-zinc-900" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
                    )}
                  </AnimatePresence>
                </div>
                <div className="space-y-2 p-6">
                  <div className="text-sm font-semibold text-zinc-100">{t('lp_preview_title')}</div>
                  <div className="text-xs text-zinc-400">{t('lp_preview_desc')}</div>
                </div>
              </motion.div>
            </motion.div>
          </div>

          <div className="pointer-events-none absolute bottom-6 left-0 right-0">
            <div className="mx-auto flex max-w-7xl justify-center px-4">
              <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-zinc-300 backdrop-blur">
                {t('lp_scroll_hint')}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl space-y-8 px-4 py-16">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-black tracking-tight text-zinc-50">{t('lp_section_title')}</h2>
          <div className="text-sm text-zinc-400">{t('lp_section_desc')}</div>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          <div className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_22px_80px_-70px_rgba(0,0,0,0.95)] transition hover:-translate-y-1 hover:border-sky-400/25 hover:bg-white/10">
            <div className="pointer-events-none absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100">
              <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-sky-500/10 blur-[80px]" />
            </div>
            <div className="relative text-xs font-semibold text-zinc-400">01</div>
            <div className="mt-2 text-sm font-semibold text-zinc-100">{t('lp_step1_title')}</div>
            <div className="mt-2 text-sm text-zinc-300">{t('lp_step1_desc')}</div>
          </div>
          <div className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_22px_80px_-70px_rgba(0,0,0,0.95)] transition hover:-translate-y-1 hover:border-sky-400/25 hover:bg-white/10">
            <div className="pointer-events-none absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100">
              <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-cyan-500/10 blur-[80px]" />
            </div>
            <div className="relative text-xs font-semibold text-zinc-400">02</div>
            <div className="mt-2 text-sm font-semibold text-zinc-100">{t('lp_step2_title')}</div>
            <div className="mt-2 text-sm text-zinc-300">{t('lp_step2_desc')}</div>
          </div>
          <div className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_22px_80px_-70px_rgba(0,0,0,0.95)] transition hover:-translate-y-1 hover:border-sky-400/25 hover:bg-white/10">
            <div className="pointer-events-none absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100">
              <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-500/10 blur-[80px]" />
            </div>
            <div className="relative text-xs font-semibold text-zinc-400">03</div>
            <div className="mt-2 text-sm font-semibold text-zinc-100">{t('lp_step3_title')}</div>
            <div className="mt-2 text-sm text-zinc-300">{t('lp_step3_desc')}</div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_24px_90px_-76px_rgba(0,0,0,0.95)] backdrop-blur">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(700px_260px_at_18%_18%,rgba(56,189,248,0.14),transparent_62%)]" />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-zinc-100">{t('lp_ready_title')}</div>
              <div className="mt-1 text-sm text-zinc-400">{t('lp_ready_desc')}</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => nav('/custom')}
                className="rounded-2xl bg-gradient-to-r from-sky-400 to-cyan-300 px-5 py-3 text-sm font-black text-zinc-950 shadow-[0_18px_60px_-42px_rgba(56,189,248,0.75)] transition hover:brightness-110"
              >
                {t('lp_cta_start')}
              </button>
              <Link
                to="/marketplace"
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-zinc-100 transition hover:bg-white/10"
              >
                {t('lp_cta_market')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl space-y-8 px-4 pb-20">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-zinc-50">{t('lp_preview_section_title')}</h2>
            <div className="mt-2 text-sm text-zinc-400">{t('lp_preview_section_desc')}</div>
          </div>
          <Link to="/login" className="text-sm font-semibold text-sky-300 hover:text-sky-200">
            {t('lp_preview_login_link')}
          </Link>
        </div>

        {error ? <div className="rounded-2xl border border-red-900/40 bg-red-950/30 p-4 text-sm text-red-200">{error}</div> : null}

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <>
              <div className="aspect-[16/10] animate-pulse rounded-3xl bg-zinc-900" />
              <div className="aspect-[16/10] animate-pulse rounded-3xl bg-zinc-900" />
              <div className="aspect-[16/10] animate-pulse rounded-3xl bg-zinc-900" />
              <div className="aspect-[16/10] animate-pulse rounded-3xl bg-zinc-900" />
              <div className="aspect-[16/10] animate-pulse rounded-3xl bg-zinc-900" />
              <div className="aspect-[16/10] animate-pulse rounded-3xl bg-zinc-900" />
            </>
          ) : previews.length ? (
            previews.map((p) => (
              <div
                key={p.id || p.name}
                className="group overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/40 shadow-[0_22px_80px_-70px_rgba(0,0,0,0.95)] transition hover:-translate-y-1 hover:border-sky-400/25 hover:bg-white/5"
              >
                <div className="aspect-[16/10] w-full bg-zinc-900">
                  {p.image ? (
                    <img alt={p.name} src={p.image} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                  ) : (
                    <div className="h-full w-full bg-zinc-900" />
                  )}
                </div>
                <div className="space-y-2 p-5">
                  <div className="text-sm font-semibold text-zinc-100">{p.name}</div>
                  <div className="text-xs text-zinc-400">{p.brand || '—'}</div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-3xl border border-zinc-800/70 bg-zinc-950/40 p-6 text-sm text-zinc-400 sm:col-span-2 lg:col-span-3">
              {t('lp_no_cars')}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Landing;
