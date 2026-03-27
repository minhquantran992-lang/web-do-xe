import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../services/api/client.js';
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

const Skeleton = () => (
  <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/40">
    <div className="aspect-[16/10] w-full animate-pulse bg-zinc-900" />
    <div className="space-y-2 p-4">
      <div className="h-4 w-2/3 animate-pulse rounded bg-zinc-800" />
      <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-900" />
    </div>
  </div>
);

const Marketplace = () => {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    apiFetch('/cars')
      .then((data) => {
        if (!alive) return;
        const list = Array.isArray(data?.items) ? data.items : [];
        setItems(list);
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

  const cards = useMemo(() => items.slice(0, 24), [items]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-zinc-800/70 bg-zinc-950/50 p-6 backdrop-blur-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-sm font-semibold text-emerald-300">{t('nav_marketplace')}</div>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-zinc-50 sm:text-3xl">{t('market_heading')}</h1>
            <div className="mt-2 max-w-2xl text-sm text-zinc-400">
              {t('market_desc')}
            </div>
          </div>
          <Link to="/custom" className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-zinc-950 hover:bg-emerald-500">
            {t('dash_create_new')}
          </Link>
        </div>
      </div>

      {error ? <div className="rounded-2xl border border-red-900/40 bg-red-950/30 p-4 text-sm text-red-200">{error}</div> : null}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <>
            <Skeleton />
            <Skeleton />
            <Skeleton />
            <Skeleton />
            <Skeleton />
            <Skeleton />
          </>
        ) : cards.length ? (
          cards.map((it) => (
            <div key={it._id} className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/40">
              <div className="aspect-[16/10] w-full bg-zinc-900">
                {it.coverImage ? (
                  <img alt={it.title || 'Build'} src={resolveAssetUrl(it.coverImage)} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full bg-zinc-900" />
                )}
              </div>
              <div className="space-y-2 p-4">
                <div className="text-sm font-semibold text-zinc-100">{it.title || 'Untitled'}</div>
                <div className="text-xs text-zinc-400">
                  {it.vendor?.shopName ? `${t('market_shop_prefix')}${it.vendor.shopName}` : t('market_shop_empty')}
                </div>
                <div className="max-h-10 overflow-hidden text-xs text-zinc-500">{it.description || '—'}</div>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6 text-sm text-zinc-400 sm:col-span-2 lg:col-span-3">
            {t('market_empty')}
          </div>
        )}
      </div>
    </div>
  );
};

export default Marketplace;
