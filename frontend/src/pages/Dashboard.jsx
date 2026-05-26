import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { getBrands, getCars } from '../services/api/cars.js';
import { getDashboardHeroImages } from '../services/api/settings.js';
import { getApiBaseUrl } from '../services/api/client.js';
import { useI18n } from '../services/i18n.jsx';

const resolveAssetUrl = (url) => {
  const API_BASE_URL = getApiBaseUrl();
  const u = String(url || '').trim();
  if (!u) return '';
  if (u.startsWith('data:') || u.startsWith('blob:')) return u;
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  if (u.startsWith('/')) return `${API_BASE_URL}${u}`;
  return `${API_BASE_URL}/${u}`;
};

const PLACEHOLDER_IMAGE =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="750" viewBox="0 0 1200 750">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#0f172a"/>
          <stop offset="1" stop-color="#27272a"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="750" fill="url(#g)"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#94a3b8" font-family="Arial, sans-serif" font-size="42">
        Showroom
      </text>
    </svg>`
  );

const normalizeBrandKey = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '')
    .trim();

const knownBrandLogo = (name) => {
  const k = normalizeBrandKey(name);
  if (k === 'yamaha') return 'https://commons.wikimedia.org/wiki/Special:FilePath/Yamaha_logo.svg';
  if (k === 'honda') return 'https://commons.wikimedia.org/wiki/Special:FilePath/Honda-logo.svg';
  if (k === 'kawasaki') return 'https://commons.wikimedia.org/wiki/Special:FilePath/Kawasaki-logo.svg';
  if (k === 'ducati') return 'https://commons.wikimedia.org/wiki/Special:FilePath/Logo_Ducati.svg';
  if (k === 'suzuki') return 'https://commons.wikimedia.org/wiki/Special:FilePath/Suzuki_logo.svg';
  return '';
};

const BrandLogoBadge = ({ name, logo }) => {
  const [idx, setIdx] = useState(0);
  const [failed, setFailed] = useState(false);
  const label = String(name || '').trim();
  const raw = String(logo || '').trim();
  const src = raw ? resolveAssetUrl(raw) : '';
  const known = knownBrandLogo(label);
  const candidates = useMemo(() => [src, known].map((x) => String(x || '').trim()).filter(Boolean), [known, src]);
  const active = candidates[idx] || '';

  useEffect(() => {
    setIdx(0);
    setFailed(false);
  }, [label, raw]);

  if (!active || failed) return null;

  return (
    <div className="h-9 w-14 overflow-hidden rounded-xl border border-white/10 bg-white/90 px-2 py-1 shadow-[0_18px_40px_-34px_rgba(0,0,0,0.9)]">
      <img
        src={active}
        alt={label}
        className="h-full w-full object-contain"
        onError={() => {
          const next = idx + 1;
          if (next < candidates.length) setIdx(next);
          else setFailed(true);
        }}
      />
    </div>
  );
};

const Dashboard = () => {
  const nav = useNavigate();
  const { t } = useI18n();
  const [cars, setCars] = useState([]);
  const [brands, setBrands] = useState([]);
  const [heroImages, setHeroImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const displayCarName = (name) => {
    const n = String(name || '').trim();
    if (n.toLowerCase().replace(/[^a-z0-9]+/g, '') === 'xsr155') return 'XSR155';
    return n || 'Untitled';
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getCars({ metrics: true })
      .then((items) => {
        if (!alive) return;
        setCars(items);
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

  useEffect(() => {
    let alive = true;
    getBrands()
      .then((items) => {
        if (!alive) return;
        setBrands(Array.isArray(items) ? items : []);
      })
      .catch(() => {
        if (!alive) return;
        setBrands([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    getDashboardHeroImages()
      .then((images) => {
        if (!alive) return;
        setHeroImages(Array.isArray(images) ? images.slice(0, 3) : []);
      })
      .catch(() => {
        if (!alive) return;
        setHeroImages([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const heroCar = cars[0] || null;
  const heroImage = useMemo(() => {
    const raw = heroImages[0] || heroCar?.thumbnailUrl || heroCar?.imageUrl || heroCar?.image || '';
    return raw ? resolveAssetUrl(raw) : PLACEHOLDER_IMAGE;
  }, [heroCar, heroImages]);

  const featuredBuilds = useMemo(
    () => [
      { id: 'neon-track', name: 'Neon Track', style: 'track', tagline: t('dash_featured_tagline_track') },
      { id: 'street-stealth', name: 'Street Stealth', style: 'street', tagline: t('dash_featured_tagline_street') },
      { id: 'touring-ready', name: 'Touring Ready', style: 'touring', tagline: t('dash_featured_tagline_touring') }
    ],
    [t]
  );

  const styleBadge = (style) => {
    const s = String(style || '').toLowerCase();
    if (s === 'track') return { label: 'TRACK', cls: 'border-sky-500/25 bg-sky-500/10 text-sky-200' };
    if (s === 'touring') return { label: 'TOURING', cls: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-200' };
    return { label: 'STREET', cls: 'border-sky-500/25 bg-sky-500/10 text-sky-200' };
  };

  return (
    <div className="relative isolate min-h-[calc(100vh-3rem)] bg-black pb-3">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-[#06131f] to-black" />
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-sky-500/12 blur-[120px]" />
        <div className="absolute top-24 right-[-120px] h-[420px] w-[420px] rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="absolute bottom-[-160px] left-[-160px] h-[520px] w-[520px] rounded-full bg-sky-500/8 blur-[140px]" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-black/80" />
      </div>

      <div className="relative z-10 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="relative overflow-hidden rounded-[36px] border border-white/10 bg-black/35 shadow-[0_0_34px_rgba(14,165,233,0.14)] backdrop-blur-xl"
        >
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-br from-black via-[#071a28] to-black" />
            <div className="absolute -left-40 top-10 h-[520px] w-[520px] rounded-full bg-sky-500/14 blur-[130px]" />
            <div className="absolute -right-48 bottom-[-180px] h-[560px] w-[560px] rounded-full bg-cyan-500/12 blur-[140px]" />
          </div>

          <div className="relative grid gap-6 p-7 md:grid-cols-[1.05fr_0.95fr] md:items-center md:p-10">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-zinc-200">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_14px_rgba(14,165,233,0.55)]" />
                {t('nav_dashboard')}
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-zinc-50 sm:text-5xl">
                {t('dash_hero_title')}
              </h1>
              <div className="mt-3 max-w-xl text-sm text-zinc-300 sm:text-base">
                {t('dash_hero_subtitle_exp')}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                {brands
                  .slice()
                  .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')))
                  .slice(0, 8)
                  .map((b, i) => (
                    <BrandLogoBadge key={String(b?._id || b?.key || b?.name || i)} name={b?.name} logo={b?.logo} />
                  ))}
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => nav('/custom')}
                  className="inline-flex items-center justify-center rounded-2xl bg-sky-400 px-6 py-3 text-sm font-semibold text-zinc-950 transition duration-300 hover:bg-sky-300 hover:shadow-[0_0_34px_rgba(14,165,233,0.5)]"
                >
                  {t('dash_cta_start_build')}
                </button>
                <button
                  type="button"
                  onClick={() => nav('/bikes')}
                  className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-zinc-100 transition duration-300 hover:border-sky-500/25 hover:bg-white/10 hover:shadow-[0_0_22px_rgba(14,165,233,0.2)]"
                >
                  {t('landing_guided_browse_all')}
                </button>
              </div>

              {error ? (
                <div className="mt-6 rounded-2xl border border-red-900/40 bg-red-950/30 p-4 text-sm text-red-200">
                  {t(error)}
                </div>
              ) : null}
            </div>

            <div className="relative">
              <div className="absolute -inset-8 rounded-[34px] bg-sky-500/12 blur-2xl" />
              <div className="relative overflow-hidden rounded-[34px] border border-white/10 bg-zinc-950/40 shadow-[0_0_36px_rgba(0,0,0,0.55)] backdrop-blur-xl">
                {heroCar?._id ? (
                  <button
                    type="button"
                    onClick={() => nav('/custom')}
                    aria-label={t('custom_open_3d')}
                    className="block aspect-[16/11] w-full bg-gradient-to-br from-[#06101a] via-[#0b2233] to-[#030508] text-left outline-none transition hover:brightness-[1.03] focus-visible:ring-2 focus-visible:ring-sky-400/50"
                  >
                    {heroImage ? (
                      <img src={heroImage} alt={heroCar?.name || 'Hero'} className="h-full w-full object-cover opacity-95" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <div className="text-center">
                          <div className="text-xs font-semibold tracking-widest text-sky-300/90">{t('dash_showroom_label')}</div>
                          <div className="mt-2 text-2xl font-black text-zinc-100">{t('dash_showroom_mode')}</div>
                          <div className="mt-1 text-sm text-zinc-400">{t('dash_showroom_placeholder')}</div>
                        </div>
                      </div>
                    )}
                  </button>
                ) : (
                  <div className="aspect-[16/11] w-full bg-gradient-to-br from-[#06101a] via-[#0b2233] to-[#030508]">
                    {heroImage ? (
                      <img src={heroImage} alt={heroCar?.name || 'Hero'} className="h-full w-full object-cover opacity-95" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <div className="text-center">
                          <div className="text-xs font-semibold tracking-widest text-sky-300/90">{t('dash_showroom_label')}</div>
                          <div className="mt-2 text-2xl font-black text-zinc-100">{t('dash_showroom_mode')}</div>
                          <div className="mt-1 text-sm text-zinc-400">{t('dash_showroom_placeholder')}</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {loading ? (
                <div className="absolute left-4 top-4 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs font-semibold text-zinc-200 backdrop-blur">
                  {t('dash_loading')}
                </div>
              ) : null}
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="overflow-hidden rounded-[34px] border border-white/10 bg-black/30 shadow-[0_0_34px_rgba(14,165,233,0.12)] backdrop-blur-xl"
        >
          <div className="flex flex-col gap-2 border-b border-white/10 px-6 py-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-xs font-semibold tracking-widest text-sky-300/90">{t('dash_featured_badge')}</div>
              <div className="mt-1 text-xl font-black text-zinc-50">{t('dash_featured_title')}</div>
              <div className="mt-1 text-sm text-zinc-400">{t('dash_featured_desc')}</div>
            </div>
            <button
              type="button"
              onClick={() => nav('/builds')}
              className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-100 transition duration-300 hover:border-sky-500/25 hover:bg-white/10 hover:shadow-[0_0_22px_rgba(14,165,233,0.18)]"
            >
              {t('dash_view_all')}
            </button>
          </div>

          <div className="grid gap-4 p-6 lg:grid-cols-3">
            {featuredBuilds.map((b) => {
              const badge = styleBadge(b.style);
              return (
                <motion.div
                  key={b.id}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ duration: 0.28, ease: 'easeOut' }}
                  className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:border-sky-500/25 hover:bg-sky-500/5 hover:shadow-[0_0_34px_rgba(14,165,233,0.22)]"
                >
                  <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <div className="absolute -left-16 -top-16 h-64 w-64 rounded-full bg-sky-500/10 blur-[70px]" />
                  </div>
                  <div className="relative">
                    <div className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-black tracking-widest ${badge.cls}`}>
                      {badge.label}
                    </div>
                    <div className="mt-4 text-xl font-black text-zinc-50">{b.name}</div>
                    <div className="mt-2 text-sm text-zinc-400">{b.tagline}</div>
                    <button
                      type="button"
                      onClick={() => nav('/builds')}
                      className="mt-5 inline-flex items-center justify-center rounded-2xl bg-sky-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition duration-300 hover:bg-sky-300 hover:shadow-[0_0_28px_rgba(14,165,233,0.45)]"
                    >
                      {t('dash_view_details')}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;
