import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getBrands, getCars } from '../services/api/cars.js';
import { useI18n } from '../services/i18n.jsx';
import { useAuth } from '../services/auth/AuthContext.jsx';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
const resolveAssetUrl = (url) => {
  const u = String(url || '').trim();
  if (!u) return '';
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

const parseBrands = (raw) => {
  const v = String(raw || '').trim();
  if (!v) return [];
  return v
    .split(',')
    .map((x) => String(x || '').trim())
    .filter(Boolean);
};

const formatCc = (cc) => {
  const n = Number(cc);
  if (!Number.isFinite(n) || n <= 0) return '';
  return `${Math.round(n)}cc`;
};

const ccMatch = (ccValue, ccKey) => {
  if (!ccKey) return true;
  const cc = Number(ccValue);
  if (!Number.isFinite(cc)) return false;
  if (ccKey === '125') return cc <= 125;
  if (ccKey === '150') return cc > 125 && cc <= 150;
  if (ccKey === '300') return cc > 150 && cc <= 300;
  if (ccKey === '600') return cc > 300 && cc <= 600;
  if (ccKey === '1000') return cc >= 1000;
  return true;
};

const normalizeBikeTypeKey = (raw) => {
  const k = String(raw || '').trim().toLowerCase();
  if (!k) return '';
  if (k === 'pkl' || k === 'bigbike') return 'touring';
  if (k === 'underbone') return 'sport';
  if (k === 'car') return 'oto';
  return k;
};

const BikeCard = ({ bike, typeLabel, t, onCustomize }) => {
  const id = String(bike?._id || '');
  const name = bike?.name || 'Untitled';
  const brand = bike?.brand || '';
  const cc = formatCc(bike?.engineCc);
  const type = typeLabel(String(bike?.category || '')) || '';
  const image = bike?.image || '';

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950/30 backdrop-blur-xl transition-all duration-300 ease-out hover:-translate-y-1 hover:border-emerald-500/40 hover:bg-zinc-950/45 hover:shadow-[0_0_0_1px_rgba(16,185,129,0.25),0_24px_80px_-36px_rgba(16,185,129,0.45)]">
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-zinc-900">
        {image ? (
          <img
            src={image}
            alt=""
            className="h-full w-full origin-center object-cover transition duration-500 group-hover:scale-[1.06]"
          />
        ) : null}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-zinc-950/85 via-zinc-950/10 to-transparent opacity-80" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-emerald-500/10 to-transparent opacity-0 transition duration-300 group-hover:opacity-100" />
      </div>

      <div className="space-y-3 p-4">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold text-zinc-100">{name}</div>
          <div className="truncate text-sm text-zinc-400">
            {[brand, cc, type].filter(Boolean).join(' • ') || t('carcard_default')}
          </div>
        </div>

        <div className="flex items-center gap-2 transition sm:pointer-events-none sm:opacity-0 sm:group-hover:pointer-events-auto sm:group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onCustomize(id)}
            className="inline-flex flex-1 items-center justify-center rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium transition hover:bg-emerald-500"
          >
            {t('carcard_customize')}
          </button>
          <Link
            to={`/bikes/${encodeURIComponent(id)}`}
            className="inline-flex items-center justify-center rounded-lg border border-zinc-800/80 bg-zinc-950/60 px-3 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-900/60"
          >
            {t('bike_view_details')}
          </Link>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 opacity-0 transition duration-300 group-hover:opacity-100">
        <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/10 to-transparent" />
      </div>
    </div>
  );
};

