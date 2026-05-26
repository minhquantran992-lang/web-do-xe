import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { getApiBaseUrl } from '../services/api/client.js';
import { confirmMyBooking, listMyBookings, rejectMyBooking } from '../services/api/bookings.js';
import { confirmMyOrder, listMyOrders, rejectMyOrder, reviewMyOrder } from '../services/api/orders.js';
import { useAuth } from '../services/auth/AuthContext.jsx';
import { useI18n } from '../services/i18n.jsx';

const cx = (...arr) => arr.filter(Boolean).join(' ');
const MotionLink = motion(Link);

const MOTION_FAST = { duration: 0.18, ease: [0.2, 0.9, 0.2, 1] };

const toLocalDateKey = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return '';
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const todayKey = () => toLocalDateKey(new Date());

const Ink = ({ x, y, size, k }) => {
  return (
    <span
      key={k}
      className="pointer-events-none absolute rounded-full bg-white/35 opacity-0 ink-ripple"
      style={{ left: x, top: y, width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 }}
    />
  );
};

const useInk = () => {
  const [inks, setInks] = useState([]);
  const onPointerDown = useCallback((e) => {
    const el = e.currentTarget;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const size = Math.max(rect.width, rect.height) * 1.8;
    const k = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    setInks((prev) => [...(Array.isArray(prev) ? prev.slice(-2) : []), { x, y, size, k }]);
    window.setTimeout(() => setInks((prev) => (Array.isArray(prev) ? prev.filter((r) => r.k !== k) : [])), 450);
  }, []);
  const rendered = (Array.isArray(inks) ? inks : []).map((r) => <Ink key={r.k} {...r} />);
  return { onPointerDown, rendered };
};

const InkButton = ({ className, children, disabled, ...props }) => {
  const ink = useInk();
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.97 }}
      transition={MOTION_FAST}
      className={cx('relative overflow-hidden', disabled ? 'cursor-not-allowed' : '', className)}
      disabled={disabled}
      onPointerDown={(e) => {
        if (disabled) return;
        ink.onPointerDown(e);
        props?.onPointerDown?.(e);
      }}
      {...props}
    >
      {children}
      {ink.rendered}
    </motion.button>
  );
};

const TAB = Object.freeze({
  ALL: 'ALL',
  REQUESTED: 'REQUESTED',
  QUOTED: 'QUOTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CLOSED: 'CLOSED'
});

const STATUS_META = Object.freeze({
  REQUESTED: { label: 'Chờ báo giá', tone: 'yellow', hint: 'Đang chờ xưởng báo giá' },
  QUOTED: { label: 'Xác nhận', tone: 'orange', hint: '' },
  CONFIRMED: { label: 'Đã xác nhận', tone: 'cyan', hint: 'Đang chờ xưởng thi công' },
  IN_PROGRESS: { label: 'Đang thi công', tone: 'blue', hint: '' },
  COMPLETED: { label: 'Hoàn tất', tone: 'green', hint: '' },
  CANCELLED: { label: 'Đã hủy', tone: 'red', hint: 'Đơn đã bị hủy' },
  REJECTED: { label: 'Từ chối', tone: 'red', hint: 'Đơn đã bị hủy' },
  SHOP_REJECTED: { label: 'Shop từ chối', tone: 'red', hint: 'Shop từ chối nhận' }
});

const TAB_LIST = [
  { key: TAB.ALL, label: 'Tất cả', statuses: null },
  { key: TAB.REQUESTED, label: 'Chờ báo giá', statuses: ['REQUESTED'] },
  { key: TAB.QUOTED, label: 'Xác nhận', statuses: ['QUOTED'] },
  { key: TAB.IN_PROGRESS, label: 'Đang thi công', statuses: ['CONFIRMED', 'IN_PROGRESS'] },
  { key: TAB.COMPLETED, label: 'Hoàn tất', statuses: ['COMPLETED'] },
  { key: TAB.CLOSED, label: 'Đã hủy / Từ chối', statuses: ['CANCELLED', 'REJECTED', 'SHOP_REJECTED'] }
];

const SCOPE = Object.freeze({
  ORDERS: 'ORDERS',
  BOOKINGS: 'BOOKINGS'
});

const BOOKING_TAB = Object.freeze({
  ALL: 'ALL',
  PENDING: 'PENDING',
  QUOTED: 'QUOTED',
  ACCEPTED: 'ACCEPTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CLOSED: 'CLOSED'
});

