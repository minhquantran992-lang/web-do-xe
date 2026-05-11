import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBrands, getCars } from '../services/api/cars.js';
import { getApiBaseUrl } from '../services/api/client.js';
import { useI18n } from '../services/i18n.jsx';

const resolveAssetUrl = (url) => {
  const base = getApiBaseUrl();
  const u = String(url || '').trim();
  if (!u) return '';
  if (u.startsWith('data:') || u.startsWith('blob:')) return u;
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  if (u.startsWith('/')) return `${base}${u}`;
  return `${base}/${u}`;
};

const SkeletonTile = () => (
  <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
    <div className="h-10 w-10 animate-pulse rounded-xl bg-zinc-800" />
    <div className="mt-3 h-4 w-2/3 animate-pulse rounded bg-zinc-800" />
    <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-zinc-900" />
  </div>
);

const StepPill = ({ active, title, desc }) => {
  return (
    <div
      className={
        active
          ? 'rounded-2xl border border-sky-500/25 bg-sky-500/10 px-4 py-3 shadow-[0_0_18px_rgba(14,165,233,0.18)]'
          : 'rounded-2xl border border-white/10 bg-white/5 px-4 py-3'
      }
    >
      <div className={active ? 'text-sm font-semibold text-sky-200' : 'text-sm font-semibold text-zinc-200'}>{title}</div>
      <div className="mt-1 text-xs text-zinc-400">{desc}</div>
    </div>
  );
};

