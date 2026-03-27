import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CarCard from '../components/CarCard.jsx';
import { getCars } from '../services/api/cars.js';
import { useI18n } from '../services/i18n.jsx';

const SkeletonCard = () => {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/40">
      <div className="aspect-[16/10] w-full animate-pulse bg-zinc-900" />
      <div className="space-y-3 p-4">
        <div className="h-4 w-2/3 animate-pulse rounded bg-zinc-800" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-900" />
        <div className="h-9 w-36 animate-pulse rounded bg-zinc-800" />
      </div>
    </div>
  );
};

const Dashboard = () => {
  const nav = useNavigate();
  const { t } = useI18n();
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  const featured = useMemo(() => cars.slice(0, 6), [cars]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-zinc-800/70 bg-zinc-950/50 p-6 backdrop-blur-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-sm font-semibold text-emerald-300">{t('nav_dashboard')}</div>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-zinc-50 sm:text-3xl">
              {t('dash_welcome')}
            </h1>
            <div className="mt-2 max-w-2xl text-sm text-zinc-400">
              {t('dash_desc')}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => nav('/custom')}
              className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-500 hover:shadow-[0_0_24px_rgba(16,185,129,0.35)]"
            >
              {t('dash_create_new')}
            </button>
            <button
              type="button"
              onClick={() => nav('/garage')}
              className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-zinc-100 backdrop-blur transition hover:bg-white/10"
            >
              {t('dash_my_garage')}
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-200">{t('dash_samples_title')}</div>
          <div className="mt-1 text-sm text-zinc-500">{t('dash_samples_desc')}</div>
        </div>
      </div>

      {error ? <div className="rounded-2xl border border-red-900/40 bg-red-950/30 p-4 text-sm text-red-200">{error}</div> : null}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          featured.map((c) => <CarCard key={c._id} car={c} />)
        )}
      </div>
    </div>
  );
};

export default Dashboard;
