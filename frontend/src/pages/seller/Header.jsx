import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../services/api/client.js';
import { useAuth } from '../../services/auth/AuthContext.jsx';
import { useI18n } from '../../services/i18n.jsx';
import ChatThreadModal from '../../components/ChatThreadModal.jsx';

const cx = (...arr) => arr.filter(Boolean).join(' ');

const fmtClock = (iso) => {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(d);
  } catch {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }
};

const Header = ({ onOpenSidebar, userName = 'Vendor', shopName = 'Seller Center' }) => {
  const nav = useNavigate();
  const { logout, token, user } = useAuth();
  const { lang, toggle, t } = useI18n();
  const [acceptingBookings, setAcceptingBookings] = useState(true);
  const [acceptingBusy, setAcceptingBusy] = useState(false);
  const [acceptingError, setAcceptingError] = useState('');
  const [acceptingToast, setAcceptingToast] = useState('');
  const [closedToday, setClosedToday] = useState(false);
  const [closedBusy, setClosedBusy] = useState(false);
  const [closedError, setClosedError] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [chatPanelOpen, setChatPanelOpen] = useState(false);
  const [chatThreads, setChatThreads] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatUserId, setChatUserId] = useState('');
  const [deletingThreadId, setDeletingThreadId] = useState('');
  const initials = useMemo(() => {
    const s = String(userName || '').trim() || 'V';
    const parts = s.split(' ').filter(Boolean);
    const a = (parts[0] || 'V')[0] || 'V';
    const b = (parts[1] || '')[0] || '';
    return `${a}${b}`.toUpperCase();
  }, [userName]);

  const canSwitchToUser = (() => {
    const role = String(user?.role || '').trim().toUpperCase();
    return role === 'VENDOR' && !user?.isAdmin;
  })();

  const switchToUserMode = () => {
    try {
      localStorage.setItem('carbanana.vendor.mode', 'user');
    } catch {}
    nav('/dashboard', { replace: true });
  };

  const fetchMyShop = async () => {
    try {
      return await apiFetch('/api/vendor/shop', { token, failoverOnNotFound: true });
    } catch (e) {
      if (String(e?.message || '') === 'NOT_FOUND') {
        return await apiFetch('/vendor/shop', { token, failoverOnNotFound: true });
      }
      throw e;
    }
  };

  const setAcceptingBookingsApi = async ({ next }) => {
    try {
      return await apiFetch('/api/vendor/shop/accepting-bookings', {
        token,
        method: 'POST',
        body: { acceptingBookings: next },
        failoverOnNotFound: true
      });
    } catch (e) {
      if (String(e?.message || '') === 'NOT_FOUND') {
        return await apiFetch('/vendor/shop/accepting-bookings', {
          token,
          method: 'POST',
          body: { acceptingBookings: next },
          failoverOnNotFound: true
        });
      }
      throw e;
    }
  };

  const formatYmdInTz = (date, tz) => {
    const dt = date instanceof Date ? date : new Date(date);
    if (!dt || Number.isNaN(dt.getTime())) return '';
    const zone = String(tz || '').trim() || 'Asia/Ho_Chi_Minh';
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(dt);
    } catch {
      const y = String(dt.getFullYear());
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const d = String(dt.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  };

  const setClosedTodayApi = async ({ next }) => {
    try {
      return await apiFetch('/api/vendor/shop/closed-today', {
        token,
        method: 'POST',
        body: { closedToday: next },
        failoverOnNotFound: true
      });
    } catch (e) {
      if (String(e?.message || '') === 'NOT_FOUND') {
        return await apiFetch('/vendor/shop/closed-today', {
          token,
          method: 'POST',
          body: { closedToday: next },
          failoverOnNotFound: true
        });
      }
      throw e;
    }
  };

  useEffect(() => {
    if (!token) return;
    let alive = true;
    fetchMyShop()
      .then((res) => {
        if (!alive) return;
        const item = res?.item || null;
        setVendorId(String(item?._id || '').trim());
        setAcceptingBookings(item?.bookingPreferences?.acceptingBookings !== false);
        const tz = String(item?.bookingPreferences?.timezone || '').trim() || 'Asia/Ho_Chi_Minh';
        const today = formatYmdInTz(new Date(), tz);
        const closedDate = String(item?.bookingPreferences?.closedDate || '').trim();
        setClosedToday(Boolean(today && closedDate && closedDate === today));
        setAcceptingError('');
        setClosedError('');
      })
      .catch((e) => {
        if (!alive) return;
        setAcceptingError(String(e?.message || 'REQUEST_FAILED'));
      });
    return () => {
      alive = false;
    };
  }, [token]);

  useEffect(() => {
    if (!acceptingToast) return;
    const tm = window.setTimeout(() => setAcceptingToast(''), 2200);
    return () => window.clearTimeout(tm);
  }, [acceptingToast]);

  const markChatSeen = () => {
    const vid = String(vendorId || '').trim();
    if (!vid) return;
    const key = `carbanana.vendorChat.lastSeenAt.${vid}`;
    try {
      localStorage.setItem(key, String(Date.now()));
    } catch {}
  };

  useEffect(() => {
    if (!token) return;
    let alive = true;
    const load = async () => {
      try {
        setChatLoading(true);
        const res = await apiFetch('/api/vendor/chat/threads', { token, failoverOnNotFound: true });
        if (!alive) return;
        const list = Array.isArray(res?.items) ? res.items : [];
        setChatThreads(list);
        setChatError('');
      } catch (e) {
        if (!alive) return;
        setChatThreads([]);
        setChatError(String(e?.message || 'REQUEST_FAILED'));
      } finally {
        if (!alive) return;
        setChatLoading(false);
      }
    };
    load();
    const tm = window.setInterval(load, 3000);
    return () => {
      alive = false;
      window.clearInterval(tm);
    };
  }, [token]);

  useEffect(() => {
    const vid = String(vendorId || '').trim();
    if (!vid) return;
    const key = `carbanana.vendorChat.lastSeenAt.${vid}`;
    let lastSeenAt = 0;
    try {
      lastSeenAt = Number(localStorage.getItem(key) || 0) || 0;
    } catch {}

    const unread = (Array.isArray(chatThreads) ? chatThreads : []).filter((th) => {
      const lastAt = th?.lastMessageAt ? new Date(th.lastMessageAt).getTime() : 0;
      if (!lastAt) return false;
      if (lastAt <= lastSeenAt) return false;
      return String(th?.lastMessageSenderType || '').trim().toLowerCase() === 'user';
    });

    setChatUnreadCount(unread.length);
  }, [chatThreads, vendorId]);

  useEffect(() => {
    if (!chatPanelOpen) return;
    markChatSeen();
    const onKey = (e) => {
      if (e.key === 'Escape') setChatPanelOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [chatPanelOpen, vendorId]);

  const translateAcceptingError = (code) => {
    const c = String(code || '').trim();
    if (c === 'UNAUTHORIZED') return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    if (c === 'VENDOR_REQUIRED') return 'Tài khoản này chưa có quyền shop.';
    if (c === 'VENDOR_NOT_FOUND') return 'Chưa có hồ sơ shop. Vui lòng cập nhật thông tin shop trước.';
    if (c === 'INVALID_ACCEPTING') return 'Dữ liệu bật/tắt không hợp lệ.';
    if (c === 'NOT_FOUND') return 'API không tồn tại. Vui lòng khởi động lại backend hoặc kiểm tra cổng API.';
    if (!c) return 'Không bật/tắt được. Vui lòng thử lại.';
    return c;
  };

  const translateClosedError = (code) => {
    const c = String(code || '').trim();
    if (c === 'UNAUTHORIZED') return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    if (c === 'VENDOR_REQUIRED') return 'Tài khoản này chưa có quyền shop.';
    if (c === 'INVALID_CLOSED_TODAY') return 'Dữ liệu bật/tắt không hợp lệ.';
    if (c === 'NOT_FOUND') return 'API không tồn tại. Vui lòng khởi động lại backend hoặc kiểm tra cổng API.';
    if (!c) return 'Không bật/tắt được. Vui lòng thử lại.';
    return c;
  };

  const toggleAccepting = async () => {
    if (!token || acceptingBusy) return;
    setAcceptingBusy(true);
    setAcceptingError('');
    try {
      const res = await setAcceptingBookingsApi({ next: !acceptingBookings });
      const item = res?.item || null;
      const next = item?.bookingPreferences?.acceptingBookings !== false;
      setAcceptingBookings(next);
      setAcceptingToast(next ? 'Đã bật nhận khách.' : 'Đã tắt nhận khách.');
    } catch (e) {
      const msg = translateAcceptingError(e?.message || e?.data?.error || 'REQUEST_FAILED');
      setAcceptingError(msg);
      setAcceptingToast(msg);
    } finally {
      setAcceptingBusy(false);
    }
  };

  const toggleClosedToday = async () => {
    if (!token || closedBusy) return;
    setClosedBusy(true);
    setClosedError('');
    try {
      const res = await setClosedTodayApi({ next: !closedToday });
      const item = res?.item || null;
      const tz = String(item?.bookingPreferences?.timezone || '').trim() || 'Asia/Ho_Chi_Minh';
      const today = formatYmdInTz(new Date(), tz);
      const closedDate = String(item?.bookingPreferences?.closedDate || '').trim();
      const next = Boolean(today && closedDate && closedDate === today);
      setClosedToday(next);
      setAcceptingToast(next ? 'Đã bật nghỉ hôm nay.' : 'Đã tắt nghỉ hôm nay.');
    } catch (e) {
      const msg = translateClosedError(e?.message || e?.data?.error || 'REQUEST_FAILED');
      setClosedError(msg);
      setAcceptingToast(msg);
    } finally {
      setClosedBusy(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800/70 bg-zinc-950/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10 lg:hidden"
          aria-label={t('seller_header_open_menu')}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className="flex min-w-0 items-center gap-3">
          <div className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-2xl border border-sky-400/20 bg-gradient-to-br from-sky-400/30 via-cyan-400/15 to-transparent text-sm font-black text-zinc-50">
            <span className="pointer-events-none absolute -inset-6 bg-[radial-gradient(120px_60px_at_45%_40%,rgba(56,189,248,0.35),transparent_60%)]" />
            S
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-black text-zinc-50">{shopName}</div>
            <div className="truncate text-[11px] text-zinc-400">{t('seller_header_tagline')}</div>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            className="inline-flex h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3 text-xs font-black text-zinc-200 hover:bg-white/10"
            aria-label={t('seller_lang_toggle')}
            title={t('seller_lang_toggle')}
          >
            {lang === 'vi' ? t('lang_en') : t('lang_vi')}
          </button>

          <button
            type="button"
            onClick={toggleAccepting}
            disabled={!token || acceptingBusy}
            className={cx(
              'inline-flex h-10 items-center justify-center rounded-2xl border px-3 text-xs font-black transition disabled:opacity-60',
              acceptingBookings ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15' : 'border-rose-400/20 bg-rose-500/10 text-rose-100 hover:bg-rose-500/15',
              acceptingError ? 'border-rose-400/35' : ''
            )}
            aria-label="Bật/tắt nhận khách"
            title={acceptingError ? `Lỗi: ${acceptingError}` : acceptingBookings ? 'Shop đang nhận khách' : 'Shop đang tạm dừng nhận khách'}
          >
            <span className={cx('mr-2 inline-flex h-2 w-2 rounded-full', acceptingBookings ? 'bg-emerald-400' : 'bg-rose-400')} />
            {acceptingBusy ? 'Đang cập nhật…' : acceptingBookings ? 'Nhận khách: Bật' : 'Nhận khách: Tắt'}
          </button>

          <button
            type="button"
            onClick={toggleClosedToday}
            disabled={!token || closedBusy}
            className={cx(
              'inline-flex h-10 items-center justify-center rounded-2xl border px-3 text-xs font-black transition disabled:opacity-60',
              closedToday ? 'border-amber-400/25 bg-amber-500/10 text-amber-100 hover:bg-amber-500/15' : 'border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10',
              closedError ? 'border-rose-400/35' : ''
            )}
            aria-label="Bật/tắt nghỉ hôm nay"
            title={closedError ? `Lỗi: ${closedError}` : closedToday ? 'Hôm nay shop nghỉ (vẫn nhận đặt lịch các ngày khác)' : 'Bật để nghỉ hôm nay'}
          >
            <span className={cx('mr-2 inline-flex h-2 w-2 rounded-full', closedToday ? 'bg-amber-400' : 'bg-zinc-400')} />
            {closedBusy ? 'Đang cập nhật…' : closedToday ? 'Hôm nay: Nghỉ' : 'Hôm nay: Làm'}
          </button>

          <button
            type="button"
            onClick={() => setChatPanelOpen((v) => !v)}
            className="inline-flex h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3 text-xs font-black text-zinc-200 hover:bg-white/10"
            aria-label="Tin nhắn"
            title="Tin nhắn"
          >
            Tin nhắn
            {chatUnreadCount > 0 ? (
              <span className="ml-2 grid h-5 min-w-[20px] place-items-center rounded-full bg-sky-400 px-1 text-[11px] font-black text-zinc-950">
                {chatUnreadCount > 9 ? '9+' : String(chatUnreadCount)}
              </span>
            ) : null}
          </button>

          {canSwitchToUser ? (
            <button
              type="button"
              onClick={switchToUserMode}
              className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10"
            >
              Quay về tài khoản thường
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => {
              try {
                sessionStorage.removeItem('post_auth_redirect');
              } catch {}
              logout();
              nav('/login', { replace: true });
            }}
            className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10"
          >
            {t('seller_header_logout')}
          </button>

          <div className="hidden items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 md:flex">
            <div className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/5 text-xs font-black text-zinc-100">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-zinc-100">{userName}</div>
              <div className="truncate text-[11px] text-zinc-400">{t('seller_header_account')}</div>
            </div>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-400">
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>

      {acceptingToast ? (
        <div className="border-t border-white/10 bg-zinc-950/60 px-4 py-2 text-xs font-semibold text-zinc-200">
          {acceptingToast}
        </div>
      ) : null}

      {chatPanelOpen ? (
        <div className="fixed inset-0 z-[75]">
          <button type="button" className="absolute inset-0 bg-black/40" onClick={() => setChatPanelOpen(false)} aria-label="Close" />
          <div className="absolute right-4 top-16 w-[min(420px,calc(100%-32px))] overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/95 shadow-2xl shadow-black/60 backdrop-blur-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div className="text-sm font-black text-zinc-50">Tin nhắn</div>
              <button
                type="button"
                onClick={() => {
                  markChatSeen();
                  setChatPanelOpen(false);
                }}
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10"
              >
                Đóng
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-3 space-y-2">
              {chatLoading ? <div className="px-2 py-2 text-sm text-zinc-400">Đang tải…</div> : null}
              {chatError ? <div className="px-2 py-2 text-sm text-rose-200">{chatError}</div> : null}
              {!chatLoading && !chatError && !chatThreads.length ? (
                <div className="px-2 py-3 text-sm text-zinc-400">Chưa có hội thoại.</div>
              ) : null}
              {chatThreads.slice(0, 30).map((th) => {
                const uid = String(th?.userId || th?.user?._id || '').trim();
                const who = String(th?.user?.name || th?.user?.email || 'Khách hàng').trim();
                const when = fmtClock(th?.lastMessageAt);
                const preview = String(th?.lastMessageText || '').trim();
                const isUnread = String(th?.lastMessageSenderType || '').trim().toLowerCase() === 'user' && th?.lastMessageAt;
                const tid = String(th?._id || '').trim();
                return (
                  <div key={String(tid || uid || Math.random())} className="flex items-start gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (!uid) return;
                        markChatSeen();
                        setChatUserId(uid);
                        setChatOpen(true);
                        setChatPanelOpen(false);
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className={cx('truncate text-sm font-semibold', isUnread ? 'text-sky-200' : 'text-zinc-100')}>{who}</div>
                        <div className="shrink-0 text-[11px] font-semibold text-zinc-500">{when}</div>
                      </div>
                      <div className={cx('mt-1 line-clamp-1 text-xs', isUnread ? 'text-sky-200' : 'text-zinc-400')}>{preview || '—'}</div>
                    </button>
                    <button
                      type="button"
                      disabled={!tid || deletingThreadId === tid}
                      onClick={async () => {
                        if (!tid || !token) return;
                        const ok = window.confirm('Xóa cuộc trò chuyện này?');
                        if (!ok) return;
                        setDeletingThreadId(tid);
                        try {
                          await apiFetch(`/api/vendor/chat/threads/${encodeURIComponent(tid)}`, { token, method: 'DELETE', failoverOnNotFound: true });
                          setChatThreads((prev) => (Array.isArray(prev) ? prev.filter((x) => String(x?._id || '') !== tid) : []));
                        } catch (e) {
                          setChatError(String(e?.message || 'REQUEST_FAILED'));
                        } finally {
                          setDeletingThreadId('');
                        }
                      }}
                      className="shrink-0 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-500/15 disabled:opacity-60"
                      aria-label="Xóa"
                      title="Xóa"
                    >
                      {deletingThreadId === tid ? 'Đang xóa…' : 'Xóa'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      <ChatThreadModal
        open={chatOpen}
        onClose={() => {
          setChatOpen(false);
          setChatUserId('');
        }}
        mode="vendor"
        userId={chatUserId}
      />
    </header>
  );
};

export default Header;