const BOOKING_TAB_LIST = [
  { key: BOOKING_TAB.ALL, label: 'Tất cả', statuses: null },
  { key: BOOKING_TAB.PENDING, label: 'Chờ shop', statuses: ['pending'] },
  { key: BOOKING_TAB.QUOTED, label: 'Xác nhận', statuses: ['quoted'] },
  { key: BOOKING_TAB.ACCEPTED, label: 'Đã xác nhận', statuses: ['accepted'] },
  { key: BOOKING_TAB.IN_PROGRESS, label: 'Đang thi công', statuses: ['in_progress'] },
  { key: BOOKING_TAB.COMPLETED, label: 'Hoàn tất', statuses: ['completed'] },
  { key: BOOKING_TAB.CLOSED, label: 'Đã hủy / Từ chối', statuses: ['cancelled', 'rejected', 'expired'] }
];

const OrderStatusBadge = ({ status }) => {
  const meta = STATUS_META[String(status || '')] || { label: String(status || ''), tone: 'gray' };
  const cls =
    meta.tone === 'green'
      ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100'
      : meta.tone === 'blue'
        ? 'border-sky-400/25 bg-sky-500/10 text-sky-100'
        : meta.tone === 'orange'
          ? 'border-orange-400/25 bg-orange-500/10 text-orange-100'
          : meta.tone === 'yellow'
            ? 'border-amber-400/25 bg-amber-500/10 text-amber-100'
            : meta.tone === 'red'
              ? 'border-rose-400/25 bg-rose-500/10 text-rose-100'
              : meta.tone === 'cyan'
                ? 'border-cyan-400/25 bg-cyan-500/10 text-cyan-100'
                : 'border-white/10 bg-white/5 text-zinc-200';
  return (
    <motion.span
      key={`${String(status || '')}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={MOTION_FAST}
      className={cx('inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold', cls)}
    >
      {meta.label}
    </motion.span>
  );
};

const OrderTabs = ({ active, onChange, counts }) => {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-2">
      <div className="no-scrollbar flex gap-2 overflow-x-auto whitespace-nowrap pr-1 sm:flex-wrap sm:overflow-visible sm:whitespace-normal sm:pr-0">
        {TAB_LIST.map((t) => {
          const isActive = active === t.key;
          const count = Number(counts?.[t.key] || 0);
          return (
            <InkButton
              key={t.key}
              onClick={() => onChange(t.key)}
              whileHover={{ scale: isActive ? 1.05 : 1.02 }}
              animate={isActive ? { scale: 1.05 } : { scale: 1 }}
              className={cx('inline-flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold', isActive ? 'bg-white text-zinc-950 shadow-lg shadow-black/30' : 'border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10')}
            >
              <span>{t.label}</span>
              <span
                className={cx(
                  'rounded-full px-2 py-0.5 text-[11px] font-black tabular-nums',
                  isActive ? 'bg-zinc-950/10 text-zinc-900' : 'bg-white/10 text-zinc-200'
                )}
              >
                {count}
              </span>
            </InkButton>
          );
        })}
      </div>
    </div>
  );
};

const BookingStatusBadge = ({ status }) => {
  const s = String(status || '').trim().toLowerCase();
  const meta =
    s === 'completed'
      ? { label: 'Hoàn tất', tone: 'green' }
      : s === 'in_progress'
        ? { label: 'Đang thi công', tone: 'blue' }
        : s === 'accepted'
          ? { label: 'Đã xác nhận', tone: 'cyan' }
          : s === 'quoted'
            ? { label: 'Chờ xác nhận', tone: 'orange' }
            : s === 'pending'
              ? { label: 'Chờ shop', tone: 'yellow' }
              : s === 'cancelled'
                ? { label: 'Đã hủy', tone: 'red' }
                : s === 'rejected'
                  ? { label: 'Shop từ chối', tone: 'red' }
                  : s === 'expired'
                    ? { label: 'Hết hạn', tone: 'red' }
                    : { label: String(status || ''), tone: 'gray' };
  const cls =
    meta.tone === 'green'
      ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100'
      : meta.tone === 'blue'
        ? 'border-sky-400/25 bg-sky-500/10 text-sky-100'
        : meta.tone === 'orange'
          ? 'border-orange-400/25 bg-orange-500/10 text-orange-100'
          : meta.tone === 'yellow'
            ? 'border-amber-400/25 bg-amber-500/10 text-amber-100'
            : meta.tone === 'red'
              ? 'border-rose-400/25 bg-rose-500/10 text-rose-100'
              : meta.tone === 'cyan'
                ? 'border-cyan-400/25 bg-cyan-500/10 text-cyan-100'
                : 'border-white/10 bg-white/5 text-zinc-200';
  return (
    <motion.span
      key={`${String(status || '')}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={MOTION_FAST}
      className={cx('inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold', cls)}
    >
      {meta.label}
    </motion.span>
  );
};

const BookingTabs = ({ active, onChange, counts }) => {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-2">
      <div className="no-scrollbar flex gap-2 overflow-x-auto whitespace-nowrap pr-1 sm:flex-wrap sm:overflow-visible sm:whitespace-normal sm:pr-0">
        {BOOKING_TAB_LIST.map((t) => {
          const isActive = active === t.key;
          const count = Number(counts?.[t.key] || 0);
          return (
            <InkButton
              key={t.key}
              onClick={() => onChange(t.key)}
              whileHover={{ scale: isActive ? 1.05 : 1.02 }}
              animate={isActive ? { scale: 1.05 } : { scale: 1 }}
              className={cx(
                'inline-flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold',
                isActive ? 'bg-white text-zinc-950 shadow-lg shadow-black/30' : 'border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10'
              )}
            >
              <span>{t.label}</span>
              <span
                className={cx(
                  'rounded-full px-2 py-0.5 text-[11px] font-black tabular-nums',
                  isActive ? 'bg-zinc-950/10 text-zinc-900' : 'bg-white/10 text-zinc-200'
                )}
              >
                {count}
              </span>
            </InkButton>
          );
        })}
      </div>
    </div>
  );
};

