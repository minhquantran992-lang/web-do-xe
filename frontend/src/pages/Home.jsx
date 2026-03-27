import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getCars } from '../services/api/cars.js';
import { useI18n } from '../services/i18n.jsx';
import { useAuth } from '../services/auth/AuthContext.jsx';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

const resolveAssetUrl = (url) => {
  const u = String(url || '').trim();
  if (!u) return '';
  if (u.startsWith('data:') || u.startsWith('blob:')) return u;
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  if (u.startsWith('/')) return `${API_BASE_URL}${u}`;
  return `${API_BASE_URL}/${u}`;
};

const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[\s\-_.]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim();

const bikeSearchKey = (bike) => normalizeText(`${bike?.name || ''} ${bike?.brand || ''} ${bike?.category || ''}`);

const Home = () => {
  const { t } = useI18n();
  const { isAuthed } = useAuth();
  const nav = useNavigate();
  const [cars, setCars] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchWrapRef = useRef(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getCars()
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
    const onDocMouseDown = (e) => {
      const wrap = searchWrapRef.current;
      if (!wrap) return;
      if (wrap.contains(e.target)) return;
      setSearchOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  const suggestions = useMemo(() => {
    const q = normalizeText(query);
    if (!q) return [];
    return cars
      .filter((c) => bikeSearchKey(c).includes(q))
      .slice(0, 6)
      .map((c) => ({
        id: c._id,
        name: c.name || 'Untitled',
        brand: c.brand || '',
        category: c.category || '',
        image: resolveAssetUrl(c.image) || '',
        href: isAuthed ? `/configurator/${c._id}` : `/bikes?auth=required&go=${encodeURIComponent(c._id)}`
      }));
  }, [cars, query, isAuthed]);

  const categoryLabel = (key) => {
    const k = String(key || '').trim().toLowerCase();
    if (k === 'scooter') return t('category_scooter');
    if (k === 'oto' || k === 'car') return t('category_oto');
    if (k === 'pkl' || k === 'bigbike' || k === 'underbone' || k === 'sport' || k === 'naked') return t('category_pkl');
    return '';
  };

  const categories = useMemo(() => {
    const pickImage = (key) => resolveAssetUrl(cars.find((c) => String(c?.category || '').toLowerCase() === key)?.image) || '';
    return [
      {
        key: 'scooter',
        label: categoryLabel('scooter'),
        title: t('landing_cat_scooter_title'),
        desc: t('landing_cat_scooter_desc'),
        href: '/bikes?category=scooter',
        image: pickImage('scooter')
      },
      {
        key: 'pkl',
        label: categoryLabel('pkl'),
        title: t('landing_cat_pkl_title'),
        desc: t('landing_cat_pkl_desc'),
        href: '/bikes?category=pkl',
        image: pickImage('pkl')
      },
      {
        key: 'oto',
        label: categoryLabel('oto'),
        title: t('landing_cat_oto_title'),
        desc: t('landing_cat_oto_desc'),
        href: '/bikes?category=oto',
        image: pickImage('oto') || pickImage('car')
      }
    ];
  }, [cars, t]);

  const onSearchSubmit = (e) => {
    e.preventDefault();
    const q = String(query || '').trim();
    if (!q) return;
    nav(`/bikes?q=${encodeURIComponent(q)}`);
    setSearchOpen(false);
  };

  const vehicleChoices = useMemo(() => cars.slice(0, 8), [cars]);
  const [builderStep, setBuilderStep] = useState(1);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('');
  const builderProgress = builderStep <= 1 ? 33 : builderStep === 2 ? 66 : 100;

  const selectedVehicle = useMemo(
    () => cars.find((c) => String(c?._id || '') === String(selectedVehicleId || '')) || null,
    [cars, selectedVehicleId]
  );

  const styleChoices = useMemo(
    () => [
      { key: 'racing', title: t('landing_style_racing_title'), desc: t('landing_style_racing_desc'), accent: 'emerald' },
      { key: 'kieng', title: t('landing_style_kieng_title'), desc: t('landing_style_kieng_desc'), accent: 'cyan' },
      { key: 'touring', title: t('landing_style_touring_title'), desc: t('landing_style_touring_desc'), accent: 'violet' }
    ],
    [t]
  );

  const openGarage = (vehicleId, styleKey) => {
    const id = String(vehicleId || '');
    if (!id) return;
    const qs = styleKey ? `?style=${encodeURIComponent(String(styleKey))}` : '';
    if (isAuthed) {
      nav(`/configurator/${encodeURIComponent(id)}${qs}`);
      return;
    }
    nav(`/bikes?auth=required&go=${encodeURIComponent(id)}`);
  };

  const popularBuilds = useMemo(() => {
    const picks = cars.slice(0, 3);
    const styles = ['racing', 'kieng', 'touring'];
    return picks.map((c, idx) => ({
      id: String(c?._id || ''),
      name: String(c?.name || 'Untitled'),
      brand: String(c?.brand || ''),
      image: resolveAssetUrl(String(c?.image || '')),
      style: styles[idx % styles.length],
      parts: 6 + idx * 2,
      likes: 1200 + idx * 350
    }));
  }, [cars]);

  const previewStyle = styleChoices.find((s) => s.key === selectedStyle) || styleChoices[0];
  const previewImage = resolveAssetUrl(selectedVehicle?.image || (vehicleChoices[0]?.image || ''));

  return (
    <div className="-mx-4 -my-6 space-y-16 bg-black">
      <section className="relative overflow-hidden border-b border-zinc-800 bg-zinc-950 px-4 py-16 sm:py-20">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-24 h-[28rem] w-[28rem] rounded-full bg-emerald-500/15 blur-[110px]" />
          <div className="absolute -right-28 -bottom-24 h-[30rem] w-[30rem] rounded-full bg-cyan-500/12 blur-[120px]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,.04)_1px,transparent_1px)] bg-[size:36px_36px] opacity-25" />
        </div>

        <div className="relative mx-auto grid w-full max-w-7xl items-center gap-10 lg:grid-cols-[1.15fr_.85fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.65)]" />
              {t('landing_badge')}
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-tight text-zinc-50 sm:text-5xl lg:text-6xl">
              {t('landing_title')}
              <span className="block bg-gradient-to-r from-emerald-300 via-cyan-300 to-violet-300 bg-clip-text text-transparent">
                {t('landing_title_accent')}
              </span>
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-300 sm:text-lg">
              {t('landing_desc')}
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const target = document.getElementById('guided-builder');
                  target?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
                }}
                className="group inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-zinc-950 transition hover:bg-emerald-500 hover:shadow-[0_0_24px_rgba(16,185,129,0.35)]"
              >
                {t('landing_cta_primary')}
                <span className="transition-transform group-hover:translate-x-0.5">→</span>
              </button>
              <button
                type="button"
                onClick={() => openGarage(vehicleChoices[0]?._id, 'racing')}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-zinc-100 backdrop-blur transition hover:bg-white/10"
              >
                {t('landing_cta_quick')}
              </button>
              <Link
                to="/builds"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-zinc-100 backdrop-blur transition hover:bg-white/10"
              >
                {t('landing_cta_gallery')}
              </Link>
            </div>

            <form onSubmit={onSearchSubmit} className="mt-8">
              <div ref={searchWrapRef} className="relative max-w-2xl">
                <div className="relative">
                  <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-emerald-500/25 to-cyan-500/25 opacity-70 blur" />
                  <div className="relative flex items-center gap-2 rounded-2xl border border-white/10 bg-zinc-950/70 px-4 py-3 backdrop-blur">
                    <svg className="h-5 w-5 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setSearchOpen(true);
                      }}
                      onFocus={() => setSearchOpen(true)}
                      placeholder={t('landing_search_placeholder')}
                      className="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-500 outline-none sm:text-base"
                    />
                    <button type="submit" className="hidden rounded-xl bg-white px-4 py-2 text-sm font-bold text-zinc-950 transition hover:bg-zinc-200 sm:inline-flex">
                      {t('landing_search_cta')}
                    </button>
                  </div>
                </div>

                {searchOpen && query.trim() ? (
                  <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-30 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/85 shadow-2xl backdrop-blur">
                    {suggestions.length ? (
                      <div className="divide-y divide-white/5">
                        {suggestions.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              openGarage(s.id, '');
                              setSearchOpen(false);
                            }}
                            className="group flex w-full items-center gap-4 px-4 py-3 text-left transition hover:bg-white/5"
                          >
                            <div className="h-11 w-16 shrink-0 overflow-hidden rounded-lg bg-white/5">
                              {s.image ? <img src={s.image} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /> : null}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold text-zinc-100">{s.name}</div>
                              <div className="truncate text-xs text-zinc-400">
                                {[s.brand, categoryLabel(s.category) || s.category].filter(Boolean).join(' • ') || t('carcard_default')}
                              </div>
                            </div>
                            <div className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                              {t('landing_go')}
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="px-5 py-6 text-sm text-zinc-400">{t('hero_search_no_results')}</div>
                    )}
                    <div className="flex items-center justify-between border-t border-white/5 bg-white/3 px-4 py-2 text-xs text-zinc-400">
                      <span>{t('hero_search_hint_enter')}</span>
                      <Link to="/bikes" className="font-semibold text-emerald-300 hover:text-emerald-200">
                        {t('hero_browse_all')} →
                      </Link>
                    </div>
                  </div>
                ) : null}
              </div>
            </form>
          </div>

          <div className="relative">
            <div className="absolute -inset-2 rounded-3xl bg-gradient-to-b from-emerald-500/15 via-cyan-500/10 to-transparent blur-xl" />
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/55 backdrop-blur">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <div className="text-sm font-bold text-zinc-100">{t('landing_preview_title')}</div>
                <div className="text-xs font-semibold text-zinc-400">{t('landing_preview_hint')}</div>
              </div>
              <div className="relative aspect-[16/11] bg-black">
                {previewImage ? <img src={previewImage} alt="" className="h-full w-full object-cover opacity-85" /> : null}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-transparent" />
                <div className="absolute left-4 top-4 rounded-full border border-white/10 bg-black/50 px-3 py-1 text-xs font-bold text-white backdrop-blur">
                  {selectedVehicle?.brand ? `${selectedVehicle.brand} • ` : ''}
                  {selectedVehicle?.name || t('landing_preview_pick')}
                </div>
                <div className="absolute bottom-4 left-4 right-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-black/45 p-4 backdrop-blur">
                    <div className="text-xs font-semibold text-zinc-300">{t('landing_preview_mode')}</div>
                    <div className="mt-1 text-sm font-black text-white">{previewStyle?.title || '-'}</div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.6)]" />
                      <span className="text-xs text-zinc-300">{t('landing_preview_realtime')}</span>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/45 p-4 backdrop-blur">
                    <div className="text-xs font-semibold text-zinc-300">{t('landing_preview_goal')}</div>
                    <div className="mt-1 text-sm font-black text-white">{t('landing_preview_goal_value')}</div>
                    <div className="mt-2 text-xs text-zinc-400">{t('landing_preview_goal_hint')}</div>
                  </div>
                </div>
              </div>
              <div className="grid gap-2 border-t border-white/10 p-4 sm:grid-cols-3">
                {[
                  { k: 'landing_feature_1', v: t('landing_feature_1') },
                  { k: 'landing_feature_2', v: t('landing_feature_2') },
                  { k: 'landing_feature_3', v: t('landing_feature_3') }
                ].map((x) => (
                  <div key={x.k} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200">
                    {x.v}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="guided-builder" className="mx-auto w-full max-w-7xl px-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-bold tracking-wider text-emerald-300/90">{t('landing_guided_badge')}</div>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-zinc-100 sm:text-3xl">{t('landing_guided_title')}</h2>
            <div className="mt-2 text-sm text-zinc-400 sm:text-base">{t('landing_guided_desc')}</div>
          </div>
          <Link to="/bikes" className="inline-flex items-center gap-2 text-sm font-bold text-emerald-300 hover:text-emerald-200">
            {t('landing_guided_browse_all')} →
          </Link>
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-zinc-950/60 p-5 backdrop-blur sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-300">
              <span className={`grid h-7 w-7 place-items-center rounded-full border ${builderStep >= 1 ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200' : 'border-white/10 bg-white/5 text-zinc-400'}`}>1</span>
              <span className="hidden sm:inline">{t('landing_step_vehicle')}</span>
              <span className="text-zinc-600">→</span>
              <span className={`grid h-7 w-7 place-items-center rounded-full border ${builderStep >= 2 ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-200' : 'border-white/10 bg-white/5 text-zinc-400'}`}>2</span>
              <span className="hidden sm:inline">{t('landing_step_style')}</span>
              <span className="text-zinc-600">→</span>
              <span className={`grid h-7 w-7 place-items-center rounded-full border ${builderStep >= 3 ? 'border-violet-400/50 bg-violet-500/15 text-violet-200' : 'border-white/10 bg-white/5 text-zinc-400'}`}>3</span>
              <span className="hidden sm:inline">{t('landing_step_garage')}</span>
            </div>
            <div className="hidden text-xs font-semibold text-zinc-400 sm:block">{t('landing_progress_hint')}</div>
          </div>

          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/7">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-300 to-violet-400 transition-[width] duration-500"
                style={{ width: `${builderProgress}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-zinc-500">
              <span>Bước {builderStep}/3</span>
              <span>{builderProgress}%</span>
            </div>
          </div>

          <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_420px]">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBuilderStep(1)}
                  className={`rounded-full px-4 py-2 text-xs font-bold transition ${builderStep === 1 ? 'bg-white text-zinc-950' : 'border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10'}`}
                >
                  1 · {t('landing_step_vehicle')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedVehicleId) return;
                    setBuilderStep(2);
                  }}
                  className={`rounded-full px-4 py-2 text-xs font-bold transition ${builderStep === 2 ? 'bg-white text-zinc-950' : 'border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10'}`}
                >
                  2 · {t('landing_step_style')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedVehicleId || !selectedStyle) return;
                    setBuilderStep(3);
                  }}
                  className={`rounded-full px-4 py-2 text-xs font-bold transition ${builderStep === 3 ? 'bg-white text-zinc-950' : 'border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10'}`}
                >
                  3 · {t('landing_step_garage')}
                </button>
              </div>

              {builderStep === 1 ? (
                <div className="space-y-3">
                  <div className="text-sm font-bold text-zinc-100">{t('landing_pick_vehicle')}</div>
                  {loading ? <div className="text-sm text-zinc-400">{t('common_loading')}</div> : null}
                  {error ? <div className="text-sm text-red-400">{t('common_error')}: {error}</div> : null}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {vehicleChoices.map((c) => {
                      const id = String(c?._id || '');
                      const active = id && id === selectedVehicleId;
                      return (
                        <button
                          key={id || c?.name}
                          type="button"
                          onClick={() => {
                            setSelectedVehicleId(id);
                            setBuilderStep(2);
                          }}
                          className={`group relative overflow-hidden rounded-2xl border text-left transition ${active ? 'border-emerald-400/50 bg-emerald-500/10' : 'border-white/10 bg-white/5 hover:bg-white/8 hover:border-white/20'}`}
                        >
                          <div className="absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100">
                            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-500/15 blur-2xl" />
                          </div>
                          <div className="relative flex items-center gap-4 p-4">
                            <div className="h-14 w-20 shrink-0 overflow-hidden rounded-xl bg-black/40">
                              {c?.image ? <img src={String(c.image)} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /> : null}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-black text-zinc-100">{String(c?.name || 'Untitled')}</div>
                              <div className="mt-1 truncate text-xs text-zinc-400">
                                {[String(c?.brand || ''), categoryLabel(c?.category)].filter(Boolean).join(' • ')}
                              </div>
                            </div>
                            <div className={`rounded-full px-3 py-1 text-xs font-bold ${active ? 'bg-emerald-500/15 text-emerald-200' : 'bg-white/5 text-zinc-200'}`}>
                              {t('landing_select')}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {builderStep === 2 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-bold text-zinc-100">{t('landing_pick_style')}</div>
                    <button
                      type="button"
                      onClick={() => setBuilderStep(1)}
                      className="text-xs font-semibold text-zinc-400 hover:text-zinc-200"
                    >
                      {t('landing_change_vehicle')}
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {styleChoices.map((s) => {
                      const active = selectedStyle === s.key;
                      const accent =
                        s.accent === 'emerald'
                          ? 'hover:border-emerald-400/50 hover:bg-emerald-500/8'
                          : s.accent === 'cyan'
                            ? 'hover:border-cyan-400/50 hover:bg-cyan-500/8'
                            : 'hover:border-violet-400/50 hover:bg-violet-500/8';
                      const activeCls =
                        s.accent === 'emerald'
                          ? 'border-emerald-400/50 bg-emerald-500/10'
                          : s.accent === 'cyan'
                            ? 'border-cyan-400/50 bg-cyan-500/10'
                            : 'border-violet-400/50 bg-violet-500/10';
                      return (
                        <button
                          key={s.key}
                          type="button"
                          onClick={() => {
                            setSelectedStyle(s.key);
                            setBuilderStep(3);
                          }}
                          className={`group relative overflow-hidden rounded-2xl border p-4 text-left transition ${active ? activeCls : `border-white/10 bg-white/5 ${accent}`}`}
                        >
                          <div className="absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100">
                            <div className={`absolute -right-8 -top-8 h-32 w-32 rounded-full ${s.accent === 'emerald' ? 'bg-emerald-500/18' : s.accent === 'cyan' ? 'bg-cyan-500/18' : 'bg-violet-500/18'} blur-2xl`} />
                          </div>
                          <div className="relative">
                            <div className="text-sm font-black text-zinc-100">{s.title}</div>
                            <div className="mt-1 text-xs text-zinc-400">{s.desc}</div>
                            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-bold text-zinc-200">
                              {t('landing_try_this')}
                              <span className="transition-transform group-hover:translate-x-0.5">→</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {builderStep === 3 ? (
                <div className="space-y-3">
                  <div className="text-sm font-bold text-zinc-100">{t('landing_ready_title')}</div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs font-semibold text-zinc-400">{t('landing_ready_summary')}</div>
                    <div className="mt-1 text-sm font-black text-zinc-100">
                      {(selectedVehicle?.name || t('landing_preview_pick')) + (selectedStyle ? ` • ${previewStyle?.title}` : '')}
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={!selectedVehicleId}
                        onClick={() => openGarage(selectedVehicleId, selectedStyle)}
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-zinc-950 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {t('landing_enter_garage')}
                        <span className="transition-transform group-hover:translate-x-0.5">→</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setBuilderStep(2)}
                        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-zinc-100 transition hover:bg-white/10"
                      >
                        {t('landing_change_style')}
                      </button>
                    </div>
                    {!isAuthed ? <div className="mt-3 text-xs text-zinc-400">{t('cfg_login_required')}</div> : null}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="hidden lg:block">
              <div className="sticky top-6 space-y-3">
                <div className="rounded-3xl border border-white/10 bg-black/40 p-5 backdrop-blur">
                  <div className="text-xs font-bold text-zinc-300">{t('landing_live_title')}</div>
                  <div className="mt-2 text-sm font-black text-zinc-100">{t('landing_live_subtitle')}</div>
                  <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black">
                    <div className="relative aspect-[16/11]">
                      {previewImage ? <img src={previewImage} alt="" className="h-full w-full object-cover opacity-85" /> : null}
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                      <div className="absolute left-4 top-4 rounded-full border border-white/10 bg-black/55 px-3 py-1 text-xs font-bold text-white backdrop-blur">
                        {previewStyle?.title || '-'}
                      </div>
                      <div className="absolute bottom-4 left-4 right-4 grid grid-cols-2 gap-2">
                        {[t('landing_live_chip_1'), t('landing_live_chip_2'), t('landing_live_chip_3'), t('landing_live_chip_4')].map((x) => (
                          <div key={x} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs font-semibold text-zinc-200 backdrop-blur">
                            {x}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 text-xs text-zinc-400">{t('landing_live_hint')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-zinc-100 sm:text-3xl">{t('landing_popular_title')}</h2>
            <div className="mt-2 text-sm text-zinc-400 sm:text-base">{t('landing_popular_desc')}</div>
          </div>
          <Link to="/builds" className="hidden items-center gap-2 text-sm font-bold text-emerald-300 hover:text-emerald-200 sm:inline-flex">
            {t('landing_popular_view')} →
          </Link>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {popularBuilds.map((b) => {
            const style = styleChoices.find((s) => s.key === b.style) || styleChoices[0];
            return (
              <button
                key={b.id || b.name}
                type="button"
                onClick={() => openGarage(b.id, b.style)}
                className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 text-left transition hover:-translate-y-1 hover:border-white/20 hover:bg-white/8"
              >
                <div className="absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100">
                  <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-emerald-500/12 blur-3xl" />
                </div>
                <div className="relative aspect-[16/11] bg-black">
                  {b.image ? <img src={b.image} alt="" className="h-full w-full object-cover opacity-90 transition duration-500 group-hover:scale-[1.04]" /> : null}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent" />
                  <div className="absolute left-4 top-4 rounded-full border border-white/10 bg-black/55 px-3 py-1 text-xs font-bold text-white backdrop-blur">
                    {style?.title}
                  </div>
                </div>
                <div className="relative space-y-3 p-5">
                  <div className="min-w-0">
                    <div className="truncate text-base font-black text-zinc-100">{b.name}</div>
                    <div className="truncate text-xs text-zinc-400">{[b.brand, `${b.parts} ${t('landing_parts_unit')}`].filter(Boolean).join(' • ')}</div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold text-zinc-300">{t('landing_popular_like').replace('{count}', String(b.likes))}</div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/12 px-3 py-1 text-xs font-black text-emerald-200">
                      {t('landing_remix')}
                      <span className="transition-transform group-hover:translate-x-0.5">→</span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 pb-16">
        <div className="grid gap-4 lg:grid-cols-3">
          {categories.map((c) => (
            <Link
              key={c.key}
              to={c.href}
              className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 transition hover:-translate-y-1 hover:border-white/20 hover:bg-white/8"
            >
              <div className="relative aspect-[16/11] bg-black">
                {c.image ? <img src={c.image} alt="" className="h-full w-full object-cover opacity-85 transition duration-500 group-hover:scale-[1.04]" /> : null}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                <div className="absolute left-5 top-5 rounded-full border border-white/10 bg-black/55 px-3 py-1 text-xs font-bold text-white backdrop-blur">
                  {c.label}
                </div>
                <div className="absolute bottom-5 left-5 right-5">
                  <div className="text-lg font-black text-white">{c.title}</div>
                  <div className="mt-1 text-sm text-zinc-300">{c.desc}</div>
                  <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-black text-white backdrop-blur">
                    {t('landing_browse_category')}
                    <span className="transition-transform group-hover:translate-x-0.5">→</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Home;
