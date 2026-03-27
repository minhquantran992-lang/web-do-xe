import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getCars } from '../services/api/cars.js';
import { useI18n } from '../services/i18n.jsx';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

const resolveAssetUrl = (url) => {
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
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
      cars.slice(0, 6).map((c) => ({
        id: String(c?._id || ''),
        name: String(c?.name || 'Untitled'),
        brand: String(c?.brand || ''),
        image: resolveAssetUrl(String(c?.image || ''))
      })),
    [cars]
  );

  const heroImage = previews.find((p) => p.image)?.image || '';

  return (
    <div className="-mx-4 -my-6 bg-black">
      <section className="relative min-h-[100svh] overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <motion.div
            className="absolute -left-48 -top-48 h-[36rem] w-[36rem] rounded-full bg-emerald-500/10 blur-[140px]"
            animate={{ x: [0, 18, 0], y: [0, 12, 0] }}
            transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
          />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,.06)_1px,transparent_1px)] bg-[size:44px_44px] opacity-15" />
          <div className="absolute inset-0 bg-gradient-to-b from-black via-black/55 to-black" />
        </div>

        <div className="relative mx-auto flex min-h-[100svh] w-full max-w-7xl flex-col justify-center gap-12 px-4 py-16 lg:flex-row lg:items-center">
          <div className="absolute left-0 right-0 top-0">
            <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-5">
              <div className="flex items-center gap-2">
                <Link to="/" className="text-sm font-black tracking-tight text-zinc-100">
                  {t('app_name')}
                </Link>
                <button
                  type="button"
                  onClick={toggle}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-white/10"
                >
                  {lang === 'vi' ? t('lang_en') : t('lang_vi')}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-white/10"
                >
                  {t('lp_cta_login')}
                </Link>
                <button
                  type="button"
                  onClick={() => nav('/custom')}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-zinc-950 transition hover:bg-emerald-500 hover:shadow-[0_0_22px_rgba(16,185,129,0.25)]"
                >
                  {t('lp_cta_start')}
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-zinc-200 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.55)]" />
              {t('lp_badge')}
            </div>
            <h1 className="mt-6 text-4xl font-black tracking-tight text-zinc-50 sm:text-5xl lg:text-6xl">
              {t('lp_title')}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-300 sm:text-lg">
              {t('lp_desc')}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => nav('/custom')}
                className="rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-bold text-zinc-950 transition hover:bg-emerald-500 hover:shadow-[0_0_28px_rgba(16,185,129,0.35)]"
              >
                {t('lp_cta_start')}
              </button>
              <button
                type="button"
                onClick={() => nav('/login')}
                className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-zinc-100 backdrop-blur transition hover:bg-white/10"
              >
                {t('lp_cta_login')}
              </button>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <div className="text-xs font-semibold text-zinc-400">{t('lp_stat_models_label')}</div>
                <div className="mt-1 text-lg font-black text-zinc-50">{cars.length || 0}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <div className="text-xs font-semibold text-zinc-400">{t('lp_stat_flow_label')}</div>
                <div className="mt-1 text-sm font-semibold text-zinc-100">{t('lp_stat_flow_value')}</div>
                <div className="mt-1 text-xs text-zinc-500">{t('lp_stat_flow_hint')}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <div className="text-xs font-semibold text-zinc-400">{t('lp_stat_market_label')}</div>
                <div className="mt-1 text-sm font-semibold text-zinc-100">{t('lp_stat_market_value')}</div>
                <div className="mt-1 text-xs text-zinc-500">{t('lp_stat_market_hint')}</div>
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
              <div className="absolute -inset-1 rounded-[2.25rem] bg-emerald-500/10 blur-2xl" />
              <motion.div
                className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-zinc-950/60 shadow-2xl backdrop-blur"
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
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="text-xs font-semibold text-zinc-400">01</div>
            <div className="mt-2 text-sm font-semibold text-zinc-100">{t('lp_step1_title')}</div>
            <div className="mt-2 text-sm text-zinc-300">{t('lp_step1_desc')}</div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="text-xs font-semibold text-zinc-400">02</div>
            <div className="mt-2 text-sm font-semibold text-zinc-100">{t('lp_step2_title')}</div>
            <div className="mt-2 text-sm text-zinc-300">{t('lp_step2_desc')}</div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="text-xs font-semibold text-zinc-400">03</div>
            <div className="mt-2 text-sm font-semibold text-zinc-100">{t('lp_step3_title')}</div>
            <div className="mt-2 text-sm text-zinc-300">{t('lp_step3_desc')}</div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-zinc-100">{t('lp_ready_title')}</div>
              <div className="mt-1 text-sm text-zinc-400">{t('lp_ready_desc')}</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => nav('/custom')}
                className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-zinc-950 transition hover:bg-emerald-500"
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
          <Link to="/login" className="text-sm font-semibold text-emerald-300 hover:text-emerald-200">
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
              <div key={p.id || p.name} className="overflow-hidden rounded-3xl border border-zinc-800/70 bg-zinc-950/40">
                <div className="aspect-[16/10] w-full bg-zinc-900">
                  {p.image ? <img alt={p.name} src={p.image} className="h-full w-full object-cover" /> : <div className="h-full w-full bg-zinc-900" />}
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
