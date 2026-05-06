import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '../services/api/notifications.js';
import { useAuth } from '../services/auth/AuthContext.jsx';
import { useI18n } from '../services/i18n.jsx';

const Notifications = () => {
  const { t } = useI18n();
  const { token } = useAuth();
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await listNotifications({ token, limit: 50, skip: 0 });
      setItems(Array.isArray(data?.items) ? data.items : []);
      setUnreadCount(Number(data?.unreadCount) || 0);
    } catch (e) {
      setError(String(e?.message || 'FAILED_TO_LOAD'));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-black/30 p-6 backdrop-blur-xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-semibold tracking-[0.22em] text-sky-300/90">{t('nav_notifications')}</div>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-zinc-50">{t('notifications_title')}</h1>
            {unreadCount ? <div className="mt-1 text-sm text-zinc-400">{unreadCount} chưa đọc</div> : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                if (!token) return;
                await markAllNotificationsRead({ token });
                await load();
              }}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/10"
            >
              {t('notifications_mark_all')}
            </button>
            <Link to="/following" className="rounded-2xl border border-sky-400/25 bg-sky-500/10 px-4 py-2 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/15">
              {t('nav_following')}
            </Link>
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
        <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-sm text-zinc-300">{t('notifications_empty')}</div>
      ) : null}

      <div className="space-y-2">
        {items.map((n) => {
          const id = String(n?._id || '');
          const isRead = Boolean(n?.isRead);
          const content = String(n?.content || '').trim();
          const meta = n?.meta && typeof n.meta === 'object' ? n.meta : null;
          const orderId = String(meta?.orderId || '').trim();
          const bookingId = String(meta?.bookingId || '').trim();
          const itemType = String(meta?.itemType || '').trim();
          const itemId = String(meta?.itemId || '').trim();
          const to = orderId
            ? `/orders/${encodeURIComponent(orderId)}`
            : bookingId
              ? `/booking/${encodeURIComponent(bookingId)}`
            : itemType === 'build' && itemId
              ? `/builds/${encodeURIComponent(itemId)}`
              : itemType === 'part'
                ? '/parts'
                : '';

          const Row = (
            <div
              className={`rounded-2xl border p-4 transition ${
                isRead ? 'border-white/10 bg-black/15 text-zinc-200' : 'border-sky-400/20 bg-sky-500/10 text-zinc-50'
              }`}
            >
              <div className="text-sm font-semibold">{content || n?.type || ''}</div>
              {n?.createdAt ? <div className="mt-1 text-xs text-zinc-400">{new Date(n.createdAt).toLocaleString()}</div> : null}
            </div>
          );

          return (
            <button
              key={id}
              type="button"
              onClick={async () => {
                if (!token || !id) return;
                if (!isRead) {
                  await markNotificationRead({ token, id });
                  setUnreadCount((c) => Math.max(0, Number(c || 0) - 1));
                  setItems((prev) => prev.map((x) => (String(x?._id || '') === id ? { ...x, isRead: true } : x)));
                }
                if (to) window.location.href = to;
              }}
              className="block w-full text-left"
            >
              {Row}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default Notifications;
