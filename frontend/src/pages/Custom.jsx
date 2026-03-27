import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBrands, getCars } from '../services/api/cars.js';
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
          ? 'rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 shadow-[0_0_18px_rgba(16,185,129,0.18)]'
          : 'rounded-2xl border border-white/10 bg-white/5 px-4 py-3'
      }
    >
      <div className={active ? 'text-sm font-semibold text-emerald-200' : 'text-sm font-semibold text-zinc-200'}>{title}</div>
      <div className="mt-1 text-xs text-zinc-400">{desc}</div>
    </div>
  );
};

const Custom = () => {
  const nav = useNavigate();
  const { t } = useI18n();
  const [vehicleType, setVehicleType] = useState('pkl');
  const [brands, setBrands] = useState([]);
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [step, setStep] = useState(1);
  const [brandKey, setBrandKey] = useState('');
  const [carId, setCarId] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([getBrands({ vehicleType }), getCars()])
      .then(([b, c]) => {
        if (!alive) return;
        setBrands(Array.isArray(b) ? b : []);
        setCars(Array.isArray(c) ? c : []);
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
  }, [vehicleType]);

  const selectedBrand = useMemo(() => brands.find((b) => String(b?.key || '') === String(brandKey || '')) || null, [brands, brandKey]);
  const selectedCar = useMemo(() => cars.find((c) => String(c?._id || '') === String(carId || '')) || null, [cars, carId]);

  const carChoices = useMemo(() => {
    const name = String(selectedBrand?.name || '').trim();
    if (!name) return [];
    const rx = new RegExp(`^${name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}$`, 'i');
    return cars.filter((c) => rx.test(String(c?.brand || ''))).slice(0, 24);
  }, [cars, selectedBrand]);

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
              <div className="text-sm font-semibold text-emerald-300">{t('custom_badge')}</div>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-zinc-50 sm:text-3xl">{t('custom_title')}</h1>
              <div className="mt-2 text-sm text-zinc-400">{t('custom_desc')}</div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setVehicleType('pkl');
                  setStep(1);
                  setBrandKey('');
                  setCarId('');
                }}
                className={
                  vehicleType === 'pkl'
                    ? 'rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-zinc-950'
                    : 'rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10'
                }
              >
                PKL
              </button>
              <button
                type="button"
                onClick={() => {
                  setVehicleType('scooter');
                  setStep(1);
                  setBrandKey('');
                  setCarId('');
                }}
                className={
                  vehicleType === 'scooter'
                    ? 'rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-zinc-950'
                    : 'rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10'
                }
              >
                Scooter
              </button>
              <button
                type="button"
                onClick={() => {
                  setVehicleType('oto');
                  setStep(1);
                  setBrandKey('');
                  setCarId('');
                }}
                className={
                  vehicleType === 'oto'
                    ? 'rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-zinc-950'
                    : 'rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10'
                }
              >
                Ô tô
              </button>
            </div>
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
                    className="group text-left rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4 transition hover:border-emerald-500/30 hover:bg-zinc-950/60"
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
                    className="group overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/40 text-left transition hover:border-emerald-500/30"
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
                      <div className="text-sm font-semibold text-zinc-100">{c.name || 'Untitled'}</div>
                      <div className="mt-1 text-xs text-zinc-400">{[c.brand, c.category].filter(Boolean).join(' • ')}</div>
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
                  {selectedCar?.name ? `${selectedCar.name} • ${selectedCar.brand || ''}` : ''}
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
                <button
                  type="button"
                  onClick={openConfigurator}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-emerald-500 hover:shadow-[0_0_22px_rgba(16,185,129,0.3)]"
                >
                  {t('custom_open_3d')}
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
                  <div className="text-sm font-semibold text-zinc-100">{selectedCar?.name || 'Untitled'}</div>
                  <div className="text-xs text-zinc-400">{t('custom_next_hint')}</div>
                </div>
              </div>

              <div className="rounded-3xl border border-zinc-800 bg-zinc-950/40 p-5">
                <div className="text-sm font-semibold text-zinc-200">Phụ kiện</div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-zinc-300">
                  <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">Pô</div>
                  <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">Mâm</div>
                  <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">Phuộc</div>
                  <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">Bodykit</div>
                </div>
                <div className="mt-4 text-xs text-zinc-500">
                  Khi chọn phụ kiện, hệ thống sẽ tự gắn vào đúng vị trí và thay thế phụ kiện cũ.
                </div>
                <button
                  type="button"
                  onClick={openConfigurator}
                  className="mt-5 w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-zinc-950 hover:bg-emerald-500 hover:shadow-[0_0_22px_rgba(16,185,129,0.3)]"
                >
                  Bắt đầu gắn phụ kiện trong 3D
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <aside className="h-fit rounded-3xl border border-zinc-800/70 bg-zinc-950/50 p-5 backdrop-blur-xl">
        <div className="text-sm font-semibold text-zinc-200">Tóm tắt</div>
        <div className="mt-4 space-y-3 text-sm">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-zinc-500">Hãng</div>
            <div className="mt-1 font-semibold text-zinc-100">{selectedBrand?.name || '—'}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-zinc-500">Dòng xe</div>
            <div className="mt-1 font-semibold text-zinc-100">{selectedCar?.name || '—'}</div>
          </div>
        </div>

        <div className="mt-5 grid gap-2">
          <button
            type="button"
            disabled={!selectedCar?._id}
            onClick={openConfigurator}
            className={
              selectedCar?._id
                ? 'w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-zinc-950 hover:bg-emerald-500'
                : 'w-full cursor-not-allowed rounded-2xl bg-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-300'
            }
          >
            Mở Custom 3D
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
            Làm lại từ đầu
          </button>
        </div>
      </aside>
    </div>
  );
};

export default Custom;