const Custom = () => {
  const nav = useNavigate();
  const { t } = useI18n();
  const [vehicleType, setVehicleType] = useState('all');
  const [brands, setBrands] = useState([]);
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [step, setStep] = useState(1);
  const [brandKey, setBrandKey] = useState('');
  const [carId, setCarId] = useState('');

  const normalizeVehicleTypeFromCategory = (category) => {
    const k = String(category || '').trim().toLowerCase();
    if (!k) return 'pkl';
    if (k === 'oto' || k === 'car') return 'oto';
    if (k === 'scooter' || k === 'underbone') return 'scooter';
    return 'pkl';
  };

  const toBrandKey = (name) =>
    String(name || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([getBrands(), getCars()])
      .then(([b, c]) => {
        if (!alive) return;
        const carsList = Array.isArray(c) ? c : [];
        const brandListRaw = Array.isArray(b) ? b : [];

        let nextBrands = brandListRaw;
        if (!nextBrands.length) {
          const seen = new Set();
          nextBrands = carsList
            .map((car) => String(car?.brand || '').trim())
            .filter(Boolean)
            .filter((name) => {
              const key = toBrandKey(name);
              if (!key || seen.has(key)) return false;
              seen.add(key);
              return true;
            })
            .sort((a, b) => a.localeCompare(b))
            .map((name) => ({ key: toBrandKey(name), name, logo: '' }));
        }

        setBrands(nextBrands);
        setCars(carsList);
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

  const onPickVehicleType = (next) => {
    setVehicleType(next);
    if (brandKey) {
      setCarId('');
      setStep(2);
      return;
    }
    setStep(1);
  };

  const selectedBrand = useMemo(() => brands.find((b) => String(b?.key || '') === String(brandKey || '')) || null, [brands, brandKey]);
  const selectedCar = useMemo(() => cars.find((c) => String(c?._id || '') === String(carId || '')) || null, [cars, carId]);
  const displayCarName = useMemo(() => {
    const n = String(selectedCar?.name || '').trim();
    const key = n.toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (key === 'xsr155') return 'XSR155';
    return n;
  }, [selectedCar?.name]);

  const formatCc = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return '';
    const rounded = Math.round(n);
    return `${rounded}cc`;
  };

  const categoryLabel = (key) => {
    const k = String(key || '').trim().toLowerCase();
    if (!k) return '';
    if (k === 'scooter') return t('category_scooter');
    if (k === 'oto' || k === 'car') return t('category_oto');
    if (k === 'touring') return t('category_touring');
    if (k === 'underbone') return t('category_underbone');
    if (k === 'sport') return t('category_sport');
    if (k === 'naked') return t('category_naked');
    if (k === 'bigbike') return t('category_bigbike');
    if (k === 'pkl') return t('category_pkl');
    return k.toUpperCase();
  };

  const getDisplayCarName = (name) => {
    const n = String(name || '').trim();
    if (n.toLowerCase().replace(/[^a-z0-9]+/g, '') === 'xsr155') return 'XSR155';
    return n;
  };

  const selectedCc = formatCc(selectedCar?.engineCc);
  const selectedType = categoryLabel(selectedCar?.category);

  const carChoices = useMemo(() => {
    const name = String(selectedBrand?.name || '').trim();
    if (!name) return [];
    const rx = new RegExp(`^${name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}$`, 'i');
    const isAll = String(vehicleType || '').trim().toLowerCase() === 'all';
    return cars
      .filter((c) => rx.test(String(c?.brand || '')))
      .filter((c) => (isAll ? true : normalizeVehicleTypeFromCategory(c?.category) === String(vehicleType || 'pkl')))
      .slice(0, 24);
  }, [cars, selectedBrand, vehicleType]);

  const canGoStep2 = Boolean(selectedBrand);
  const canGoStep3 = Boolean(selectedCar);

  useEffect(() => {
    if (step === 2 && !canGoStep2) setStep(1);
    if (step === 3 && !canGoStep3) setStep(2);
  }, [canGoStep2, canGoStep3, step]);

  const onPickBrand = (b) => {
    const k = String(b?.key || '');
    if (!k) return;
    setBrandKey(k);
    setCarId('');
    setVehicleType('all');
    setStep(2);
  };

  const onPickCar = (c) => {
    const id = String(c?._id || '');
    if (!id) return;
    setCarId(id);
    setStep(3);
  };

  const openConfigurator = () => {
    if (!selectedCar?._id) return;
    nav(`/configurator/${encodeURIComponent(String(selectedCar._id))}`);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <div className="rounded-3xl border border-zinc-800/70 bg-zinc-950/50 p-6 backdrop-blur-xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-sm font-semibold text-sky-300">{t('custom_badge')}</div>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-zinc-50 sm:text-3xl">{t('custom_title')}</h1>
              <div className="mt-2 text-sm text-zinc-400">{t('custom_desc')}</div>
            </div>

            {brandKey ? (
              <div className="grid w-full grid-cols-4 gap-2 md:w-[360px] md:shrink-0">
                <button
                  type="button"
                  onClick={() => onPickVehicleType('pkl')}
                  className={
                    vehicleType === 'pkl'
                      ? 'h-10 w-full rounded-xl bg-sky-400 px-2 text-[11px] font-semibold text-zinc-950'
                      : 'h-10 w-full rounded-xl border border-white/10 bg-white/5 px-2 text-[11px] font-semibold text-zinc-200 hover:bg-white/10'
                  }
                >
                  {t('category_pkl')}
                </button>
                <button
                  type="button"
                  onClick={() => onPickVehicleType('scooter')}
                  className={
                    vehicleType === 'scooter'
                      ? 'h-10 w-full rounded-xl bg-sky-400 px-2 text-[11px] font-semibold text-zinc-950'
                      : 'h-10 w-full rounded-xl border border-white/10 bg-white/5 px-2 text-[11px] font-semibold text-zinc-200 hover:bg-white/10'
                  }
                >
                  {t('category_scooter')}
                </button>
                <button
                  type="button"
                  onClick={() => onPickVehicleType('oto')}
                  className={
                    vehicleType === 'oto'
                      ? 'h-10 w-full rounded-xl bg-sky-400 px-2 text-[11px] font-semibold text-zinc-950'
                      : 'h-10 w-full rounded-xl border border-white/10 bg-white/5 px-2 text-[11px] font-semibold text-zinc-200 hover:bg-white/10'
                  }
                >
                  {t('category_oto')}
                </button>
                <button
                  type="button"
                  onClick={() => onPickVehicleType('all')}
                  className={
                    vehicleType === 'all'
                      ? 'h-10 w-full rounded-xl bg-sky-400 px-2 text-[11px] font-semibold text-zinc-950'
                      : 'h-10 w-full rounded-xl border border-white/10 bg-white/5 px-2 text-[11px] font-semibold text-zinc-200 hover:bg-white/10'
                  }
                >
                  {t('common_all')}
                </button>
              </div>
            ) : null}
          </div>

          {error ? <div className="mt-4 rounded-2xl border border-red-900/40 bg-red-950/30 p-4 text-sm text-red-200">{error}</div> : null}

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <StepPill active={step === 1} title={t('custom_step_1')} desc={t('custom_step_1_desc')} />
            <StepPill active={step === 2} title={t('custom_step_2')} desc={t('custom_step_2_desc')} />
            <StepPill active={step === 3} title={t('custom_step_34')} desc={t('custom_step_34_desc')} />
          </div>
        </div>

        {step === 1 ? (
          <div className="space-y-4">
            <div className="text-sm font-semibold text-zinc-200">{t('custom_choose_brand')}</div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {loading ? (
                <>
                  <SkeletonTile />
                  <SkeletonTile />
                  <SkeletonTile />
                  <SkeletonTile />
                  <SkeletonTile />
                  <SkeletonTile />
                </>
              ) : (
                brands.map((b) => (
                  <button
                    key={b.key}
                    type="button"
                    onClick={() => onPickBrand(b)}
                    className="group text-left rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4 transition hover:border-sky-500/30 hover:bg-zinc-950/60"
                  >
                    <div className="flex items-center gap-3">
                      <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-xl border border-white/10 bg-white/5 text-sm font-bold text-zinc-100">
                        {b.logo ? (
                          <img alt={b.name || 'Brand'} src={resolveAssetUrl(b.logo)} className="h-full w-full object-cover" />
                        ) : (
                          <span>{String(b.name || '?').slice(0, 1).toUpperCase()}</span>
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-zinc-100">{b.name || 'Untitled'}</div>
                        <div className="mt-1 text-xs text-zinc-400">{t('custom_select_to_view_models')}</div>
                      </div>
                    </div>
                    <div className="mt-4 h-px w-full bg-white/5" />
                    <div className="mt-3 text-xs text-zinc-400 group-hover:text-zinc-300">{t('custom_continue_arrow')}</div>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-zinc-200">{t('custom_choose_model')}</div>
                <div className="mt-1 text-xs text-zinc-500">{selectedBrand?.name ? `${t('custom_summary_brand')}: ${selectedBrand.name}` : ''}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setBrandKey('');
                  setCarId('');
                }}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10"
              >
                {t('custom_change_brand')}
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {loading ? (
                <>
                  <SkeletonTile />
                  <SkeletonTile />
                  <SkeletonTile />
                  <SkeletonTile />
                  <SkeletonTile />
                  <SkeletonTile />
                </>
              ) : carChoices.length ? (
                carChoices.map((c) => (
                  <button
                    key={c._id}
                    type="button"
                    onClick={() => onPickCar(c)}
                    className="group overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/40 text-left transition hover:border-sky-500/30"
                  >
                    <div className="aspect-[16/10] w-full bg-zinc-900">
                      {c.image ? (
                        <img
                          alt={c.name || 'Model'}
                          src={resolveAssetUrl(c.image)}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                        />
                      ) : (
                        <div className="h-full w-full bg-zinc-900" />
                      )}
                    </div>
                    <div className="p-4">
                      <div className="text-sm font-semibold text-zinc-100">{getDisplayCarName(c.name)}</div>
                      <div className="mt-3 text-xs text-zinc-400 group-hover:text-zinc-300">{t('custom_select_bike_arrow')}</div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6 text-sm text-zinc-400 sm:col-span-2 lg:col-span-3">
                  {t('custom_no_models')}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-zinc-200">{t('custom_load_3d_title')}</div>
                <div className="mt-1 text-xs text-zinc-500">
                  {displayCarName ? [displayCarName, selectedCar?.brand, selectedCc, selectedType].filter(Boolean).join(' • ') : ''}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setStep(2);
                    setCarId('');
                  }}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10"
                >
                  {t('custom_change_model')}
                </button>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
              <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950/40">
                <div className="aspect-[16/10] w-full bg-zinc-900">
                  {selectedCar?.image ? (
                    <img alt={selectedCar.name || 'Preview'} src={resolveAssetUrl(selectedCar.image)} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full bg-zinc-900" />
                  )}
                </div>
                <div className="space-y-1 p-4">
                  <div className="text-sm font-semibold text-zinc-100">{displayCarName || 'Untitled'}</div>
                  <div className="text-xs text-zinc-400">{t('custom_next_hint')}</div>
                </div>
              </div>

              <div className="rounded-3xl border border-zinc-800 bg-zinc-950/40 p-5">
                <div className="text-sm font-semibold text-zinc-200">{t('custom_parts_title')}</div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-zinc-300">
                  <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">{t('part_exhaust')}</div>
                  <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">{t('part_wheels')}</div>
                  <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">{t('part_suspension')}</div>
                  <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">{t('part_bodykit')}</div>
                </div>
                <div className="mt-4 text-xs text-zinc-500">
                  {t('custom_parts_note')}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <aside className="h-fit rounded-3xl border border-zinc-800/70 bg-zinc-950/50 p-5 backdrop-blur-xl">
        <div className="text-sm font-semibold text-zinc-200">{t('custom_summary')}</div>
        <div className="mt-4 space-y-3 text-sm">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-zinc-500">{t('custom_summary_brand')}</div>
            <div className="mt-1 font-semibold text-zinc-100">{selectedBrand?.name || '—'}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-zinc-500">{t('custom_summary_model')}</div>
            <div className="mt-1 font-semibold text-zinc-100">{displayCarName || '—'}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-zinc-500">{t('custom_summary_cc')}</div>
              <div className="mt-1 font-semibold text-zinc-100">{selectedCc || '—'}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-zinc-500">{t('custom_summary_type')}</div>
              <div className="mt-1 font-semibold text-zinc-100">{selectedType || '—'}</div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-2">
          <button
            type="button"
            disabled={!selectedCar?._id}
            onClick={openConfigurator}
            className={
              selectedCar?._id
                ? 'w-full rounded-2xl bg-sky-400 px-4 py-3 text-sm font-semibold text-zinc-950 hover:bg-sky-300'
                : 'w-full cursor-not-allowed rounded-2xl bg-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-300'
            }
          >
            {t('custom_open_3d')}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep(1);
              setBrandKey('');
              setCarId('');
            }}
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-200 hover:bg-white/10"
          >
            {t('custom_restart')}
          </button>
        </div>
      </aside>
    </div>
  );
};

export default Custom;
