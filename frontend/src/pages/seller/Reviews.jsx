import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../services/api/client.js';
import { useAuth } from '../../services/auth/AuthContext.jsx';
import { useI18n } from '../../services/i18n.jsx';

const cx = (...arr) => arr.filter(Boolean).join(' ');

const Stars = ({ value }) => {
  const v = Math.max(0, Math.min(5, Number(value) || 0));
  const full = Math.floor(v);
  const half = v - full >= 0.5;
  return (
    <div className="flex items-center gap-1 text-amber-300">
      {Array.from({ length: 5 }).map((_, i) => {
        const on = i < full || (i === full && half);
        return (
          <span key={i} className={cx('text-sm', on ? 'opacity-100' : 'opacity-25')}>
            ★
          </span>
        );
      })}
      <span className="ml-2 text-xs font-semibold text-zinc-400">{v ? v.toFixed(1) : '—'}</span>
    </div>
  );
};

const Reviews = () => {
  const { token } = useAuth();
  const { lang, t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [meta, setMeta] = useState({ averageRating: 0, reviewCount: 0 });
  const [items, setItems] = useState([]);
  const locale = lang === 'en' ? 'en-US' : 'vi-VN';

  useEffect(() => {
    if (!token) return;
    let alive = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await apiFetch('/api/vendor/reviews', { token });
        if (!alive) return;
        setMeta({
          averageRating: Number(data?.meta?.averageRating) || 0,
          reviewCount: Number(data?.meta?.reviewCount) || 0
        });
        setItems(Array.isArray(data?.items) ? data.items : []);
      } catch (e) {
        if (!alive) return;
        setError(e?.message || 'FAILED_TO_LOAD');
        setItems([]);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [token]);

  const top = useMemo(() => {
    const avg = Number(meta?.averageRating) || 0;
    const count = Number(meta?.reviewCount) || 0;
    return { avg, count };
  }, [meta?.averageRating, meta?.reviewCount]);

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-zinc-800/70 bg-zinc-950/50 p-6 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-zinc-50">{t('seller_reviews_title')}</div>
            <div className="mt-1 text-xs text-zinc-400">{t('seller_reviews_desc')}</div>
          </div>
          <div className="text-right">
            <Stars value={top.avg} />
            <div className="mt-1 text-xs font-semibold text-zinc-400">
              {top.count ? `${top.count} ${t('seller_reviews_count_suffix')}` : t('seller_reviews_empty')}
            </div>
          </div>
        </div>
      </div>

      {error ? <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}
      {loading ? <div className="text-sm text-zinc-500">{t('common_loading')}</div> : null}

      {!loading && !error ? (
        <div className="overflow-hidden rounded-3xl border border-zinc-800/70 bg-zinc-950/50 backdrop-blur-xl">
          <div className="divide-y divide-white/10">
            {items.length ? (
              items.map((r) => (
                <div key={String(r?._id || '')} className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-zinc-100">
                        {r?.user?.name || r?.user?.email || t('seller_requests_customer_fallback')}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {r?.createdAt ? new Date(r.createdAt).toLocaleString(locale) : ''}
                      </div>
                    </div>
                    <Stars value={r?.rating} />
                  </div>
                  {String(r?.comment || '').trim() ? (
                    <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-200">
                      {String(r.comment)}
                    </div>
                  ) : (
                    <div className="mt-3 text-sm text-zinc-400">—</div>
                  )}
                </div>
              ))
            ) : (
              <div className="px-5 py-6 text-sm text-zinc-400">{t('seller_reviews_empty')}</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Reviews;
