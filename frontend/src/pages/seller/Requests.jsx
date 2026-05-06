import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { acceptVendorBooking, listVendorBookings, rejectVendorBooking, rescheduleVendorBooking, updateVendorBookingStatus } from '../../services/api/bookings.js';
import { getCars } from '../../services/api/cars.js';
import { useAuth } from '../../services/auth/AuthContext.jsx';
import { useI18n } from '../../services/i18n.jsx';
import ChatThreadModal from '../../components/ChatThreadModal.jsx';
import CarViewer from '../../threejs/CarViewer.jsx';

const cx = (...arr) => arr.filter(Boolean).join(' ');

const normKey = (v) =>
  String(v || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const parseIso = (s) => {
  const d = s ? new Date(s) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  return d;
};

const msToClock = (ms) => {
  const v = Math.max(0, Math.floor(ms / 1000));
  const m = String(Math.floor(v / 60)).padStart(2, '0');
  const s = String(v % 60).padStart(2, '0');
  return `${m}:${s}`;
};

const formatVnd = ({ value, locale }) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${new Intl.NumberFormat(locale || 'vi-VN', { maximumFractionDigits: 0 }).format(n)} ₫`;
};

const translateLegalWarningVi = (warning) => {
  const w = String(warning || '').trim();
  if (!w) return '';
  if (w === 'Exhaust modifications may violate local noise and emissions regulations.') {
    return 'Cảnh báo (VN): Độ pô/ống xả có thể vượt ngưỡng tiếng ồn/khí thải. Nên ưu tiên pô zin hoặc pô có tiêu âm (DB killer). (Tham khảo: NĐ 100/2019/NĐ-CP, NĐ 123/2021/NĐ-CP)';
  }
  if (w === 'Lighting modifications must comply with local road safety regulations.') {
    return 'Cảnh báo (VN): Độ đèn cần đúng màu, không gây chói/lóa và không lắp sai quy định khi tham gia giao thông. (Tham khảo: NĐ 100/2019/NĐ-CP, NĐ 123/2021/NĐ-CP)';
  }
  if (w === 'Body kit changes may require inspection or registration updates in some areas.') {
    return 'Cảnh báo (VN): Thay đổi ốp/ngoại hình không được làm thay đổi kết cấu xe hoặc che khuất biển số/đèn/xi-nhan; thay đổi ảnh hưởng kết cấu có thể bị xử phạt. (Tham khảo: NĐ 100/2019/NĐ-CP, NĐ 123/2021/NĐ-CP)';
  }
  if (w === 'Wheel/tire changes should match vehicle load rating and fitment requirements.') {
    return 'Cảnh báo (VN): Thay mâm/lốp cần đúng thông số, đúng tải trọng và không cạ; thay đổi sai có thể gây mất an toàn và có nguy cơ bị xử lý. (Tham khảo: NĐ 100/2019/NĐ-CP, NĐ 123/2021/NĐ-CP)';
  }
  return w;
};

const Badge = ({ tone, children }) => {
  const cls =
    tone === 'green'
      ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200'
      : tone === 'red'
        ? 'border-rose-500/25 bg-rose-500/10 text-rose-200'
        : tone === 'orange'
          ? 'border-amber-500/25 bg-amber-500/10 text-amber-200'
          : 'border-white/10 bg-white/5 text-zinc-200';
  return <span className={cx('inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold', cls)}>{children}</span>;
};

const BookingModelPreview = memo(({ modelUrl, color }) => {
  const holderRef = useRef(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!modelUrl) return;
    const el = holderRef.current;
    if (!el) return;
    let alive = true;
    const io = new IntersectionObserver(
      (entries) => {
        if (!alive) return;
        const hit = entries.some((e) => e.isIntersecting);
        if (hit) setActive(true);
      },
      { root: null, rootMargin: '120px', threshold: 0.01 }
    );
    io.observe(el);
    return () => {
      alive = false;
      try {
        io.disconnect();
      } catch {}
    };
  }, [modelUrl]);

  return (
    <div ref={holderRef} className="relative h-full w-full">
      {active && modelUrl ? (
        <CarViewer
          className="h-full w-full rounded-none border-0 bg-transparent"
          carModelUrl={modelUrl}
          color={color}
          slots={[]}
          accessoryColors={{}}
          initialCamera={null}
          background="transparent"
          viewerMode="preview"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-white/5 to-black/20">
          <div className="text-[11px] font-semibold tracking-wide text-white/60">3D</div>
        </div>
      )}
    </div>
  );
});

const Requests = () => {
  const { token } = useAuth();
  const { lang, t } = useI18n();
  const locale = String(lang || '').trim().toLowerCase() === 'en' ? 'en-US' : 'vi-VN';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [now, setNow] = useState(Date.now());
  const [viewStatus, setViewStatus] = useState('pending');
  const [quoteDraft, setQuoteDraft] = useState({});
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectId, setRejectId] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleMode, setRescheduleMode] = useState('accept');
  const [rescheduleId, setRescheduleId] = useState('');
  const [rescheduleValue, setRescheduleValue] = useState('');
  const [rescheduleSuggestedQuote, setRescheduleSuggestedQuote] = useState(null);
  const [rescheduleError, setRescheduleError] = useState('');
  const [toast, setToast] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatUserId, setChatUserId] = useState('');
  const prevPendingIds = useRef(new Set());

  const [cars, setCars] = useState([]);
  useEffect(() => {
    let alive = true;
    getCars()
      .then((list) => {
        if (!alive) return;
        setCars(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!alive) return;
        setCars([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const modelUrlByCarKey = useMemo(() => {
    const map = new Map();
    for (const c of Array.isArray(cars) ? cars : []) {
      const name = String(c?.name || '').trim();
      const key = normKey(name);
      const url = String(c?.model3d || c?.modelUrl || '').trim();
      if (key && url) map.set(key, url);
    }
    return map;
  }, [cars]);

  useEffect(() => {
    if (viewStatus !== 'pending') return;
    setNow(Date.now());
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, [viewStatus]);

  useEffect(() => {
    if (!token) return;
    let alive = true;

    const load = async ({ silent } = {}) => {
      if (!silent) setLoading(true);
      try {
        const res =
          viewStatus === 'closed'
            ? await Promise.all([
                listVendorBookings({ token, status: 'rejected' }),
                listVendorBookings({ token, status: 'expired' }),
                listVendorBookings({ token, status: 'cancelled' })
              ]).then((arr) => {
                const a = Array.isArray(arr?.[0]?.items) ? arr[0].items : [];
                const b = Array.isArray(arr?.[1]?.items) ? arr[1].items : [];
                const c = Array.isArray(arr?.[2]?.items) ? arr[2].items : [];
                const map = new Map();
                for (const it of [...a, ...b, ...c]) map.set(String(it?._id || ''), it);
                return { items: Array.from(map.values()) };
              })
            : await listVendorBookings({ token, status: viewStatus });
        if (!alive) return;
        const next = Array.isArray(res?.items) ? res.items : [];
        setItems(next);
        setError('');
        if (viewStatus === 'pending') {
          const ids = new Set(next.map((x) => String(x?._id || '')).filter(Boolean));
          if (prevPendingIds.current.size && ids.size > prevPendingIds.current.size) {
            setToast(t('seller_toast_new_request'));
            window.setTimeout(() => setToast(''), 4000);
          }
          prevPendingIds.current = ids;
        }
      } catch (e) {
        if (!alive) return;
        setItems([]);
        setError(e?.message || 'REQUEST_FAILED');
      } finally {
        if (!alive) return;
        if (!silent) setLoading(false);
      }
    };

    load({ silent: false });
    const poll = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      load({ silent: true });
    }, 8000);
    return () => {
      alive = false;
      window.clearInterval(poll);
    };
  }, [token, viewStatus]);

  const sorted = useMemo(() => {
    const arr = Array.isArray(items) ? items.slice() : [];
    arr.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    return arr;
  }, [items]);

  const statusLabel = (status) => {
    const s = String(status || '').trim().toLowerCase();
    if (s === 'pending') return t('seller_status_pending');
    if (s === 'quoted') return t('seller_status_quoted');
    if (s === 'accepted') return t('seller_status_accepted');
    if (s === 'in_progress') return t('seller_status_in_progress');
    if (s === 'completed') return t('seller_status_completed');
    if (s === 'rejected') return t('seller_status_rejected');
    if (s === 'cancelled') return t('seller_status_cancelled');
    if (s === 'expired') return t('seller_status_expired');
    return String(status || '');
  };

  const digitsOnly = (s) => String(s || '').replace(/[^\d]/g, '');
  const parseMoney = (s) => {
    const d = digitsOnly(s);
    if (!d) return null;
    const n = Number(d);
    if (!Number.isFinite(n)) return null;
    return n;
  };

  const onAccept = async (id, { quotedPrice, quoteNote } = {}) => {
    const bid = String(id || '').trim();
    if (!bid || busyId) return;
    setBusyId(bid);
    try {
      await acceptVendorBooking({ token, id: bid, quotedPrice, quoteNote });
      setToast(t('seller_toast_request_accepted'));
      window.setTimeout(() => setToast(''), 4000);
      setItems((prev) => (Array.isArray(prev) ? prev.filter((x) => String(x?._id || '') !== bid) : []));
    } finally {
      setBusyId('');
    }
  };

  const toDatetimeLocal = (d) => {
    const dt = d instanceof Date ? d : d ? new Date(d) : null;
    if (!dt || Number.isNaN(dt.getTime())) return '';
    const yyyy = String(dt.getFullYear());
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    const hh = String(dt.getHours()).padStart(2, '0');
    const mi = String(dt.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  };

  const openReschedule = ({ booking, mode }) => {
    const id = String(booking?._id || '').trim();
    if (!id || busyId) return;
    setRescheduleMode(mode === 'reschedule' ? 'reschedule' : 'accept');
    setRescheduleId(id);
    setRescheduleValue(toDatetimeLocal(booking?.timeSlot));
    setRescheduleSuggestedQuote(booking?.quotedPrice ?? booking?.snapshot?.estimatedPrice ?? booking?.snapshot?.totalPrice ?? null);
    setRescheduleError('');
    setRescheduleOpen(true);
  };

  const submitReschedule = async () => {
    if (!token) return;
    const id = String(rescheduleId || '').trim();
    if (!id || busyId) return;
    const raw = String(rescheduleValue || '').trim();
    if (!raw) {
      setRescheduleError('Vui lòng chọn ngày/giờ.');
      return;
    }
    const dt = new Date(raw);
    if (Number.isNaN(dt.getTime())) {
      setRescheduleError('Ngày/giờ không hợp lệ.');
      return;
    }
    if (dt.getTime() < Date.now()) {
      setRescheduleError('Vui lòng chọn thời gian từ hiện tại trở đi.');
      return;
    }

    setBusyId(id);
    setRescheduleError('');
    try {
      const iso = dt.toISOString();
      if (rescheduleMode === 'reschedule') {
        await rescheduleVendorBooking({ token, id, timeSlot: iso });
        setItems((prev) =>
          Array.isArray(prev) ? prev.map((x) => (String(x?._id || '') === id ? { ...x, timeSlot: iso } : x)) : []
        );
        setToast('Đã dời lịch thi công.');
      } else {
        const fromInput = parseMoney(quoteDraft?.[id]?.price ?? '');
        const fallback = Number.isFinite(Number(rescheduleSuggestedQuote)) ? Math.round(Number(rescheduleSuggestedQuote)) : null;
        const q = fromInput ?? fallback;
        if (q === null) {
          setRescheduleError(t('seller_requests_quote_required'));
          return;
        }
        await acceptVendorBooking({ token, id, timeSlot: iso, quotedPrice: q });
        setItems((prev) => (Array.isArray(prev) ? prev.filter((x) => String(x?._id || '') !== id) : []));
        setToast('Đã nhận và dời lịch.');
      }
      window.setTimeout(() => setToast(''), 3500);
      setRescheduleOpen(false);
      setRescheduleId('');
      setRescheduleValue('');
      setRescheduleSuggestedQuote(null);
    } catch (e) {
      const msg = String(e?.message || e?.data?.error || 'REQUEST_FAILED');
      if (msg === 'TIME_IN_PAST') setRescheduleError('Vui lòng chọn thời gian từ hiện tại trở đi.');
      else if (msg === 'EXPIRED') setRescheduleError('Yêu cầu đã hết hạn.');
      else if (msg === 'NOT_PENDING') setRescheduleError('Yêu cầu không còn ở trạng thái chờ.');
      else if (msg === 'INVALID_STATUS') setRescheduleError('Chỉ có thể dời lịch khi lịch hẹn đang ở trạng thái đã nhận.');
      else setRescheduleError(msg);
    } finally {
      setBusyId('');
    }
  };

  const onReject = async ({ id, reason }) => {
    const bid = String(id || '').trim();
    if (!bid || busyId) return;
    setBusyId(bid);
    try {
      await rejectVendorBooking({ token, id: bid, reason });
      setToast(t('seller_toast_request_rejected'));
      window.setTimeout(() => setToast(''), 3000);
      setItems((prev) => (Array.isArray(prev) ? prev.filter((x) => String(x?._id || '') !== bid) : []));
    } finally {
      setBusyId('');
    }
  };

  const onUpdateStatus = async ({ id, status }) => {
    const bid = String(id || '').trim();
    const next = String(status || '').trim();
    if (!bid || busyId) return;
    setBusyId(bid);
    try {
      await updateVendorBookingStatus({ token, id: bid, status: next });
      setToast(next === 'in_progress' ? t('seller_toast_job_started') : t('seller_toast_job_completed'));
      window.setTimeout(() => setToast(''), 3000);
      setItems((prev) => (Array.isArray(prev) ? prev.map((x) => (String(x?._id || '') === bid ? { ...x, status: next } : x)) : []));
    } finally {
      setBusyId('');
    }
  };

  const openChat = (booking) => {
    const raw = booking?.user?._id || booking?.userId?._id || booking?.userId || '';
    const uid = String(raw || '').trim();
    if (!uid) {
      setToast('Không tìm thấy khách hàng để chat.');
      window.setTimeout(() => setToast(''), 2500);
      return;
    }
    setChatUserId(uid);
    setChatOpen(true);
  };

  const Segment = ({ k, label }) => (
    <button
      type="button"
      onClick={() => setViewStatus(k)}
      className={cx(
        'rounded-2xl px-3 py-2 text-sm font-bold transition',
        viewStatus === k ? 'bg-white text-zinc-950' : 'border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10'
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-zinc-800/70 bg-zinc-950/50 p-6 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-zinc-50">{t('seller_requests_page_title')}</div>
            <div className="mt-1 text-xs text-zinc-400">{t('seller_requests_page_desc')}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Segment k="pending" label={t('seller_status_pending')} />
            <Segment k="quoted" label={t('seller_status_quoted')} />
            <Segment k="accepted" label={t('seller_status_accepted')} />
            <Segment k="in_progress" label={t('seller_status_in_progress')} />
            <Segment k="completed" label={t('seller_status_completed')} />
            <Segment k="closed" label={t('seller_status_closed')} />
          </div>
        </div>
      </div>

      {toast ? (
        <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm font-semibold text-sky-100">{toast}</div>
      ) : null}

      {loading ? <div className="text-sm text-zinc-500">{t('common_loading')}</div> : null}
      {error ? <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}

      {!loading && !error && !sorted.length ? (
        <div className="rounded-3xl border border-zinc-800/70 bg-zinc-950/50 p-6 text-sm text-zinc-300 backdrop-blur-xl">
          {t('seller_requests_empty_status')}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {sorted.map((b) => {
          const bid = String(b?._id || '').trim();
          const expiresAt = parseIso(b?.expiresAt);
          const remaining = expiresAt ? expiresAt.getTime() - now : 0;
          const snapshot = b?.snapshot || {};
          const warnings = Array.isArray(snapshot?.legalWarnings) ? snapshot.legalWarnings : [];
          const legal = String(snapshot?.legalStatus || '').toLowerCase();
          const legalTone = legal === 'ok' ? 'green' : legal === 'illegal' ? 'red' : legal ? 'orange' : 'gray';
          const timeSlotLabel = b?.timeSlot ? new Date(b.timeSlot).toLocaleString(locale) : '';
          const isBusy = busyId === bid;
          const isExpired = viewStatus === 'pending' && remaining <= 0;
          const urgent = viewStatus === 'pending' && remaining > 0 && remaining <= 2 * 60 * 1000;
          const parts = Array.isArray(snapshot?.parts) ? snapshot.parts : [];
          const carLabel = String(snapshot?.bikeName || snapshot?.carName || '').trim();
          const modelUrl = modelUrlByCarKey.get(normKey(carLabel)) || '';
          const color = String(snapshot?.color || '').trim();
          const brands = Array.from(
            new Set(
              parts
                .map((p) => String(p?.brand || p?.brandName || p?.manufacturer || '').trim())
                .filter(Boolean)
                .slice(0, 12)
            )
          );
          const chatRaw = b?.user?._id || b?.userId?._id || b?.userId || '';
          const chatUid = String(chatRaw || '').trim();
          const suggestedQuote = b?.quotedPrice ?? snapshot?.estimatedPrice ?? snapshot?.totalPrice;
          const hasDraft = Object.prototype.hasOwnProperty.call(quoteDraft || {}, bid);
          const quotePriceInput = hasDraft ? String(quoteDraft?.[bid]?.price ?? '') : Number.isFinite(Number(suggestedQuote)) ? String(Math.round(Number(suggestedQuote))) : '';

          return (
            <div
              key={bid}
              className={cx(
                'overflow-hidden rounded-3xl border bg-zinc-950/50 backdrop-blur-xl',
                urgent ? 'border-amber-400/35 shadow-[0_0_0_1px_rgba(251,191,36,0.12)]' : 'border-zinc-800/70'
              )}
            >
              <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-zinc-100">
                    {snapshot?.bikeName || snapshot?.buildName || snapshot?.carName || t('seller_requests_build_fallback')}
                  </div>
                  <div className="mt-1 text-xs text-zinc-400">
                    <button
                      type="button"
                      disabled={!chatUid || isBusy}
                      onClick={() => openChat(b)}
                      className="font-semibold text-zinc-200 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
                      title="Mở chat"
                    >
                      {String(snapshot?.customerName || '').trim() ||
                        b?.user?.name ||
                        b?.user?.email ||
                        t('seller_requests_customer_fallback')}
                    </button>{' '}
                    • {t('seller_requests_slot_label')}: {timeSlotLabel || '—'}
                  </div>
                  {snapshot?.customerPhone || snapshot?.customerCity ? (
                    <div className="mt-1 text-[11px] text-zinc-500">
                      {snapshot?.customerPhone ? `SĐT: ${String(snapshot.customerPhone)}` : ''}
                      {snapshot?.customerPhone && snapshot?.customerCity ? ' • ' : ''}
                      {snapshot?.customerCity ? `Tỉnh/TP: ${String(snapshot.customerCity)}` : ''}
                    </div>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  {viewStatus === 'pending' ? (
                    <div className={cx('text-xs font-semibold', urgent ? 'text-amber-200' : 'text-zinc-200')}>
                      {t('seller_requests_remaining_prefix')}: {msToClock(remaining)}
                    </div>
                  ) : null}
                  <div className="mt-1 flex justify-end gap-2">
                    <Badge tone={legalTone}>
                      {t('seller_requests_legal_prefix')}: {String(snapshot?.legalStatus || 'review').toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-3 px-5 py-4">
                <div className="flex items-start gap-4">
                  <div className="h-20 w-28 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                    {modelUrl ? (
                      <BookingModelPreview modelUrl={modelUrl} color={color} />
                    ) : snapshot?.previewImageUrl ? (
                      <img alt="" src={snapshot.previewImageUrl} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-zinc-400">{t('seller_requests_parts_brands_title')}</div>
                    {brands.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {brands.map((name) => (
                          <div key={name} className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-semibold text-zinc-200">
                            {name}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-1 text-sm text-zinc-300">—</div>
                    )}
                    <div className="mt-3 flex items-center justify-between text-sm font-semibold text-zinc-100">
                      <div>{t('seller_requests_estimated_price')}</div>
                      <div>{formatVnd({ value: snapshot?.estimatedPrice ?? snapshot?.totalPrice, locale })}</div>
                    </div>
                  </div>
                </div>

                {warnings.length ? (
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                    <div className="text-xs font-semibold text-amber-100/80">{t('seller_requests_warnings_label')}</div>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      {warnings
                        .map((w) => translateLegalWarningVi(w))
                        .filter(Boolean)
                        .slice(0, 3)
                        .map((w) => (
                          <li key={w}>{w}</li>
                        ))}
                    </ul>
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs font-semibold text-zinc-500">
                    {t('seller_requests_status_prefix')}: {statusLabel(b?.status || viewStatus)}
                  </div>
                  {String(b?.status || '') === 'rejected' && String(b?.rejectedReason || '').trim() ? (
                    <div className="text-xs font-semibold text-rose-200">{String(b.rejectedReason).trim()}</div>
                  ) : String(b?.status || '') === 'cancelled' && String(b?.cancelReason || '').trim() ? (
                    <div className="text-xs font-semibold text-rose-200">{String(b.cancelReason).trim()}</div>
                  ) : String(b?.status || '') === 'expired' ? (
                    <div className="text-xs font-semibold text-zinc-400">Hết hạn</div>
                  ) : null}
                  <div className="flex items-center gap-2">
                    {viewStatus === 'pending' ? (
                      <>
                        <button
                          type="button"
                          disabled={isBusy || isExpired}
                          onClick={() => openReschedule({ booking: b, mode: 'accept' })}
                          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-zinc-100 hover:bg-white/10 disabled:opacity-60"
                        >
                          Dời lịch
                        </button>
                        <button
                          type="button"
                          disabled={isBusy || isExpired}
                          onClick={() => {
                            setRejectId(String(b?._id || ''));
                            setRejectReason('');
                            setRejectOpen(true);
                          }}
                          className="rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-2 text-sm font-bold text-rose-100 hover:bg-rose-500/15 disabled:opacity-60"
                        >
                          {t('seller_requests_reject')}
                        </button>
                        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                          <div className="text-[11px] font-semibold text-zinc-400">{t('seller_requests_quote_label')}</div>
                          <input
                            value={quotePriceInput}
                            disabled={isBusy || isExpired}
                            onChange={(e) => {
                              const v = digitsOnly(e.target.value).slice(0, 14);
                              setQuoteDraft((prev) => ({ ...(prev || {}), [bid]: { ...(prev?.[bid] || {}), price: v } }));
                            }}
                            placeholder={t('seller_requests_quote_placeholder')}
                            inputMode="numeric"
                            className="w-28 bg-transparent text-sm font-bold text-zinc-100 outline-none placeholder:text-zinc-600 disabled:opacity-60"
                          />
                          <div className="text-[11px] font-semibold text-zinc-500">₫</div>
                        </div>
                        <button
                          type="button"
                          disabled={isBusy || isExpired}
                          onClick={() => {
                            const fromInput = parseMoney(quotePriceInput);
                            const fallback = Number.isFinite(Number(suggestedQuote)) ? Math.round(Number(suggestedQuote)) : null;
                            const q = fromInput ?? fallback;
                            if (q === null) {
                              setToast(t('seller_requests_quote_required'));
                              window.setTimeout(() => setToast(''), 2500);
                              return;
                            }
                            onAccept(bid, { quotedPrice: q });
                          }}
                          className="rounded-2xl bg-emerald-400 px-4 py-2 text-sm font-bold text-zinc-950 hover:bg-emerald-300 disabled:opacity-60"
                        >
                          {t('seller_requests_quote_action')}
                        </button>
                      </>
                    ) : viewStatus === 'accepted' ? (
                      <>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => openReschedule({ booking: b, mode: 'reschedule' })}
                          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-zinc-100 hover:bg-white/10 disabled:opacity-60"
                        >
                          Dời lịch
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => onUpdateStatus({ id: b._id, status: 'in_progress' })}
                          className="rounded-2xl bg-sky-400 px-4 py-2 text-sm font-bold text-zinc-950 hover:bg-sky-300 disabled:opacity-60"
                        >
                          {t('seller_action_start')}
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => onUpdateStatus({ id: b._id, status: 'completed' })}
                          className="rounded-2xl bg-emerald-400 px-4 py-2 text-sm font-bold text-zinc-950 hover:bg-emerald-300 disabled:opacity-60"
                        >
                          {t('seller_action_complete')}
                        </button>
                      </>
                    ) : viewStatus === 'in_progress' ? (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onUpdateStatus({ id: b._id, status: 'completed' })}
                        className="rounded-2xl bg-emerald-400 px-4 py-2 text-sm font-bold text-zinc-950 hover:bg-emerald-300 disabled:opacity-60"
                      >
                        {t('seller_action_complete')}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <ChatThreadModal
        open={chatOpen}
        onClose={() => {
          setChatOpen(false);
          setChatUserId('');
        }}
        mode="vendor"
        userId={chatUserId}
      />

      {rejectOpen ? (
        <div className="fixed inset-0 z-[80]">
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => {
              if (busyId) return;
              setRejectOpen(false);
              setRejectId('');
              setRejectReason('');
            }}
            aria-label={t('seller_common_close')}
            disabled={Boolean(busyId)}
          />
          <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-[560px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/90 shadow-2xl shadow-black/50 backdrop-blur-2xl">
            <div className="border-b border-white/10 px-5 py-4">
              <div className="text-sm font-bold text-zinc-50">{t('seller_reject_title')}</div>
              <div className="mt-1 text-xs text-zinc-400">{t('seller_reject_desc')}</div>
            </div>
            <div className="p-5">
              <label className="space-y-2">
                <div className="text-xs font-semibold text-zinc-300">{t('seller_reject_reason_label')}</div>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder={t('seller_reject_reason_placeholder')}
                  rows={4}
                  className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-rose-400/30"
                />
              </label>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (busyId) return;
                    setRejectOpen(false);
                    setRejectId('');
                    setRejectReason('');
                  }}
                  disabled={Boolean(busyId)}
                  className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-zinc-200 hover:bg-white/10 disabled:opacity-60"
                >
                  {t('common_back')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const rid = String(rejectId || '').trim();
                    const reason = String(rejectReason || '').trim();
                    if (!rid || busyId) return;
                    if (reason.length < 3) {
                      setToast(t('seller_reject_reason_required'));
                      window.setTimeout(() => setToast(''), 3000);
                      return;
                    }
                    setRejectOpen(false);
                    onReject({ id: rid, reason });
                    setRejectId('');
                    setRejectReason('');
                  }}
                  disabled={Boolean(busyId)}
                  className="inline-flex items-center justify-center rounded-2xl bg-rose-500 px-4 py-2 text-sm font-black text-white hover:bg-rose-400 disabled:opacity-60"
                >
                  {t('seller_reject_submit')}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {rescheduleOpen ? (
        <div className="fixed inset-0 z-[80]">
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => {
              if (busyId) return;
              setRescheduleOpen(false);
              setRescheduleId('');
              setRescheduleValue('');
              setRescheduleSuggestedQuote(null);
              setRescheduleError('');
            }}
            aria-label={t('seller_common_close')}
            disabled={Boolean(busyId)}
          />
          <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-[560px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/90 shadow-2xl shadow-black/50 backdrop-blur-2xl">
            <div className="border-b border-white/10 px-5 py-4">
              <div className="text-sm font-bold text-zinc-50">{rescheduleMode === 'reschedule' ? 'Dời ngày thi công' : 'Dời lịch & chấp nhận'}</div>
              <div className="mt-1 text-xs text-zinc-400">
                {rescheduleMode === 'reschedule'
                  ? 'Chọn ngày/giờ mới. Hệ thống sẽ gửi email thông báo cho khách.'
                  : 'Chọn ngày/giờ mới rồi chấp nhận yêu cầu. Khách sẽ nhận email với lịch mới.'}
              </div>
            </div>
            <div className="p-5">
              {rescheduleError ? (
                <div className="mb-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{rescheduleError}</div>
              ) : null}
              <label className="space-y-2">
                <div className="text-xs font-semibold text-zinc-300">Ngày/giờ</div>
                <input
                  type="datetime-local"
                  value={rescheduleValue}
                  onChange={(e) => setRescheduleValue(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-sky-400/30"
                  disabled={Boolean(busyId)}
                />
              </label>
              {rescheduleMode !== 'reschedule' ? (
                <div className="mt-4">
                  <label className="space-y-2">
                    <div className="text-xs font-semibold text-zinc-300">{t('seller_requests_quote_label')}</div>
                    <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                      <input
                        value={
                          Object.prototype.hasOwnProperty.call(quoteDraft || {}, String(rescheduleId || ''))
                            ? String(quoteDraft?.[String(rescheduleId || '')]?.price ?? '')
                            : Number.isFinite(Number(rescheduleSuggestedQuote))
                              ? String(Math.round(Number(rescheduleSuggestedQuote)))
                              : ''
                        }
                        disabled={Boolean(busyId)}
                        onChange={(e) => {
                          const id = String(rescheduleId || '');
                          const v = digitsOnly(e.target.value).slice(0, 14);
                          setQuoteDraft((prev) => ({ ...(prev || {}), [id]: { ...(prev?.[id] || {}), price: v } }));
                        }}
                        placeholder={t('seller_requests_quote_placeholder')}
                        inputMode="numeric"
                        className="w-full bg-transparent text-sm font-bold text-zinc-100 outline-none placeholder:text-zinc-600 disabled:opacity-60"
                      />
                      <div className="text-[11px] font-semibold text-zinc-500">₫</div>
                    </div>
                  </label>
                </div>
              ) : null}
              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (busyId) return;
                    setRescheduleOpen(false);
                    setRescheduleId('');
                    setRescheduleValue('');
                    setRescheduleSuggestedQuote(null);
                    setRescheduleError('');
                  }}
                  disabled={Boolean(busyId)}
                  className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-zinc-200 hover:bg-white/10 disabled:opacity-60"
                >
                  {t('common_back')}
                </button>
                <button
                  type="button"
                  onClick={submitReschedule}
                  disabled={Boolean(busyId)}
                  className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-sky-400 to-cyan-300 px-4 py-2 text-sm font-black text-zinc-950 hover:brightness-110 disabled:opacity-60"
                >
                  {String(busyId || '') === String(rescheduleId || '') ? 'Đang lưu…' : 'Lưu'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Requests;
