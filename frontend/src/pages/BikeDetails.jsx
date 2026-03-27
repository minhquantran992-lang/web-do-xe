import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getCars } from '../services/api/cars.js';
import { useI18n } from '../services/i18n.jsx';
import { useAuth } from '../services/auth/AuthContext.jsx';

const formatCc = (cc) => {
  const n = Number(cc);
  if (!Number.isFinite(n) || n <= 0) return '';
  return `${Math.round(n)}cc`;
};

const BikeDetails = () => {
  const { t } = useI18n();
  const { bikeId } = useParams();
  const nav = useNavigate();
  const { isAuthed } = useAuth();
  const [bike, setBike] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    getCars({ metrics: true })
      .then((items) => {
        if (!alive) return;
        const found = items.find((x) => String(x?._id || '') === String(bikeId || '')) || null;
        setBike(found);
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
  }, [bikeId]);

  const categoryLabel = useMemo(() => {
    const k = String(bike?.category || '').trim().toLowerCase();
    if (k === 'scooter') return t('category_scooter');
    if (k === 'oto' || k === 'car') return t('category_oto');
    if (k === 'pkl' || k === 'bigbike' || k === 'underbone' || k === 'sport' || k === 'naked') return t('category_pkl');
    return '';
  }, [bike?.category, t]);

  if (loading) return <div className="text-zinc-400">{t('common_loading')}</div>;
  if (error) {
    return (
      <div className="space-y-3">
        <div className="text-red-400">
          {t('common_error')}: {error}
        </div>
        <Link to="/bikes" className="text-emerald-400 hover:text-emerald-300">
          {t('bike_details_back')}
        </Link>
      </div>
    );
  }

  if (!bike) {
    return (
      <div className="space-y-3">
        <div className="text-zinc-300">{t('bikes_empty')}</div>
        <Link to="/bikes" className="text-emerald-400 hover:text-emerald-300">
          {t('bike_details_back')}
        </Link>
      </div>
    );
  }

  const cc = formatCc(bike.engineCc);

  const onCustomize = () => {
    const id = String(bike?._id || '');
    if (!id) return;
    if (isAuthed) {
      nav(`/configurator/${encodeURIComponent(id)}`);
      return;
    }
    nav(`/bikes?auth=required&go=${encodeURIComponent(id)}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-zinc-400">{t('bike_details_title')}</div>
          <h1 className="mt-1 text-2xl font-semibold">
            {[bike.brand, bike.name].filter(Boolean).join(' ')}
          </h1>
        </div>
        <Link to="/bikes" className="text-sm text-emerald-400 hover:text-emerald-300">
          {t('bike_details_back')}
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/30">
          <div className="aspect-[16/10] w-full bg-zinc-900">
            {bike.image ? <img src={bike.image} alt="" className="h-full w-full object-cover" /> : null}
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="text-xs text-zinc-400">{t('spec_brand')}</div>
              <div className="mt-1 font-medium text-zinc-100">{bike.brand || '-'}</div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="text-xs text-zinc-400">{t('spec_engine')}</div>
              <div className="mt-1 font-medium text-zinc-100">{cc || '-'}</div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 sm:col-span-2">
              <div className="text-xs text-zinc-400">{t('spec_type')}</div>
              <div className="mt-1 font-medium text-zinc-100">{categoryLabel || '-'}</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCustomize}
              className="inline-flex flex-1 items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium transition hover:bg-emerald-500"
            >
              {t('carcard_customize')}
            </button>
            <Link
              to="/bikes"
              className="inline-flex items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm font-medium text-zinc-200 transition hover:bg-zinc-900"
            >
              {t('bikes_title')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BikeDetails;