const Bikes = () => {
  const { t } = useI18n();
  const location = useLocation();
  const nav = useNavigate();
  const { isAuthed } = useAuth();

  const [cars, setCars] = useState([]);
  const [brandItems, setBrandItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [authPromptOpen, setAuthPromptOpen] = useState(false);
  const [pendingId, setPendingId] = useState('');

  const params = useMemo(() => new URLSearchParams(location.search || ''), [location.search]);
  const q = String(params.get('q') || '').trim();
  const type = normalizeBikeTypeKey(params.get('category'));
  const cc = String(params.get('cc') || '').trim();
  const sort = String(params.get('sort') || 'trending').trim();
  const brands = useMemo(() => parseBrands(params.get('brand')), [params]);
  const authRequired = String(params.get('auth') || '').trim() === 'required';
  const goId = String(params.get('go') || '').trim();

  const [qInput, setQInput] = useState(q);

  useEffect(() => {
    setQInput(q);
  }, [q]);

  useEffect(() => {
    if (authRequired) {
      setPendingId(goId || '');
      setAuthPromptOpen(true);
    }
  }, [authRequired, goId]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    getCars({ metrics: true })
      .then((items) => {
        if (!alive) return;
        setCars(items);
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
    const loadBrands = async () => {
      try {
        if (!type) {
          const [pklBrands, scooterBrands] = await Promise.all([
            getBrands({ type: 'pkl' }),
            getBrands({ type: 'scooter' })
          ]);
          if (!alive) return;
          const byName = new Map();
          for (const b of [...pklBrands, ...scooterBrands]) {
            const name = String(b?.name || '').trim();
            const key = normalizeText(name);
            if (!key) continue;
            if (!byName.has(key)) byName.set(key, b);
          }
          setBrandItems(Array.from(byName.values()));
          return;
        }
        const items = await getBrands({ type });
        if (!alive) return;
        const byName = new Map();
        for (const b of Array.isArray(items) ? items : []) {
          const name = String(b?.name || '').trim();
          const key = normalizeText(name);
          if (!key) continue;
          if (!byName.has(key)) byName.set(key, b);
        }
        setBrandItems(Array.from(byName.values()));
      } catch (e) {
        if (!alive) return;
        setError(e?.message || 'FAILED_TO_LOAD');
      }
    };
    loadBrands();
    return () => {
      alive = false;
    };
  }, [type]);

  const typeLabel = (key) => {
    const k = normalizeBikeTypeKey(key);
    if (k === 'scooter') return t('category_scooter');
    if (k === 'sport') return t('category_sport');
    if (k === 'naked') return t('category_naked');
    if (k === 'touring') return t('category_touring');
    return '';
  };

  const bikeCars = useMemo(() => {
    const allowed = new Set(['scooter', 'sport', 'naked', 'touring']);
    return cars.filter((c) => allowed.has(normalizeBikeTypeKey(c?.category)));
  }, [cars]);

  const brandOptions = useMemo(() => {
    const set = new Set();
    for (const b of brandItems) {
      const name = String(b?.name || '').trim();
      if (name) set.add(name);
    }
    if (set.size) return Array.from(set);
    for (const c of bikeCars) {
      const x = String(c?.brand || '').trim();
      if (x) set.add(x);
    }
    return Array.from(set);
  }, [bikeCars, brandItems]);

  const ccOptions = useMemo(
    () => [
      { key: '', label: t('common_all') },
      { key: '125', label: t('engine_125') },
      { key: '150', label: t('engine_150') },
      { key: '300', label: t('engine_300') },
      { key: '600', label: t('engine_600') },
      { key: '1000', label: t('engine_1000') }
    ],
    [t]
  );

  const typeOptions = useMemo(
    () => [
      { key: '', label: t('common_all') },
      { key: 'scooter', label: t('category_scooter') },
      { key: 'naked', label: t('category_naked') },
      { key: 'sport', label: t('category_sport') },
      { key: 'touring', label: t('category_touring') }
    ],
    [t]
  );

  const updateUrl = ({ nextQ, nextCategory, nextCc, nextSort, nextBrands }) => {
    const next = new URLSearchParams();
    const qVal = String(nextQ ?? q).trim();
    const typeVal = String(nextCategory ?? type).trim();
    const ccVal = String(nextCc ?? cc).trim();
    const sortVal = String(nextSort ?? sort).trim();
    const brandsVal = Array.isArray(nextBrands) ? nextBrands : brands;

    if (qVal) next.set('q', qVal);
    if (typeVal) next.set('category', typeVal);
    if (ccVal) next.set('cc', ccVal);
    if (sortVal && sortVal !== 'trending') next.set('sort', sortVal);
    if (brandsVal.length) next.set('brand', brandsVal.join(','));

    const qs = next.toString();
    nav(qs ? `/bikes?${qs}` : '/bikes', { replace: true });
  };

  const selectedBrand = String(brands[0] || '').trim();
  const selectedBrandSet = useMemo(() => new Set([selectedBrand].filter(Boolean)), [selectedBrand]);

  const filtered = useMemo(() => {
    const qKey = normalizeText(q);
    return bikeCars.filter((c) => {
      if (type && normalizeBikeTypeKey(c?.category) !== type) return false;
      if (selectedBrand && !selectedBrandSet.has(String(c?.brand || ''))) return false;
      if (!ccMatch(c?.engineCc, cc)) return false;
      if (!qKey) return true;
      const key = normalizeText(`${c?.name || ''} ${c?.brand || ''} ${c?.category || ''} ${c?.engineCc || ''}`);
      return key.includes(qKey);
    });
  }, [bikeCars, type, selectedBrand, selectedBrandSet, cc, q]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    const getTime = (x) => {
      const ms = Date.parse(String(x?.createdAt || ''));
      return Number.isFinite(ms) ? ms : 0;
    };
    const getMods = (x) => Number(x?.modCount || 0);

    if (sort === 'newest') {
      list.sort((a, b) => getTime(b) - getTime(a));
      return list;
    }
    if (sort === 'most') {
      list.sort((a, b) => (getMods(b) - getMods(a) ? getMods(b) - getMods(a) : getTime(b) - getTime(a)));
      return list;
    }
    list.sort((a, b) => {
      const scoreA = getMods(a) * 3 + Math.min(getTime(a) / 1e11, 1000);
      const scoreB = getMods(b) * 3 + Math.min(getTime(b) / 1e11, 1000);
      return scoreB - scoreA;
    });
    return list;
  }, [filtered, sort]);

  const hasActiveFilters = Boolean(q || type || cc || (sort && sort !== 'trending'));

  const clearFilters = () => {
    setQInput('');
    updateUrl({ nextQ: '', nextCategory: '', nextCc: '', nextSort: 'trending' });
  };

  const handleCustomize = (id) => {
    if (isAuthed) {
      nav(`/configurator/${encodeURIComponent(id)}`);
      return;
    }
    setPendingId(String(id || ''));
    setAuthPromptOpen(true);
  };

  const BrandsStep = () => {
    const primary = new Map([
      ['yamaha', 0],
      ['honda', 1],
      ['suzuki', 2],
      ['kawasaki', 3]
    ]);
    const byName = new Map(brandItems.map((b) => [normalizeText(String(b?.name || '')), b]));
    const all = Array.from(byName.values());
    const cards = all.sort((a, b) => {
      const ak = normalizeText(a?.name);
      const bk = normalizeText(b?.name);
      const ai = primary.has(ak) ? primary.get(ak) : 999;
      const bi = primary.has(bk) ? primary.get(bk) : 999;
      if (ai !== bi) return ai - bi;
      return ak.localeCompare(bk);
    });

    return (
      <div className="relative overflow-hidden rounded-3xl border border-zinc-800/70 bg-zinc-950/35 p-8 backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 -top-24 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="absolute -right-24 -bottom-24 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-5xl text-center">
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-100 sm:text-4xl">{t('bikes_page_title')}</h1>
          <div className="mt-2 text-base text-zinc-400">{t('bikes_page_subtitle')}</div>
        </div>

        <div className="relative mx-auto mt-10 grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((item) => {
            const name = String(item?.name || '');
            const logo = String(item?.logo || '');
            const initial = String(name || '').trim().slice(0, 1).toUpperCase();
            return (
              <button
                key={name}
                type="button"
                onClick={() => updateUrl({ nextBrands: [name], nextQ: '', nextCategory: '', nextCc: '', nextSort: 'trending' })}
                className="group relative flex w-full items-center gap-4 rounded-2xl border border-zinc-800/80 bg-zinc-950/35 p-5 text-left backdrop-blur-xl transition-all duration-300 ease-out hover:-translate-y-1 hover:border-emerald-500/45 hover:bg-zinc-950/45 hover:shadow-[0_0_0_1px_rgba(16,185,129,0.25),0_28px_90px_-40px_rgba(16,185,129,0.55)]"
              >
                {logo ? (
                  <img
                    src={resolveAssetUrl(logo)}
                    alt={name}
                    className="h-16 w-16 rounded-2xl border border-emerald-500/25 bg-zinc-900 object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-500/10 text-lg font-semibold text-emerald-200 transition group-hover:bg-emerald-500/15">
                    {initial}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold text-zinc-100">{name}</div>
                </div>
                <div className="pointer-events-none absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100">
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const FiltersPanel = () => {
    return (
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/30 p-5 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-zinc-100">{t('bikes_filters')}</div>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-900/60 hover:text-white"
            >
              {t('bikes_clear_filters')}
            </button>
          ) : null}
        </div>

        <form
          className="mt-4 flex items-center gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            updateUrl({ nextQ: qInput });
          }}
        >
          <input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder={t('bikes_search_placeholder')}
            className="w-full rounded-xl border border-zinc-800/80 bg-zinc-950/60 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-emerald-500/70"
          />
          <button className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-zinc-950 transition hover:bg-emerald-500">
            {t('common_search')}
          </button>
        </form>

        <div className="mt-5 space-y-2">
          <div className="text-xs font-medium text-zinc-300">{t('filter_engine')}</div>
          <div className="flex flex-wrap gap-2">
            {ccOptions.map((o) => {
              const active = String(o.key) === String(cc);
              return (
                <button
                  key={o.key || '__all'}
                  type="button"
                  onClick={() => updateUrl({ nextCc: o.key })}
                  className={`rounded-full border px-3 py-2 text-xs font-medium transition ${
                    active
                      ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-200 shadow-[0_0_0_1px_rgba(16,185,129,0.12)]'
                      : 'border-zinc-800/80 bg-zinc-950/50 text-zinc-300 hover:bg-zinc-900/60'
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5 space-y-2">
          <div className="text-xs font-medium text-zinc-300">{t('filter_type')}</div>
          <div className="flex flex-wrap gap-2">
            {typeOptions.map((o) => {
              const active = String(o.key) === String(type);
              return (
                <button
                  key={o.key || '__all'}
                  type="button"
                  onClick={() => updateUrl({ nextCategory: o.key })}
                  className={`rounded-full border px-3 py-2 text-xs font-medium transition ${
                    active
                      ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-200 shadow-[0_0_0_1px_rgba(16,185,129,0.12)]'
                      : 'border-zinc-800/80 bg-zinc-950/50 text-zinc-300 hover:bg-zinc-900/60'
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-center gap-2">
            <div className="text-xs text-zinc-400">{t('bikes_sort')}</div>
            <select
              value={sort}
              onChange={(e) => updateUrl({ nextSort: e.target.value })}
              className="w-full rounded-xl border border-zinc-800/80 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-emerald-500/70"
            >
              <option value="trending">{t('bikes_sort_trending')}</option>
              <option value="newest">{t('bikes_sort_newest')}</option>
              <option value="most">{t('bikes_sort_most_modded')}</option>
            </select>
          </div>
        </div>
      </div>
    );
  };

  const AuthPromptModal = authPromptOpen ? (
    <div className="fixed inset-0 z-[100] grid place-items-center p-4">
      <button type="button" onClick={() => setAuthPromptOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-label="Close" />
      <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
        <div className="border-b border-zinc-800 px-5 py-4 text-lg font-semibold text-zinc-100">
          {t('cfg_title')}
        </div>
        <div className="p-5">
          <div className="text-sm text-zinc-300">{t('cfg_login_required')}</div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Link
              to={`/login`}
              className="grid place-items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-500"
              onClick={() => setAuthPromptOpen(false)}
            >
              {t('nav_login')}
            </Link>
            <Link
              to={`/register`}
              className="grid place-items-center rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-900"
              onClick={() => setAuthPromptOpen(false)}
            >
              {t('nav_register')}
            </Link>
          </div>
          {pendingId ? (
            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setAuthPromptOpen(false);
                  nav(`/configurator/${encodeURIComponent(pendingId)}`);
                }}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
              >
                {t('cfg_view_only')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthPromptOpen(false);
                  nav(`/bikes/${encodeURIComponent(pendingId)}`);
                }}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              >
                {t('bike_view_details')}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  ) : null;

  if (!selectedBrand) {
    return (
      <>
        {AuthPromptModal}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Link to="/" className="text-sm text-emerald-400 hover:text-emerald-300">
              {t('common_back_home')}
            </Link>
          </div>
          <BrandsStep />
        </div>
      </>
    );
  }

  return (
    <>
      {AuthPromptModal}
      <div className="space-y-6">
        <div className="rounded-3xl border border-zinc-800/70 bg-zinc-950/35 p-6 backdrop-blur-xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-400">
            <Link to="/" className="text-emerald-400 hover:text-emerald-300">
              {t('common_back_home')}
            </Link>
            <span className="text-zinc-600">/</span>
            <button type="button" onClick={() => updateUrl({ nextBrands: [], nextQ: '', nextCategory: '', nextCc: '', nextSort: 'trending' })} className="text-zinc-300 hover:text-white">
              {t('filter_brand')}
            </button>
            <span className="text-zinc-600">/</span>
            <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
              {selectedBrand}
            </span>
          </div>
        </div>

        <div className="mt-4">
          <h1 className="text-2xl font-semibold text-zinc-100">{t('bikes_page_title')}</h1>
          <div className="mt-1 text-sm text-zinc-400">{t('bikes_page_subtitle')}</div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="lg:sticky lg:top-6 lg:self-start">
          <FiltersPanel />
        </div>

        <div className="space-y-4">
          {loading ? <div className="text-zinc-400">{t('common_loading')}</div> : null}
          {error ? (
            <div className="text-red-400">
              {t('common_error')}: {error}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {sorted.map((bike) => (
              <BikeCard key={bike._id} bike={bike} typeLabel={typeLabel} t={t} onCustomize={handleCustomize} />
            ))}
          </div>

          {!loading && !error && sorted.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/30 p-6 backdrop-blur-xl">
              <div className="text-zinc-300">{t('bikes_empty')}</div>
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-zinc-950 transition hover:bg-emerald-500"
              >
                {t('bikes_clear_filters')}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
    </>
  );
};

export default Bikes;
