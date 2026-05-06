import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listFollowing, toggleFollow } from '../services/api/follow.js';
import { useAuth } from '../services/auth/AuthContext.jsx';
import { useI18n } from '../services/i18n.jsx';

const Following = () => {
  const { t } = useI18n();
  const { token } = useAuth();
  const [tab, setTab] = useState('part');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const tabs = useMemo(
    () => [
      { key: 'part', label: t('following_tab_parts') },
      { key: 'build', label: t('following_tab_builds') }
    ],
    [t]
  );

  const load = useCallback(async (nextTab) => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await listFollowing({ token, itemType: nextTab, limit: 50 });
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      setError(String(e?.message || 'FAILED_TO_LOAD'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load(tab);
  }, [load, tab]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-black/30 p-6 backdrop-blur-xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-semibold tracking-[0.22em] text-sky-300/90">{t('nav_following')}</div>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-zinc-50">{t('following_title')}</h1>
          </div>
          <div className="flex items-center gap-2">
            {tabs.map((x) => {
              const active = x.key === tab;
              return (
                <button
                  key={x.key}
                  type="button"
                  onClick={() => setTab(x.key)}
                  className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                    active ? 'border-sky-400/30 bg-sky-500/10 text-sky-100' : 'border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10'
                  }`}
                >
                  {x.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {t('common_error')}: {error}
        </div>
      ) : null}

      {loading ? <div className="text-sm text-zinc-400">{t('common_loading')}</div> : null}

      {!loading && !error && !items.length ? (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-sm text-zinc-300">{t('following_empty')}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {items.map((it) => {
          const itemType = String(it?.itemType || tab);
          const itemId = String(it?.itemId || '');
          const name = String(it?.name || it?.carName || '').trim() || itemId;
          const sub =
            itemType === 'part'
              ? String(it?.type || '').trim()
              : String(it?.carName || '').trim();
          const thumb = String(it?.thumbnailUrl || '').trim();
          const to = itemType === 'build' ? `/builds/${encodeURIComponent(itemId)}` : '/parts';

          return (
            <div key={`${itemType}:${itemId}`} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="h-12 w-12 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                {thumb ? <img src={thumb} alt="" className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <Link to={to} className="block truncate text-sm font-semibold text-zinc-100 hover:text-sky-200">
                  {name}
                </Link>
                <div className="mt-0.5 truncate text-xs text-zinc-400">{sub}</div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (!token || !itemId) return;
                  try {
                    await toggleFollow({ token, itemType, itemId });
                    setItems((prev) => (Array.isArray(prev) ? prev.filter((x) => String(x?.itemId || '') !== itemId) : prev));
                  } catch {}
                }}
                className="shrink-0 rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/15"
              >
                {t('follow_btn_unfollow')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Following;
