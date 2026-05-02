import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { searchItems } from '../services/api/search.js';
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

const formatPrice = (raw) => {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return '';
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(n)} ₫`;
};

const SearchResults = () => {
  const { t } = useI18n();
  const location = useLocation();
  const qs = useMemo(() => new URLSearchParams(String(location.search || '')), [location.search]);
  const q = String(qs.get('q') || '').trim();

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);

  useEffect(() => {
    let alive = true;
    if (!q) {
      setItems([]);
      setLoading(false);
      return () => {};
    }
    setLoading(true);
    searchItems({ q, limit: 50 })
      .then((res) => {
        if (!alive) return;
        setItems(Array.isArray(res) ? res : []);
      })
      .catch(() => {
        if (!alive) return;
        setItems([]);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [q]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs font-semibold tracking-wide text-white/55">{t('search_results_title')}</div>
          <h1 className="mt-2 truncate text-2xl font-black text-white">{q || t('search_hint')}</h1>
          <div className="mt-2 text-sm text-white/60">
            {loading ? t('search_loading') : `${items.length} ${t('search_results_count')}`}
          </div>
        </div>
        <Link
          to="/dashboard"
          className="shrink-0 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 hover:bg-white/10"
        >
          {t('common_back')}
        </Link>
      </div>

      <div className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-white/5">
        {items.length ? (
          <div className="divide-y divide-white/10">
            {items.map((it) => {
              const img = String(it?.image || '').trim();
              const price = it?.price != null ? formatPrice(it.price) : '';
              const href = String(it?.href || '').trim();
              return (
                <Link
                  key={`${it?.kind}:${it?.id || it?.code}`}
                  to={href || '#'}
                  className="flex items-center gap-4 px-5 py-4 transition hover:bg-white/5"
                >
                  <div className="h-12 w-12 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                    {img ? <img src={resolveAssetUrl(img)} alt="" className="h-full w-full object-cover" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-white">{it?.name || '-'}</div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-white/55">
                      <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 uppercase">{it?.kind}</span>
                      {it?.code ? <span className="truncate">{String(it.code)}</span> : null}
                    </div>
                  </div>
                  {price ? <div className="shrink-0 text-sm font-semibold text-sky-200">{price}</div> : null}
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="px-5 py-6 text-sm text-white/70">
            {q ? (loading ? t('search_loading') : t('search_no_results')) : t('search_hint')}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchResults;
