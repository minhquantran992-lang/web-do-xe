import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getParts } from '../services/api/parts.js';
import FollowButton from '../components/FollowButton.jsx';
import { useI18n } from '../services/i18n.jsx';

const Parts = () => {
  const { t } = useI18n();
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search || ''), [location.search]);
  const type = String(params.get('type') || '').trim();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    getParts()
      .then((res) => {
        if (!alive) return;
        setItems(Array.isArray(res) ? res : []);
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

  const filtered = useMemo(() => {
    if (!type) return items;
    return items.filter((p) => String(p?.type || '') === type);
  }, [items, type]);

  const types = useMemo(() => {
    const set = new Set(items.map((p) => String(p?.type || '')).filter(Boolean));
    return Array.from(set);
  }, [items]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{t('parts_title')}</h1>
            <div className="mt-1 text-sm text-zinc-400">{t('parts_subtitle')}</div>
          </div>
          <Link to="/" className="text-sm text-sky-300 hover:text-sky-200">
            {t('common_back_home')}
          </Link>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            to="/parts"
            className={`rounded-full border px-3 py-1.5 text-xs transition ${
              !type ? 'border-sky-500/60 bg-sky-500/10 text-sky-200' : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-900'
            }`}
          >
            {t('common_all')}
          </Link>
          {types.map((t_key) => {
            const active = t_key === type;
            return (
              <Link
                key={t_key}
                to={`/parts?type=${encodeURIComponent(t_key)}`}
                className={`rounded-full border px-3 py-1.5 text-xs transition ${
                  active ? 'border-sky-500/60 bg-sky-500/10 text-sky-200' : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-900'
                }`}
              >
                {t(`part_${t_key}`) !== `part_${t_key}` ? t(`part_${t_key}`) : t_key}
              </Link>
            );
          })}
        </div>
      </div>

      {loading ? <div className="text-zinc-400">{t('common_loading')}</div> : null}
      {error ? (
        <div className="text-red-400">
          {t('common_error')}: {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => (
          <div key={p._id} className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/30 transition hover:-translate-y-0.5 hover:bg-zinc-900/50">
            <div className="aspect-[16/10] w-full bg-zinc-900">
              {p.thumbnailUrl ? <img src={p.thumbnailUrl} alt="" className="h-full w-full object-cover" /> : null}
            </div>
            <div className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-zinc-100">{p.name || 'Part'}</div>
                  <div className="mt-1 text-xs text-zinc-400">{TYPE_LABEL[p.type] || p.type || 'Accessory'}</div>
                </div>
                <FollowButton itemType="part" itemId={p._id} size="xs" />
              </div>
              {Number(p?.price) ? <div className="text-xs font-semibold text-zinc-200">{Number(p.price)} đ</div> : null}
              {p.modelUrl ? (
                <a className="text-xs text-sky-300 hover:text-sky-200" href={p.modelUrl} target="_blank" rel="noreferrer">
                  {t('parts_view_model')}
                </a>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {!loading && !error && filtered.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-6 text-zinc-400">{t('parts_empty')}</div>
      ) : null}
    </div>
  );
};

export default Parts;
