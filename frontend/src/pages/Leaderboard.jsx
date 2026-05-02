import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  favoriteConfiguration,
  getLeaderboard,
  likeConfiguration,
  unfavoriteConfiguration
} from '../services/api/configurations.js';
import { getApiBaseUrl } from '../services/api/client.js';
import { useAuth } from '../services/auth/AuthContext.jsx';
import { useI18n } from '../services/i18n.jsx';

const Leaderboard = () => {
  const { t } = useI18n();
  const { isAuthed, token } = useAuth();
  const resolveUrl = (u) => {
    const base = getApiBaseUrl();
    const raw = String(u || '').trim();
    if (!raw) return '';
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
    if (raw.startsWith('/')) return `${base}${raw}`;
    return raw;
  };

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyById, setBusyById] = useState({});
  const [toast, setToast] = useState('');
  const [range, setRange] = useState('day');

  useEffect(() => {
    let alive = true;
    const fetchRows = (showLoading) => {
      if (showLoading) setLoading(true);
      return getLeaderboard({ range, limit: 48, token: isAuthed ? token : undefined })
        .then((rows) => {
          if (!alive) return;
          setItems(Array.isArray(rows) ? rows : []);
        })
        .catch(() => {
          if (!alive) return;
          setItems([]);
        })
        .finally(() => {
          if (!alive) return;
          if (showLoading) setLoading(false);
        });
    };

    fetchRows(true);
    const poll = window.setInterval(() => fetchRows(false), 10_000);
    return () => {
      alive = false;
      window.clearInterval(poll);
    };
  }, [isAuthed, token, range]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(''), 1800);
    return () => window.clearTimeout(id);
  }, [toast]);

  const ranked = useMemo(() => {
    const base = Array.isArray(items) ? items : [];
    return base
      .slice()
      .sort((a, b) => (Number(b?.likesCount) || 0) - (Number(a?.likesCount) || 0) || String(b?.publishedAt || '').localeCompare(String(a?.publishedAt || '')));
  }, [items]);

  const onVote = async (row) => {
    const id = String(row?._id || '');
    if (!id) return;
    if (!isAuthed) {
      setToast(t('leaderboard_login_to_vote'));
      return;
    }
    if (busyById[id]) return;
    if (Boolean(row?.likedByMe)) return;
    setBusyById((p) => ({ ...(p || {}), [id]: true }));
    try {
      const res = await likeConfiguration({ token, configId: id });
      const patch = res?.item;
      setItems((prev) =>
        (Array.isArray(prev) ? prev : []).map((x) => {
          if (String(x?._id || '') !== id) return x;
          return { ...x, ...(patch || {}) };
        })
      );
    } finally {
      setBusyById((p) => {
        const next = { ...(p || {}) };
        delete next[id];
        return next;
      });
    }
  };

  const onToggleFavorite = async (row) => {
    const id = String(row?._id || '');
    if (!id) return;
    if (!isAuthed) {
      setToast(t('leaderboard_login_to_vote'));
      return;
    }
    if (busyById[id]) return;
    setBusyById((p) => ({ ...(p || {}), [id]: true }));
    try {
      const fav = Boolean(row?.favoritedByMe);
      const res = fav ? await unfavoriteConfiguration({ token, configId: id }) : await favoriteConfiguration({ token, configId: id });
      const patch = res?.item;
      setItems((prev) =>
        (Array.isArray(prev) ? prev : []).map((x) => {
          if (String(x?._id || '') !== id) return x;
          return { ...x, ...(patch || {}) };
        })
      );
    } finally {
      setBusyById((p) => {
        const next = { ...(p || {}) };
        delete next[id];
        return next;
      });
    }
  };

  const tabs = [
    { key: 'day', label: t('leaderboard_tab_day') },
    { key: 'week', label: t('leaderboard_tab_week') },
    { key: 'month', label: t('leaderboard_tab_month') },
    { key: 'all', label: t('leaderboard_tab_all') }
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{t('leaderboard_title')}</h1>
            <div className="mt-1 text-sm text-zinc-400">{t('leaderboard_subtitle')}</div>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/builds" className="text-sm text-zinc-300 hover:text-zinc-100">
              {t('builds_title')}
            </Link>
            <Link to="/" className="text-sm text-sky-300 hover:text-sky-200">
              {t('common_back_home')}
            </Link>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const active = range === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setRange(tab.key)}
                className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                  active ? 'border-sky-300/45 bg-sky-500/12 text-white' : 'border-white/10 bg-black/15 text-white/75 hover:bg-black/25'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {toast ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-semibold text-white/90">{toast}</div>
        ) : null}

        {loading ? (
          <div className="mt-6 text-sm text-zinc-500">{t('common_loading')}</div>
        ) : ranked.length ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {ranked.map((row, idx) => {
              const id = String(row?._id || '');
              const carName = row?.carId?.name || '';
              const buildName = String(row?.name || '').trim();
              const userName = row?.userId?.name || '';
              const title = buildName || carName || t('carcard_default');
              const partsCount = (Array.isArray(row?.selectedParts) ? row.selectedParts.length : 0) + (row?.selectedWheels ? 1 : 0);
              const likes = Number(row?.likesCount) || 0;
              const likedByMe = Boolean(row?.likedByMe);
              const favs = Number(row?.favoritesCount) || 0;
              const favoritedByMe = Boolean(row?.favoritedByMe);
              const views = Number(row?.viewsCount) || 0;
              const busy = Boolean(busyById[id]);
              const imageUrl = resolveUrl(row?.imageUrl || row?.thumbnailUrl || row?.carId?.thumbnailUrl);

              return (
                <div
                  key={id || idx}
                  className="group relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950/60 shadow-[0_30px_120px_-80px_rgba(0,0,0,0.95)] transition hover:border-sky-400/25"
                >
                  <div className="absolute inset-0 bg-[radial-gradient(520px_260px_at_26%_0%,rgba(56,189,248,0.16),transparent_60%)] opacity-0 transition-opacity group-hover:opacity-100" />

                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-black/20">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover opacity-95 transition duration-500 group-hover:scale-[1.04] group-hover:opacity-100"
                      />
                    ) : null}
                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.78),transparent_55%)]" />
                    <div className="absolute left-4 top-4">
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-3 py-1 text-xs font-black text-white/90">
                        <span className="text-white/70">#{idx + 1}</span>
                        <span className="h-1 w-1 rounded-full bg-white/30" />
                        <span>{t('leaderboard_votes')} {likes}</span>
                      </div>
                    </div>
                    <div className="absolute inset-x-4 bottom-4">
                      <div className="truncate text-[15px] font-semibold text-white">{title}</div>
                      <div className="mt-1 flex items-center justify-between gap-3 text-xs text-white/65">
                        <div className="truncate">
                          {userName ? `${userName} • ` : ''}
                          {partsCount} {t('landing_parts_unit')}
                        </div>
                        <div className="shrink-0">
                          {t('leaderboard_views')} {views}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="relative grid gap-3 p-4">
                    <div className="grid grid-cols-2 gap-2">
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onVote(row)}
                        disabled={busy || likedByMe}
                        className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                          likedByMe
                            ? 'border-white/10 bg-black/20 text-white/90'
                            : 'border-sky-300/25 bg-sky-400 text-zinc-950 hover:bg-sky-300'
                        }`}
                      >
                        <span>👍</span>
                        <span>{likedByMe ? t('leaderboard_vote_done') : t('leaderboard_like')}</span>
                      </motion.button>

                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onToggleFavorite(row)}
                        disabled={busy}
                        className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                          favoritedByMe
                            ? 'border-rose-300/25 bg-rose-400 text-zinc-950 hover:bg-rose-300'
                            : 'border-white/10 bg-black/20 text-white/90 hover:bg-black/35'
                        }`}
                      >
                        <span>❤️</span>
                        <span>
                          {favoritedByMe ? t('leaderboard_favorited') : t('leaderboard_favorite')}
                        </span>
                      </motion.button>
                    </div>

                    <div className="flex items-center justify-between gap-3 text-xs text-white/60">
                      <div className="flex items-center gap-3">
                        <span>
                          {t('leaderboard_votes')} {likes}
                        </span>
                        <span>
                          {t('leaderboard_favorites')} {favs}
                        </span>
                      </div>
                      <Link
                        to={`/builds/${encodeURIComponent(id)}`}
                        className="rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-xs font-semibold text-white/85 transition hover:bg-black/25"
                      >
                        {t('leaderboard_view_detail')}
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-6 text-sm text-zinc-500">{t('builds_coming')}</div>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