const OrderCardSkeleton = () => {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
      <div className="animate-pulse space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="h-4 w-40 rounded bg-white/10" />
          <div className="h-6 w-28 rounded-full bg-white/10" />
        </div>
        <div className="flex gap-4">
          <div className="h-16 w-16 rounded-2xl bg-white/10" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-56 rounded bg-white/10" />
            <div className="h-3 w-40 rounded bg-white/10" />
            <div className="h-3 w-32 rounded bg-white/10" />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="h-3 w-52 rounded bg-white/10" />
          <div className="h-9 w-28 rounded-2xl bg-white/10" />
        </div>
      </div>
    </div>
  );
};

const StarsInput = ({ value, onChange, disabled }) => {
  const v = Math.max(0, Math.min(5, Number(value) || 0));
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: 5 }).map((_, i) => {
        const n = i + 1;
        const on = n <= v;
        return (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange(n)}
            className={cx(
              'text-xl font-black transition',
              on ? 'text-amber-300' : 'text-white/20',
              disabled ? 'opacity-70' : 'hover:brightness-110'
            )}
          >
            ★
          </button>
        );
      })}
      <div className="text-sm font-bold text-zinc-200">{v ? `${v}/5` : '—'}</div>
    </div>
  );
};

const OrderCard = ({ order, resolveAssetUrl, onConfirm, onReject, onOpenReview, busyId, flash, index }) => {
  const id = String(order?._id || '').trim();
  const status = String(order?.status || '').trim();
  const meta = STATUS_META[status] || { label: status, tone: 'gray', hint: '' };
  const shopName = String(order?.shop?.shopName || '').trim();
  const buildName = String(order?.build?.name || '').trim();
  const thumb = String(order?.build?.thumbnailUrl || '').trim() || String(order?.shop?.logo || '').trim();
  const q = order?.quotedPrice;
  const hasQuote = Number.isFinite(Number(q)) && Number(q) > 0;
  const isBusy = String(busyId || '') === id;
  const isClosed = status === 'CANCELLED' || status === 'REJECTED';

  const formatVnd = (value) => `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Number(value) || 0)} ₫`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ ...MOTION_FAST, delay: Math.min(0.12, (Number(index) || 0) * 0.03) }}
      whileHover={{ y: -4, boxShadow: '0 28px 90px -70px rgba(0,0,0,0.85)' }}
      whileTap={{ scale: 0.97 }}
      className={cx(
        'rounded-3xl border border-white/10 bg-black/20 p-5 transition-[border-color] duration-200',
        flash ? 'order-flash' : ''
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-zinc-400">Workshop</div>
          <div className="truncate text-sm font-black text-zinc-50">{shopName || '—'}</div>
        </div>
        <OrderStatusBadge status={status} />
      </div>

      <div className="mt-4 flex gap-4">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          {thumb ? <img src={resolveAssetUrl(thumb)} alt="" className="h-full w-full object-cover" /> : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-black text-zinc-50">{buildName || '—'}</div>
          {status === 'QUOTED' ? (
            <div className="mt-1 text-sm font-semibold text-zinc-200">
              {hasQuote ? (
                <>
                  <span className="text-zinc-400">Giá báo:</span> {formatVnd(q)}
                </>
              ) : (
                <span className="text-zinc-400">Chưa có báo giá</span>
              )}
            </div>
          ) : hasQuote ? (
            <div className="mt-1 text-sm font-semibold text-zinc-200">
              <span className="text-zinc-400">Giá báo:</span> {formatVnd(q)}
            </div>
          ) : null}
          {meta.hint ? <div className="mt-1 text-sm text-zinc-400">{meta.hint}</div> : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-zinc-400">
          {status === 'IN_PROGRESS' ? (
            <div className="w-[240px] max-w-full">
              <div className="text-sm font-semibold text-sky-100">Đang thi công</div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full border border-white/10 bg-white/5">
                <div className="h-full w-1/2 animate-pulse bg-sky-400" />
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {status === 'QUOTED' ? (
            <>
              <InkButton
                disabled={isBusy || !hasQuote}
                onClick={() => onConfirm(id)}
                whileHover={{ scale: isBusy ? 1 : 1.02 }}
                className="rounded-2xl bg-gradient-to-r from-sky-400 to-cyan-300 px-4 py-2 text-sm font-black text-zinc-950 hover:brightness-110 disabled:opacity-60"
              >
                {isBusy ? 'Đang xử lý…' : 'Xác nhận'}
              </InkButton>
              <InkButton
                disabled={isBusy}
                onClick={() => onReject(id)}
                whileHover={{ scale: isBusy ? 1 : 1.02 }}
                className="rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-2 text-sm font-bold text-rose-100 hover:bg-rose-500/15 disabled:opacity-60"
              >
                {isBusy ? 'Đang xử lý…' : 'Từ chối'}
              </InkButton>
            </>
          ) : status === 'COMPLETED' ? (
            <>
              <InkButton
                disabled={isBusy}
                onClick={() => onOpenReview(order)}
                whileHover={{ scale: isBusy ? 1 : 1.02 }}
                className="rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-2 text-sm font-bold text-amber-100 hover:bg-amber-500/15 disabled:opacity-60"
              >
                Đánh giá
              </InkButton>
              <MotionLink
                to={`/orders/${encodeURIComponent(id)}`}
                whileTap={{ scale: 0.97 }}
                transition={MOTION_FAST}
                className="relative overflow-hidden rounded-2xl bg-white px-4 py-2 text-sm font-black text-zinc-950 hover:bg-zinc-100"
              >
                Xem chi tiết
              </MotionLink>
            </>
          ) : (
            <MotionLink
              to={`/orders/${encodeURIComponent(id)}`}
              whileTap={{ scale: 0.97 }}
              transition={MOTION_FAST}
              className={cx(
                'relative overflow-hidden rounded-2xl px-4 py-2 text-sm font-bold transition',
                isClosed ? 'border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10' : 'bg-white text-zinc-950 hover:bg-zinc-100'
              )}
            >
              Xem chi tiết
            </MotionLink>
          )}
        </div>
      </div>

      {status === 'QUOTED' && !hasQuote ? (
        <div className="mt-4 rounded-2xl border border-amber-400/15 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Shop đã chuyển trạng thái chờ xác nhận nhưng chưa nhập giá.
        </div>
      ) : null}
    </motion.div>
  );
};

const BookingCard = ({ booking, resolveAssetUrl, onConfirm, onReject, busyId, index }) => {
  const id = String(booking?._id || '').trim();
  const status = String(booking?.status || '').trim().toLowerCase();
  const shopName = String(booking?.shop?.shopName || '').trim();
  const snapshot = booking?.snapshot || {};
  const title = String(snapshot?.buildName || snapshot?.carName || snapshot?.bikeName || '').trim() || 'Yêu cầu lắp đặt';
  const code = id ? `#${id.slice(-10)}` : '';
  const timeLabel = booking?.timeSlot ? new Date(booking.timeSlot).toLocaleString('vi-VN') : '';
  const q = booking?.quotedPrice;
  const hasQuote = Number.isFinite(Number(q)) && Number(q) > 0;
  const isBusy = String(busyId || '') === id;
  const thumb = String(snapshot?.previewImageUrl || booking?.shop?.logo || booking?.shop?.coverImage || '').trim();
  const note = String(booking?.quoteNote || '').trim();

  const formatVnd = (value) => `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Number(value) || 0)} ₫`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ ...MOTION_FAST, delay: Math.min(0.12, (Number(index) || 0) * 0.03) }}
      whileHover={{ y: -4, boxShadow: '0 28px 90px -70px rgba(0,0,0,0.85)' }}
      whileTap={{ scale: 0.97 }}
      className="overflow-hidden rounded-3xl border border-white/10 bg-black/20 p-5 transition-[border-color] duration-200"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xs font-semibold text-zinc-400">Shop</div>
            {code ? (
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-bold text-zinc-200">
                {code}
              </span>
            ) : null}
          </div>
          <div className="mt-1 truncate text-base font-black text-zinc-50">{shopName || '—'}</div>
        </div>
        <BookingStatusBadge status={status} />
      </div>

      <div className="mt-4 flex gap-4">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          {thumb ? <img src={resolveAssetUrl(thumb)} alt="" className="h-full w-full object-cover" /> : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-black text-zinc-50">{title}</div>
          {timeLabel ? (
            <div className="mt-1 text-sm font-semibold text-zinc-200">
              <span className="text-zinc-400">Thời gian:</span> {timeLabel}
            </div>
          ) : null}
          {hasQuote ? (
            <div className="mt-1 text-sm font-semibold text-zinc-200">
              <span className="text-zinc-400">Báo giá:</span> {formatVnd(q)}
            </div>
          ) : null}
          {note ? <div className="mt-1 line-clamp-2 text-xs text-zinc-400">Ghi chú: {note}</div> : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs font-semibold text-zinc-500">{status === 'quoted' ? 'Vui lòng xác nhận hoặc từ chối' : ''}</div>
        <div className="flex flex-wrap items-center gap-2">
          {status === 'quoted' ? (
            <>
              <InkButton
                disabled={isBusy || !hasQuote}
                onClick={() => onConfirm(id)}
                whileHover={{ scale: isBusy ? 1 : 1.02 }}
                className="rounded-2xl bg-gradient-to-r from-sky-400 to-cyan-300 px-4 py-2 text-sm font-black text-zinc-950 hover:brightness-110 disabled:opacity-60"
              >
                {isBusy ? 'Đang xử lý…' : 'Xác nhận'}
              </InkButton>
              <InkButton
                disabled={isBusy}
                onClick={() => onReject(id)}
                whileHover={{ scale: isBusy ? 1 : 1.02 }}
                className="rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-2 text-sm font-bold text-rose-100 hover:bg-rose-500/15 disabled:opacity-60"
              >
                {isBusy ? 'Đang xử lý…' : 'Từ chối'}
              </InkButton>
            </>
          ) : (
            <MotionLink
              to={`/booking/${encodeURIComponent(id)}`}
              whileTap={{ scale: 0.97 }}
              transition={MOTION_FAST}
              className="relative overflow-hidden rounded-2xl bg-white px-4 py-2 text-sm font-black text-zinc-950 hover:bg-zinc-100"
            >
              Xem chi tiết
            </MotionLink>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const Orders = () => {
  const { t } = useI18n();
  const { token } = useAuth();
  const [scope, setScope] = useState(SCOPE.BOOKINGS);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [syncToast, setSyncToast] = useState('');
  const [activeTab, setActiveTab] = useState(TAB.ALL);
  const [busyId, setBusyId] = useState('');
  const [review, setReview] = useState({ open: false, order: null, rating: 5, comment: '', busy: false, error: '' });
  const [flashIds, setFlashIds] = useState(() => new Set());
  const [limit, setLimit] = useState(20);
  const prevLimitRef = useRef(20);
  const loadMoreRef = useRef(null);
  const lastSnapshotRef = useRef(new Map());
  const pollingRef = useRef(false);

  const [bookingItems, setBookingItems] = useState([]);
  const [bookingLoading, setBookingLoading] = useState(true);
  const [bookingError, setBookingError] = useState('');
  const [bookingTab, setBookingTab] = useState(BOOKING_TAB.ALL);
  const [bookingDay, setBookingDay] = useState(() => todayKey());

  const flashOnce = useCallback((id) => {
    const k = String(id || '').trim();
    if (!k) return;
    setFlashIds((prev) => {
      const next = new Set(prev);
      next.add(k);
      return next;
    });
    window.setTimeout(() => {
      setFlashIds((prev) => {
        const next = new Set(prev);
        next.delete(k);
        return next;
      });
    }, 260);
  }, []);

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

  const maybeToastForChange = useCallback((o, prev) => {
    const id = String(o?._id || '').trim();
    const status = String(o?.status || '').trim();
    const prevStatus = String(prev?.status || '').trim();
    const shopName = String(o?.shop?.shopName || '').trim();
    const buildName = String(o?.build?.name || '').trim();
    const title = buildName || id.slice(-10) || 'đơn hàng';

    if (prev && prevStatus !== status) {
      if (status === 'QUOTED') return `Shop${shopName ? ` ${shopName}` : ''} đã báo giá cho ${title}.`;
      if (status === 'IN_PROGRESS') return `Shop${shopName ? ` ${shopName}` : ''} đã bắt đầu thi công ${title}.`;
      if (status === 'COMPLETED') return `Shop${shopName ? ` ${shopName}` : ''} đã hoàn tất ${title}.`;
    }

    const prevQuote = prev?.quotedPrice;
    const nextQuote = o?.quotedPrice;
    const hasPrev = Number.isFinite(Number(prevQuote)) && Number(prevQuote) > 0;
    const hasNext = Number.isFinite(Number(nextQuote)) && Number(nextQuote) > 0;
    if (hasNext && (!hasPrev || Number(prevQuote) !== Number(nextQuote))) {
      return `Shop${shopName ? ` ${shopName}` : ''} đã cập nhật báo giá cho ${title}.`;
    }
    return '';
  }, []);

  const fetchOrders = useCallback(
    async ({ silent } = {}) => {
      if (!token) return;
      if (pollingRef.current) return;
      pollingRef.current = true;
      const isMore = prevLimitRef.current < limit;
      if (!silent) {
        if (isMore) setLoadingMore(true);
        else setLoading(true);
      }
      setError('');
      try {
        const ordersRes = await listMyOrders({ token, limit });
        const arr = Array.isArray(ordersRes?.items) ? ordersRes.items : [];
        arr.sort((a, b) => new Date(b?.updatedAt || b?.createdAt || 0).getTime() - new Date(a?.updatedAt || a?.createdAt || 0).getTime());

        if (silent) {
          const prevMap = lastSnapshotRef.current instanceof Map ? lastSnapshotRef.current : new Map();
          let toast = '';
          for (const o of arr) {
            const id = String(o?._id || '').trim();
            if (!id) continue;
            const prev = prevMap.get(id);
            const prevStatus = String(prev?.status || '').trim();
            const nextStatus = String(o?.status || '').trim();
            const prevQuote = prev?.quotedPrice;
            const nextQuote = o?.quotedPrice;
            const statusChanged = Boolean(prev && prevStatus && prevStatus !== nextStatus);
            const quoteChanged = Number.isFinite(Number(nextQuote)) && Number(nextQuote) > 0 && Number(prevQuote) !== Number(nextQuote);
            if (statusChanged || quoteChanged) {
              flashOnce(id);
              if (!toast) toast = maybeToastForChange(o, prev);
            }
          }
          if (toast) {
            setSyncToast(toast);
            window.setTimeout(() => setSyncToast(''), 3800);
          }
        }

        setItems(arr);
        const nextMap = new Map();
        for (const o of arr) {
          const id = String(o?._id || '').trim();
          if (!id) continue;
          nextMap.set(id, { status: String(o?.status || '').trim(), quotedPrice: o?.quotedPrice ?? null });
        }
        lastSnapshotRef.current = nextMap;
      } catch (e) {
        const msg = String(e?.message || 'FAILED_TO_LOAD');
        setError(msg);
        if (prevLimitRef.current >= limit) setItems([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
        prevLimitRef.current = limit;
        pollingRef.current = false;
      }
    },
    [flashOnce, limit, maybeToastForChange, token]
  );

  useEffect(() => {
    if (!token) return;
    if (scope !== SCOPE.ORDERS) return;
    fetchOrders({ silent: false });
  }, [fetchOrders, scope, token]);

  useEffect(() => {
    if (!token) return;
    if (scope !== SCOPE.ORDERS) return;
    const tick = async () => {
      if (document.visibilityState !== 'visible') return;
      if (busyId || review.open) return;
      await fetchOrders({ silent: true });
    };
    const id = window.setInterval(tick, 6000);
    return () => window.clearInterval(id);
  }, [busyId, fetchOrders, review.open, scope, token]);

  const fetchBookings = useCallback(
    async ({ silent } = {}) => {
      if (!token) return;
      if (!silent) setBookingLoading(true);
      setBookingError('');
      try {
        const res = await listMyBookings({ token });
        const arr = Array.isArray(res?.items) ? res.items : [];
        arr.sort((a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime());
        setBookingItems(arr);
      } catch (e) {
        setBookingError(String(e?.message || 'FAILED_TO_LOAD'));
        if (!silent) setBookingItems([]);
      } finally {
        if (!silent) setBookingLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (!token) return;
    if (scope !== SCOPE.BOOKINGS) return;
    fetchBookings({ silent: false });
  }, [fetchBookings, scope, token]);

  useEffect(() => {
    if (!token) return;
    if (scope !== SCOPE.BOOKINGS) return;
    const tick = async () => {
      if (document.visibilityState !== 'visible') return;
      if (busyId) return;
      await fetchBookings({ silent: true });
    };
    const id = window.setInterval(tick, 6000);
    return () => window.clearInterval(id);
  }, [busyId, fetchBookings, scope, token]);

  const bookingDateFiltered = useMemo(() => {
    const day = String(bookingDay || '').trim();
    const base = Array.isArray(bookingItems) ? bookingItems : [];
    if (!day) return base;
    return base.filter((b) => {
      const src = b?.timeSlot || b?.createdAt || b?.updatedAt || null;
      return toLocalDateKey(src) === day;
    });
  }, [bookingDay, bookingItems]);

  const bookingCounts = useMemo(() => {
    const c = Object.fromEntries(BOOKING_TAB_LIST.map((t) => [t.key, 0]));
    for (const b of bookingDateFiltered) {
      const s = String(b?.status || '').trim().toLowerCase();
      c[BOOKING_TAB.ALL] = (c[BOOKING_TAB.ALL] || 0) + 1;
      if (s === 'pending') c[BOOKING_TAB.PENDING] = (c[BOOKING_TAB.PENDING] || 0) + 1;
      else if (s === 'quoted') c[BOOKING_TAB.QUOTED] = (c[BOOKING_TAB.QUOTED] || 0) + 1;
      else if (s === 'accepted') c[BOOKING_TAB.ACCEPTED] = (c[BOOKING_TAB.ACCEPTED] || 0) + 1;
      else if (s === 'in_progress') c[BOOKING_TAB.IN_PROGRESS] = (c[BOOKING_TAB.IN_PROGRESS] || 0) + 1;
      else if (s === 'completed') c[BOOKING_TAB.COMPLETED] = (c[BOOKING_TAB.COMPLETED] || 0) + 1;
      else if (s === 'cancelled' || s === 'rejected' || s === 'expired') c[BOOKING_TAB.CLOSED] = (c[BOOKING_TAB.CLOSED] || 0) + 1;
    }
    return c;
  }, [bookingDateFiltered]);

  const bookingFiltered = useMemo(() => {
    const tab = BOOKING_TAB_LIST.find((x) => x.key === bookingTab) || BOOKING_TAB_LIST[0];
    const statuses = tab?.statuses;
    if (!statuses) return bookingDateFiltered;
    const set = new Set(statuses);
    return bookingDateFiltered.filter((b) => set.has(String(b?.status || '').trim().toLowerCase()));
  }, [bookingDateFiltered, bookingTab]);

  const onConfirmBooking = async (id) => {
    if (!token) return;
    const bid = String(id || '').trim();
    if (!bid || busyId) return;
    setBusyId(bid);
    try {
      const res = await confirmMyBooking({ token, id: bid });
      setBookingItems((prev) => {
        const arr = Array.isArray(prev) ? prev.slice() : [];
        const idx = arr.findIndex((x) => String(x?._id || '') === bid);
        if (idx >= 0) arr[idx] = res?.item ? res.item : { ...arr[idx], status: 'accepted' };
        arr.sort((a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime());
        return arr;
      });
      setBookingTab(BOOKING_TAB.ACCEPTED);
    } catch (e) {
      setBookingError(String(e?.message || 'FAILED_TO_CONFIRM'));
    } finally {
      setBusyId('');
    }
  };

  const onRejectBooking = async (id) => {
    if (!token) return;
    const bid = String(id || '').trim();
    if (!bid || busyId) return;
    setBusyId(bid);
    try {
      const res = await rejectMyBooking({ token, id: bid, reason: '' });
      setBookingItems((prev) => {
        const arr = Array.isArray(prev) ? prev.slice() : [];
        const idx = arr.findIndex((x) => String(x?._id || '') === bid);
        if (idx >= 0) arr[idx] = res?.item ? res.item : { ...arr[idx], status: 'cancelled' };
        arr.sort((a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime());
        return arr;
      });
      setBookingTab(BOOKING_TAB.CLOSED);
    } catch (e) {
      setBookingError(String(e?.message || 'FAILED_TO_REJECT'));
    } finally {
      setBusyId('');
    }
  };

  const counts = useMemo(() => {
    const c = Object.fromEntries(TAB_LIST.map((t) => [t.key, 0]));
    for (const o of Array.isArray(items) ? items : []) {
      const s = String(o?.status || '').trim();
      c[TAB.ALL] = (c[TAB.ALL] || 0) + 1;
      if (s === 'REQUESTED') c[TAB.REQUESTED] = (c[TAB.REQUESTED] || 0) + 1;
      else if (s === 'QUOTED') c[TAB.QUOTED] = (c[TAB.QUOTED] || 0) + 1;
      else if (s === 'CONFIRMED' || s === 'IN_PROGRESS') c[TAB.IN_PROGRESS] = (c[TAB.IN_PROGRESS] || 0) + 1;
      else if (s === 'COMPLETED') c[TAB.COMPLETED] = (c[TAB.COMPLETED] || 0) + 1;
      else if (s === 'CANCELLED' || s === 'REJECTED') c[TAB.CLOSED] = (c[TAB.CLOSED] || 0) + 1;
    }
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    const tab = TAB_LIST.find((x) => x.key === activeTab) || TAB_LIST[0];
    const statuses = tab?.statuses;
    if (!statuses) return items;
    const set = new Set(statuses);
    return (Array.isArray(items) ? items : []).filter((o) => set.has(String(o?.status || '').trim()));
  }, [activeTab, items]);

  const hasMore = useMemo(() => {
    if (loading || loadingMore || error) return false;
    return Array.isArray(items) && items.length === limit && limit < 50;
  }, [error, items, limit, loading, loadingMore]);

  useEffect(() => {
    if (!hasMore) return;
    const el = loadMoreRef.current;
    if (!el) return;
    let ticking = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (ticking) return;
        const hit = entries.some((e) => e.isIntersecting);
        if (!hit) return;
        ticking = true;
        setLimit((v) => Math.min(50, Math.max(10, Number(v) || 20) + 10));
        window.setTimeout(() => {
          ticking = false;
        }, 250);
      },
      { root: null, rootMargin: '240px', threshold: 0.01 }
    );
    io.observe(el);
    return () => {
      try {
        io.disconnect();
      } catch {}
    };
  }, [hasMore]);

  const onConfirm = async (id) => {
    if (!token) return;
    const oid = String(id || '').trim();
    if (!oid || busyId) return;
    setBusyId(oid);
    try {
      await confirmMyOrder({ token, id: oid });
      setItems((prev) => {
        const arr = Array.isArray(prev) ? prev.slice() : [];
        const idx = arr.findIndex((x) => String(x?._id || '') === oid);
        if (idx >= 0) arr[idx] = { ...arr[idx], status: 'CONFIRMED', updatedAt: new Date().toISOString() };
        arr.sort((a, b) => new Date(b?.updatedAt || b?.createdAt || 0).getTime() - new Date(a?.updatedAt || a?.createdAt || 0).getTime());
        return arr;
      });
      setActiveTab(TAB.IN_PROGRESS);
      flashOnce(oid);
    } catch (e) {
      setError(String(e?.message || 'FAILED_TO_CONFIRM'));
    } finally {
      setBusyId('');
    }
  };

  const onReject = async (id) => {
    if (!token) return;
    const oid = String(id || '').trim();
    if (!oid || busyId) return;
    setBusyId(oid);
    try {
      await rejectMyOrder({ token, id: oid });
      setItems((prev) => {
        const arr = Array.isArray(prev) ? prev.slice() : [];
        const idx = arr.findIndex((x) => String(x?._id || '') === oid);
        if (idx >= 0) arr[idx] = { ...arr[idx], status: 'REJECTED', updatedAt: new Date().toISOString() };
        arr.sort((a, b) => new Date(b?.updatedAt || b?.createdAt || 0).getTime() - new Date(a?.updatedAt || a?.createdAt || 0).getTime());
        return arr;
      });
      setActiveTab(TAB.CLOSED);
      flashOnce(oid);
    } catch (e) {
      setError(String(e?.message || 'FAILED_TO_REJECT'));
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-black/30 p-6 backdrop-blur-xl">
        <div className="text-xs font-semibold tracking-[0.22em] text-sky-300/90">{t('orders_title')}</div>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-zinc-50 sm:text-3xl">Yêu cầu lắp đặt</h1>
        <div className="mt-1 text-sm text-zinc-400">Theo dõi trạng thái, xem báo giá và xác nhận thi công.</div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="flex items-center gap-3">
          <div className="text-xs font-semibold text-zinc-400">Chọn ngày</div>
          <input
            type="date"
            value={bookingDay}
            onChange={(e) => setBookingDay(String(e.target.value || '').trim())}
            className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm font-semibold text-zinc-100 outline-none focus:border-sky-400/40"
          />
        </div>
        <div className="flex items-center gap-2">
          <InkButton
            onClick={() => setBookingDay(todayKey())}
            className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-zinc-200 hover:bg-white/10"
          >
            Hôm nay
          </InkButton>
          <InkButton
            onClick={() => setBookingDay('')}
            className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-zinc-200 hover:bg-white/10"
          >
            Tất cả ngày
          </InkButton>
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-zinc-200">
            {bookingFiltered.length} mục
          </div>
        </div>
      </div>

      <BookingTabs active={bookingTab} onChange={setBookingTab} counts={bookingCounts} />

      {bookingError ? (
        <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {t('common_error')}: {bookingError}
        </div>
      ) : null}

      {bookingLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <OrderCardSkeleton key={`bsk:${i}`} />
          ))}
        </div>
      ) : null}

      {!bookingLoading && !bookingError ? (
        <LayoutGroup>
          <AnimatePresence mode="wait">
            <motion.div
              key={bookingTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={MOTION_FAST}
            >
              {!bookingFiltered.length ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={MOTION_FAST}
                  className="rounded-3xl border border-white/10 bg-black/20 px-6 py-12 text-center"
                >
                  <motion.div
                    animate={{ y: [0, -3, 0] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                    className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/5 text-zinc-200"
                    aria-hidden="true"
                  >
                    <span className="text-xl">□</span>
                  </motion.div>
                  <div className="text-sm font-bold text-zinc-100">Chưa có yêu cầu lắp đặt nào</div>
                  <div className="mt-1 text-xs text-zinc-500">Hãy tạo yêu cầu từ trang build. Khi shop báo giá, yêu cầu sẽ hiện ở tab Xác nhận.</div>
                </motion.div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <AnimatePresence mode="popLayout">
                    {bookingFiltered.map((b, idx) => (
                      <BookingCard
                        key={String(b?._id || '')}
                        booking={b}
                        resolveAssetUrl={resolveAssetUrl}
                        onConfirm={onConfirmBooking}
                        onReject={onRejectBooking}
                        busyId={busyId}
                        index={idx}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </LayoutGroup>
      ) : null}
    </div>
  );
};

export default Orders;
