import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { cancelMyOrder, confirmMyOrder, getMyOrderDetail, rejectMyOrder } from '../services/api/orders.js';
import { getApiBaseUrl } from '../services/api/client.js';
import { useAuth } from '../services/auth/AuthContext.jsx';
import { useI18n } from '../services/i18n.jsx';

const cx = (...arr) => arr.filter(Boolean).join(' ');

const OrderDetail = () => {
  const { t } = useI18n();
  const { token } = useAuth();
  const { id } = useParams();

  const [item, setItem] = useState(null);
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const labelOf = useMemo(() => {
    const map = new Map((Array.isArray(steps) ? steps : []).map((s) => [String(s?.key || ''), String(s?.label || '')]));
    return (key) => map.get(String(key || '')) || String(key || '');
  }, [steps]);

  const statusLabelOf = useMemo(() => {
    const fallback = {
      REQUESTED: 'Yêu cầu báo giá',
      QUOTED: 'Đã có báo giá (chờ khách xác nhận)',
      CONFIRMED: 'Khách đã xác nhận (chờ thi công)',
      IN_PROGRESS: 'Đang thi công',
      COMPLETED: 'Hoàn tất',
      REJECTED: 'Khách từ chối báo giá',
      CANCELLED: 'Đơn bị hủy'
    };
    return (key) => labelOf(key) || fallback[String(key || '')] || String(key || '');
  }, [labelOf]);

  const resolveAssetUrl = useMemo(() => {
    const base = getApiBaseUrl();
    return (url) => {
      const u = String(url || '').trim();
      if (!u) return '';
      if (u.startsWith('data:') || u.startsWith('blob:')) return u;
      if (u.startsWith('http://') || u.startsWith('https://')) return u;
      if (u.startsWith('/')) return `${base}${u}`;
      return `${base}/${u}`;
    };
  }, []);

  const load = useCallback(async ({ silent } = {}) => {
    if (!token || !id) return;
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      const data = await getMyOrderDetail({ token, id });
      setItem(data?.item || null);
      setSteps(Array.isArray(data?.steps) ? data.steps : []);
    } catch (e) {
      setError(String(e?.message || 'FAILED_TO_LOAD'));
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    load({});
  }, [load]);

  useEffect(() => {
    if (!token || !id) return;
    const tId = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      load({ silent: true });
    }, 4000);
    return () => window.clearInterval(tId);
  }, [id, load, token]);

  const flow = Array.isArray(steps) ? steps : [];
  const history = Array.isArray(item?.history) ? item.history : [];
  const currentIdx = Number(item?.currentStepIndex) || 0;
  const statusKey = String(item?.status || '');
  const buildId = String(item?.build?._id || '').trim();
  const buildName = String(item?.build?.name || '').trim();
  const shopName = String(item?.shop?.shopName || '').trim();

  const quotedPrice = item?.quotedPrice ?? null;
  const quoteExpiresAt = item?.quoteExpiresAt || null;

  const isTerminal = statusKey === 'CANCELLED' || statusKey === 'REJECTED';
  const formatVnd = useMemo(() => {
    return (value) => {
      const n = Number(value);
      if (!Number.isFinite(n)) return '—';
      return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(n)} ₫`;
    };
  }, []);

  const badgeCls = useMemo(() => {
    if (isTerminal) return 'border-rose-400/25 bg-rose-500/10 text-rose-100';
    if (statusKey === 'COMPLETED') return 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100';
    if (statusKey === 'IN_PROGRESS') return 'border-amber-400/25 bg-amber-500/10 text-amber-100';
    if (statusKey === 'QUOTED') return 'border-sky-400/25 bg-sky-500/10 text-sky-100';
    return 'border-white/10 bg-white/5 text-zinc-200';
  }, [isTerminal, statusKey]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-black/30 p-6 backdrop-blur-xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs font-semibold tracking-[0.22em] text-sky-300/90">{t('nav_orders')}</div>
            <h1 className="mt-2 truncate text-2xl font-black tracking-tight text-zinc-50">{t('order_detail_title')}</h1>
            <div className="mt-2 text-sm text-zinc-400">{shopName ? `${shopName} • ${buildName || t('orders_build_fallback')}` : buildName || t('orders_build_fallback')}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/orders" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/10">
              {t('orders_back')}
            </Link>
            {buildId ? (
              <Link
                to={`/builds/${encodeURIComponent(buildId)}`}
                className="rounded-2xl border border-sky-400/25 bg-sky-500/10 px-4 py-2 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/15"
              >
                {t('order_detail_open_build')}
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {t('common_error')}: {error}
        </div>
      ) : null}
      {loading ? <div className="text-sm text-zinc-400">{t('common_loading')}</div> : null}

      {!loading && !error && item ? (
        <>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-zinc-400">Trạng thái</div>
                <div className="mt-1 text-lg font-black text-zinc-50">{statusLabelOf(statusKey)}</div>
              </div>
              <div className={cx('inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold', badgeCls)}>
                {statusLabelOf(statusKey)}
              </div>
            </div>

            {flow.length ? (
              <div className="mt-5">
                <div className="flex items-start justify-between gap-2">
                  {flow.map((s, idx) => {
                    const activeIndex = Math.min(flow.length - 1, Math.max(0, currentIdx));
                    const done = idx < activeIndex && !isTerminal;
                    const active = idx === activeIndex && !isTerminal;
                    const label = String(s?.label || '') || statusLabelOf(s?.key);
                    return (
                      <div key={String(s?.key || idx)} className="min-w-0 flex-1">
                        <div className="flex items-center">
                          <div
                            className={cx(
                              'grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-black',
                              done
                                ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
                                : active
                                  ? 'border-sky-400/30 bg-sky-500/10 text-sky-100'
                                  : 'border-white/10 bg-white/5 text-zinc-300'
                            )}
                          >
                            {done ? '✓' : idx + 1}
                          </div>
                          {idx !== flow.length - 1 ? (
                            <div
                              className={cx('mx-2 h-[2px] w-full rounded-full', done ? 'bg-emerald-400/30' : 'bg-white/10')}
                            />
                          ) : null}
                        </div>
                        <div className={cx('mt-2 text-center text-[11px] font-semibold', done ? 'text-zinc-100' : active ? 'text-sky-100' : 'text-zinc-400')}>
                          {label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {statusKey === 'QUOTED' ? (
              <div className="mt-5 rounded-2xl border border-sky-400/15 bg-sky-500/10 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-sky-100/80">Báo giá</div>
                    <div className="mt-1 text-lg font-black text-sky-100">{quotedPrice != null ? formatVnd(quotedPrice) : 'Shop đã gửi báo giá.'}</div>
                    {quoteExpiresAt ? <div className="mt-1 text-xs text-sky-100/70">Hết hạn: {new Date(quoteExpiresAt).toLocaleString()}</div> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        if (!token || !id) return;
                        setBusy(true);
                        try {
                          await confirmMyOrder({ token, id });
                          await load({});
                        } catch (e) {
                          setError(String(e?.message || 'FAILED_TO_CONFIRM'));
                        }
                        setBusy(false);
                      }}
                      className="rounded-2xl bg-emerald-400 px-4 py-2 text-sm font-bold text-zinc-950 hover:bg-emerald-300 disabled:opacity-60"
                    >
                      {busy ? 'Đang xử lý...' : 'Xác nhận báo giá'}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        if (!token || !id) return;
                        setBusy(true);
                        try {
                          await rejectMyOrder({ token, id });
                          await load({});
                        } catch (e) {
                          setError(String(e?.message || 'FAILED_TO_REJECT'));
                        }
                        setBusy(false);
                      }}
                      className="rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-2 text-sm font-bold text-rose-100 hover:bg-rose-500/15 disabled:opacity-60"
                    >
                      {busy ? 'Đang xử lý...' : 'Từ chối'}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {!isTerminal && (statusKey === 'REQUESTED' || statusKey === 'CONFIRMED') ? (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-zinc-400">{statusKey === 'CONFIRMED' ? 'Đã xác nhận. Chờ xưởng bắt đầu thi công.' : 'Đang chờ xưởng gửi báo giá.'}</div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    if (!token || !id) return;
                    setBusy(true);
                    try {
                      await cancelMyOrder({ token, id, reason: 'Khách hủy' });
                      await load({});
                    } catch (e) {
                      setError(String(e?.message || 'FAILED_TO_CANCEL'));
                    }
                    setBusy(false);
                  }}
                  className="rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-2 text-sm font-bold text-rose-100 hover:bg-rose-500/15 disabled:opacity-60"
                >
                  {busy ? 'Đang xử lý...' : 'Hủy đơn'}
                </button>
              </div>
            ) : null}

            {isTerminal ? (
              <div className="mt-5 rounded-2xl border border-rose-400/15 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                {statusKey === 'CANCELLED' ? 'Đơn đã bị hủy.' : 'Bạn đã từ chối báo giá.'}
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
            <div className="text-sm font-semibold text-zinc-100">{t('order_detail_timeline')}</div>
            <div className="mt-4">
              <ol className="relative ml-2 border-l border-white/10 pl-5">
              {history.map((h, idx) => {
                const ts = h?.happenedAt || null;
                const img = String(h?.imageUrl || '').trim();
                const note = String(h?.note || '').trim();
                const toStatus = String(h?.toStatus || '').trim();
                const fromStatus = h?.fromStatus ? String(h?.fromStatus || '').trim() : '';
                const who = String(h?.actorRole || '').trim();
                return (
                  <li key={String(h?._id || idx)} className="relative pb-6">
                    <div className="absolute -left-[23px] top-0.5 h-3 w-3 rounded-full border border-white/10 bg-zinc-950" />
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-zinc-100">
                            {fromStatus ? `${statusLabelOf(fromStatus)} → ` : ''}
                            {statusLabelOf(toStatus)}
                          </div>
                          <div className="mt-1 text-xs text-zinc-400">
                            {who ? (who === 'USER' ? 'Khách' : who === 'WORKSHOP' ? 'Xưởng' : 'Hệ thống') : null}
                            {who && ts ? ' • ' : null}
                            {ts ? new Date(ts).toLocaleString() : null}
                          </div>
                          {note ? <div className="mt-2 text-sm text-zinc-200">{note}</div> : null}
                        </div>
                        {img ? (
                          <a
                            href={resolveAssetUrl(img)}
                            target="_blank"
                            rel="noreferrer"
                            className="shrink-0 rounded-xl border border-sky-400/25 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-100"
                          >
                            {t('order_detail_view_proof')}
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
              </ol>
              {!history.length ? <div className="text-sm text-zinc-400">{t('orders_empty')}</div> : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default OrderDetail;
