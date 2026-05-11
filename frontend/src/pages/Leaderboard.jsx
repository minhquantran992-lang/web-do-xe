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
  const formatDate = (value) => {
    if (!value) return '—';
    const d = value instanceof Date ? value : new Date(value);
    if (!d || Number.isNaN(d.getTime())) return '—';
    try {
      return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
    } catch {
      return d.toISOString().slice(0, 10);
    }
  };

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
          <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
            <div className="overflow-x-auto">
              <table className="min-w-[860px] w-full border-collapse">
                <thead className="bg-black/25">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wider text-white/65">
                    <th className="px-4 py-3">Pos</th>
                    <th className="px-4 py-3">Bản độ</th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Ngày tạo</th>
                    <th className="px-4 py-3 text-right">Bình chọn</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((row, idx) => {
                    const id = String(row?._id || '');
                    const carName = row?.carId?.name || '';
                    const buildName = String(row?.name || '').trim();
                    const userName = String(row?.userId?.name || '').trim();
                    const title = buildName || carName || t('carcard_default');
                    const partsCount = (Array.isArray(row?.selectedParts) ? row.selectedParts.length : 0) + (row?.selectedWheels ? 1 : 0);
                    const likes = Number(row?.likesCount) || 0;
                    const likedByMe = Boolean(row?.likedByMe);
                    const favoritedByMe = Boolean(row?.favoritedByMe);
                    const busy = Boolean(busyById[id]);
                    const imageUrl = resolveUrl(row?.imageUrl || row?.thumbnailUrl || row?.carId?.thumbnailUrl);
                    const createdAt = row?.publishedAt || row?.createdAt;
                    const pos = idx + 1;
                    const posTone =
                      pos === 1
                        ? 'border-amber-300/30 bg-amber-500/15 text-amber-100'
                        : pos === 2
                          ? 'border-white/15 bg-white/10 text-white/85'
                          : pos === 3
                            ? 'border-orange-300/25 bg-orange-500/10 text-orange-100'
                            : 'border-white/10 bg-white/5 text-white/80';

                    return (
                      <tr key={id || idx} className="border-t border-white/10 hover:bg-white/5">
                        <td className="px-4 py-3">
                          <div className={`inline-flex min-w-[44px] items-center justify-center rounded-xl border px-2 py-1 text-xs font-black ${posTone}`}>
                            {pos}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-16 overflow-hidden rounded-xl border border-white/10 bg-black/30">
                              {imageUrl ? <img src={imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" /> : null}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-white/90">{title}</div>
                              <div className="mt-0.5 truncate text-xs text-white/55">{partsCount} {t('landing_parts_unit')}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-white/80">{userName || '—'}</td>
                        <td className="px-4 py-3 text-sm text-white/70">{formatDate(createdAt)}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-white/85">{likes}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.98 }}
                              onClick={() => onVote(row)}
                              disabled={busy || likedByMe}
                              className={`rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                likedByMe ? 'border-white/10 bg-white/5 text-white/80' : 'border-sky-300/25 bg-sky-400 text-zinc-950 hover:bg-sky-300'
                              }`}
                            >
                              {likedByMe ? t('leaderboard_vote_done') : t('leaderboard_like')}
                            </motion.button>
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.98 }}
                              onClick={() => onToggleFavorite(row)}
                              disabled={busy}
                              className={`rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                favoritedByMe ? 'border-rose-300/25 bg-rose-400 text-zinc-950 hover:bg-rose-300' : 'border-white/10 bg-black/20 text-white/85 hover:bg-black/30'
                              }`}
                            >
                              {favoritedByMe ? t('leaderboard_favorited') : t('leaderboard_favorite')}
                            </motion.button>
                            <Link
                              to={`/builds/${encodeURIComponent(id)}`}
                              className="rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-xs font-semibold text-white/85 transition hover:bg-black/25"
                            >
                              {t('leaderboard_view_detail')}
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="mt-6 text-sm text-zinc-500">{t('builds_coming')}</div>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
