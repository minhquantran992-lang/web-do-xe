import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../services/auth/AuthContext.jsx';
import { useI18n } from '../services/i18n.jsx';
import SearchBar from '../components/SearchBar.jsx';
import { changePassword, requestReset, resetByCode, verifyResetCode } from '../services/api/auth.js';
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '../services/api/notifications.js';

const DashboardLayout = () => {
  const { user, token, logout } = useAuth();
  const { lang, t, toggle } = useI18n();
  const loc = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwdOld, setPwdOld] = useState('');
  const [pwdNext, setPwdNext] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [pwdDone, setPwdDone] = useState(false);
  const [pwdAltMode, setPwdAltMode] = useState(false);
  const [pwdEmail, setPwdEmail] = useState('');
  const [pwdOtp, setPwdOtp] = useState('');
  const [pwdOtpSent, setPwdOtpSent] = useState(false);
  const [pwdOtpSending, setPwdOtpSending] = useState(false);
  const [pwdOtpVerified, setPwdOtpVerified] = useState(false);
  const [pwdOtpVerifying, setPwdOtpVerifying] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notif, setNotif] = useState({ loading: false, error: '', unreadCount: 0, items: [] });
  const [notifToast, setNotifToast] = useState('');
  const notifToastTimerRef = useRef(0);
  const lastNotifTopIdRef = useRef('');
  const lastUnreadRef = useRef(0);

  useEffect(() => {
    try {
      const v = localStorage.getItem('carbanana.sidebar.collapsed');
      if (v === '1') setCollapsed(true);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('carbanana.sidebar.collapsed', collapsed ? '1' : '0');
    } catch {}
  }, [collapsed]);

  const isHome = String(loc?.pathname || '') === '/dashboard';

  const refreshNotifications = useCallback(
    async ({ silent } = {}) => {
      if (!token) return;
      if (!silent) setNotif((p) => ({ ...p, loading: true, error: '' }));
      try {
        const data = await listNotifications({ token, limit: 8, skip: 0 });
        const items = Array.isArray(data?.items) ? data.items : [];
        const unreadCount = Number(data?.unreadCount) || 0;
        const topId = String(items?.[0]?._id || '');
        const topContent = String(items?.[0]?.content || items?.[0]?.type || '').trim();

        if (unreadCount > lastUnreadRef.current && topId && topId !== lastNotifTopIdRef.current && topContent) {
          setNotifToast(topContent);
          if (notifToastTimerRef.current) window.clearTimeout(notifToastTimerRef.current);
          notifToastTimerRef.current = window.setTimeout(() => setNotifToast(''), 4500);
        }

        setNotif({
          loading: false,
          error: '',
          unreadCount,
          items
        });
        lastUnreadRef.current = unreadCount;
        lastNotifTopIdRef.current = topId;
      } catch (e) {
        setNotif((p) => ({ ...p, loading: false, error: String(e?.message || 'FAILED_TO_LOAD') }));
      }
    },
    [token]
  );

  useEffect(() => {
    if (!token) return;
    refreshNotifications({ silent: true });
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      refreshNotifications({ silent: true });
    }, 8000);
    return () => window.clearInterval(id);
  }, [refreshNotifications, token]);

  useEffect(() => {
    setAccountOpen(false);
    setMobileOpen(false);
    setPwdOpen(false);
    setNotifOpen(false);
  }, [loc?.pathname]);

  useEffect(() => {
    return () => {
      if (notifToastTimerRef.current) window.clearTimeout(notifToastTimerRef.current);
    };
  }, []);

  const userLabel = String(user?.name || user?.fullName || user?.email || '').trim();
  const userInitials = (() => {
    const s = userLabel || 'U';
    const parts = s.split(' ').filter(Boolean);
    const a = (parts[0] || 'U')[0] || 'U';
    const b = (parts[1] || '')[0] || '';
    return `${a}${b}`.toUpperCase();
  })();

  const pwdFriendlyError = useMemo(() => {
    const c = String(pwdError || '').trim();
    if (!c) return '';
    if (c === 'WEAK_PASSWORD') return t('auth_weak_password');
    if (c === 'PASSWORDS_NOT_MATCH') return t('auth_passwords_not_match');
    if (c === 'INVALID_CREDENTIALS') return t('auth_invalid_credentials');
    if (c === 'INVALID_CODE') return t('auth_invalid_code');
    if (c === 'MISSING_EMAIL') return t('auth_missing_email');
    if (c === 'UNAUTHORIZED') return t('common_unauthorized');
    if (c === 'MISSING_FIELDS') return t('register_error_missing_fields');
    if (c === 'OTP_NOT_VERIFIED') return t('auth_verify_otp_first');
    return c;
  }, [pwdError, t]);

  const openPasswordModal = () => {
    setAccountOpen(false);
    setPwdError('');
    setPwdDone(false);
    setPwdAltMode(false);
    setPwdOld('');
    setPwdNext('');
    setPwdConfirm('');
    setPwdEmail(String(user?.email || '').trim());
    setPwdOtp('');
    setPwdOtpSent(false);
    setPwdOtpVerified(false);
    setPwdOpen(true);
  };

  const onSubmitPassword = async (e) => {
    e.preventDefault();
    if (pwdLoading) return;
    setPwdError('');
    setPwdDone(false);
    if (pwdAltMode) {
      const email = String(pwdEmail || '').trim();
      const code = String(pwdOtp || '').trim();
      if (!email || !code || !String(pwdNext || '').trim() || !String(pwdConfirm || '').trim()) {
        setPwdError('MISSING_FIELDS');
        return;
      }
      if (code.length !== 6) {
        setPwdError('INVALID_CODE');
        return;
      }
      if (!pwdOtpVerified) {
        setPwdError('OTP_NOT_VERIFIED');
        return;
      }
      if (pwdNext.length < 6) {
        setPwdError('WEAK_PASSWORD');
        return;
      }
      if (pwdNext !== pwdConfirm) {
        setPwdError('PASSWORDS_NOT_MATCH');
        return;
      }
      setPwdLoading(true);
      try {
        await resetByCode({ email, code, newPassword: pwdNext });
        setPwdDone(true);
        setTimeout(() => {
          setPwdOpen(false);
          setPwdDone(false);
          setPwdOld('');
          setPwdNext('');
          setPwdConfirm('');
          setPwdEmail(String(user?.email || '').trim());
          setPwdOtp('');
          setPwdOtpSent(false);
          setPwdAltMode(false);
        }, 900);
      } catch (err) {
        setPwdError(err?.message || 'REQUEST_FAILED');
      } finally {
        setPwdLoading(false);
      }
      return;
    }

    if (!String(pwdOld || '').trim() || !String(pwdNext || '').trim() || !String(pwdConfirm || '').trim()) {
      setPwdError('MISSING_FIELDS');
      return;
    }
    if (pwdNext.length < 6) {
      setPwdError('WEAK_PASSWORD');
      return;
    }
    if (pwdNext !== pwdConfirm) {
      setPwdError('PASSWORDS_NOT_MATCH');
      return;
    }
    if (!token) {
      setPwdError('UNAUTHORIZED');
      return;
    }
    setPwdLoading(true);
    try {
      await changePassword({ token, oldPassword: pwdOld, newPassword: pwdNext });
      setPwdDone(true);
      setTimeout(() => {
        setPwdOpen(false);
        setPwdDone(false);
        setPwdOld('');
        setPwdNext('');
        setPwdConfirm('');
      }, 900);
    } catch (err) {
      setPwdError(err?.message || 'REQUEST_FAILED');
    } finally {
      setPwdLoading(false);
    }
  };

  const onSendOtp = async () => {
    if (pwdOtpSending || pwdLoading) return;
    const email = String(pwdEmail || '').trim();
    setPwdError('');
    if (!email) {
      setPwdError('MISSING_EMAIL');
      return;
    }
    setPwdOtpSending(true);
    try {
      await requestReset({ email });
      setPwdOtpSent(true);
      setPwdOtpVerified(false);
    } catch (err) {
      setPwdError(err?.message || 'REQUEST_FAILED');
      setPwdOtpSent(false);
      setPwdOtpVerified(false);
    } finally {
      setPwdOtpSending(false);
    }
  };

  const onVerifyOtp = async () => {
    if (pwdOtpVerifying || pwdOtpSending || pwdLoading) return;
    const email = String(pwdEmail || '').trim();
    const code = String(pwdOtp || '').trim();
    setPwdError('');
    if (!email || !code) {
      setPwdError('MISSING_FIELDS');
      return;
    }
    if (code.length !== 6) {
      setPwdError('INVALID_CODE');
      return;
    }
    setPwdOtpVerifying(true);
    try {
      await verifyResetCode({ email, code });
      setPwdOtpVerified(true);
      setPwdNext('');
      setPwdConfirm('');
    } catch (err) {
      setPwdOtpVerified(false);
      setPwdError(err?.message || 'INVALID_CODE');
    } finally {
      setPwdOtpVerifying(false);
    }
  };

  const linkBase =
    'group relative flex items-center overflow-hidden rounded-2xl border text-sm font-semibold transition duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-sky-500/40';
  const linkActive =
    'border-sky-400/45 bg-gradient-to-r from-sky-500/30 via-cyan-500/18 to-sky-500/30 text-zinc-50 shadow-[0_20px_70px_-46px_rgba(56,189,248,0.70),0_0_0_1px_rgba(56,189,248,0.22)]';
  const linkIdle =
    'border-white/10 bg-white/5 text-zinc-200 hover:border-sky-400/25 hover:bg-sky-500/5 hover:shadow-[0_18px_60px_-48px_rgba(56,189,248,0.55)]';

  const Icon = ({ name, className }) => {
    const cls = `h-[22px] w-[22px] ${className || ''}`;
    if (name === 'home')
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cls}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5L12 3l9 7.5V21a1 1 0 01-1 1h-5v-7H9v7H4a1 1 0 01-1-1v-10.5z" />
        </svg>
      );
    if (name === 'custom')
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cls}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v3m0 12v3m9-9h-3M6 12H3m15.364-6.364l-2.121 2.121M7.757 16.243l-2.121 2.121m12.728 0l-2.121-2.121M7.757 7.757L5.636 5.636" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.5 12a3.5 3.5 0 11-7 0 3.5 3.5 0 017 0z" />
        </svg>
      );
    if (name === 'market')
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cls}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16l-1.5 13h-13L4 7z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7a4 4 0 018 0" />
        </svg>
      );
    if (name === 'star')
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cls}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3l2.65 5.55 6.12.9-4.43 4.32 1.05 6.11L12 17.9 6.61 20.88l1.05-6.11-4.43-4.32 6.12-.9L12 3z"
          />
        </svg>
      );
    if (name === 'trophy')
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cls}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 4h8v3a4 4 0 01-8 0V4z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 6H4a2 2 0 00-2 2v1a4 4 0 004 4" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 6h2a2 2 0 012 2v1a4 4 0 01-4 4" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v3" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 21h8" />
        </svg>
      );
    if (name === 'orders')
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cls}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 3h10a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6M9 11h6M9 15h4" />
        </svg>
      );
    if (name === 'shop')
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cls}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16l-1 14H5L4 7z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 7V5a2 2 0 012-2h6a2 2 0 012 2v2" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6" />
        </svg>
      );
    if (name === 'garage')
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cls}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 11l9-8 9 8v10a1 1 0 01-1 1h-4v-7H8v7H4a1 1 0 01-1-1V11z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 13h8" />
        </svg>
      );
    if (name === 'user')
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cls}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 21a8 8 0 10-16 0" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 11a4 4 0 100-8 4 4 0 000 8z" />
        </svg>
      );
    if (name === 'admin')
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cls}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l7 4v6c0 5-3 9-7 10-4-1-7-5-7-10V6l7-4z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v4" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16h.01" />
        </svg>
      );
    if (name === 'logout')
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cls}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 17l-1 0a2 2 0 01-2-2V9a2 2 0 012-2h1" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H4" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9l3 3-3 3" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 19V5" />
        </svg>
      );
    if (name === 'menu')
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cls}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      );
    if (name === 'chevLeft')
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cls}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      );
    if (name === 'chevRight')
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cls}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      );
    if (name === 'close')
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cls}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6l-12 12" />
        </svg>
      );
    return null;
  };

  const SidebarNavItem = ({ to, label, icon, onClick, disabled }) => {
    const showTooltip = collapsed;
    const Body = ({ active }) => (
      <>
        {active ? (
          <span className="pointer-events-none absolute -inset-1 rounded-[18px] bg-[radial-gradient(400px_180px_at_18%_18%,rgba(56,189,248,0.38),transparent_62%)] opacity-90 blur-xl" />
        ) : null}
        <span
          className={[
            'relative inline-flex h-10 w-10 items-center justify-center rounded-2xl transition duration-200',
            active
              ? 'text-zinc-50 drop-shadow-[0_12px_26px_rgba(56,189,248,0.25)]'
              : 'text-zinc-200 group-hover:text-sky-100'
          ].join(' ')}
        >
          <Icon name={icon} className={active ? 'text-zinc-50' : ''} />
        </span>
        <span className={`${collapsed ? 'sr-only' : 'min-w-0 flex-1 truncate text-left text-[13px] font-semibold tracking-wide'}`}>
          {label}
        </span>
        {showTooltip ? (
          <span className="pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 whitespace-nowrap rounded-xl border border-white/10 bg-zinc-950/95 px-3 py-1.5 text-xs font-semibold text-zinc-100 opacity-0 shadow-2xl backdrop-blur transition-opacity group-hover:opacity-100">
            {label}
          </span>
        ) : null}
        <span className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-200 group-hover:opacity-100 bg-[linear-gradient(110deg,transparent,rgba(56,189,248,0.12),transparent)]" />
      </>
    );

    if (to) {
      return (
        <NavLink
          to={to}
          title={showTooltip ? label : undefined}
          className={({ isActive }) =>
            `${linkBase} ${collapsed ? 'justify-center px-2.5 py-2.5' : 'gap-3 px-3.5 py-2.5'} ${isActive ? linkActive : linkIdle}`
          }
          onClick={() => setMobileOpen(false)}
        >
          {({ isActive }) => <Body active={isActive} />}
        </NavLink>
      );
    }

    return (
      <button
        type="button"
        title={showTooltip ? label : undefined}
        onClick={onClick}
        disabled={disabled}
        className={`${linkBase} ${collapsed ? 'justify-center px-2.5 py-2.5' : 'gap-3 px-3.5 py-2.5'} ${disabled ? 'opacity-60' : ''}`}
      >
        <Body active={false} />
      </button>
    );
  };

  const SidebarContent = ({ compact, inDrawer }) => {
    const w = compact ? 70 : 240;
    return (
      <aside
        className={`relative rounded-3xl border border-zinc-800/70 bg-zinc-950/55 backdrop-blur-2xl ${
          inDrawer ? 'h-full p-5' : 'h-fit p-5 lg:sticky lg:top-6'
        } transition-[width] duration-300 ease-out`}
        style={{ width: inDrawer ? '100%' : w }}
      >
        <div className="pointer-events-none absolute inset-0 rounded-3xl bg-[radial-gradient(600px_260px_at_18%_8%,rgba(56,189,248,0.16),transparent_65%),radial-gradient(520px_260px_at_82%_92%,rgba(34,211,238,0.10),transparent_62%)]" />

        <div className="relative flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              if (inDrawer) {
                setMobileOpen(false);
              } else {
                setCollapsed((v) => !v);
              }
            }}
            className="rounded-2xl border border-white/10 bg-white/5 p-2.5 text-zinc-200 shadow-[0_12px_40px_-26px_rgba(0,0,0,0.75)] transition hover:bg-white/10"
            aria-label="Toggle sidebar"
            title={inDrawer ? undefined : compact ? t('sidebar_open') : t('sidebar_collapse')}
          >
            <Icon name={inDrawer ? 'close' : compact ? 'chevRight' : 'chevLeft'} className="h-5 w-5" />
          </button>
        </div>

        <div className="relative mt-5">
          <div className={`${compact ? 'sr-only' : 'px-1 text-[11px] font-semibold tracking-[0.22em] text-zinc-500'}`}>{t('sidebar_section_menu')}</div>
          <div className="mt-3 grid gap-2.5">
            <SidebarNavItem to="/dashboard" label={t('nav_home')} icon="home" />
            <SidebarNavItem to="/custom" label={t('nav_custom')} icon="custom" />
            <SidebarNavItem to="/marketplace" label={t('nav_marketplace')} icon="market" />
            <SidebarNavItem to="/following" label={t('nav_following')} icon="star" />
            <SidebarNavItem to="/leaderboard" label={t('leaderboard_title')} icon="trophy" />
            <SidebarNavItem to="/orders" label={t('nav_orders')} icon="orders" />
            {String(user?.role || '').toUpperCase() === 'VENDOR' ? (
              <SidebarNavItem to="/seller-center" label={t('nav_shop')} icon="shop" />
            ) : null}
            <SidebarNavItem to="/garage" label={t('nav_garage')} icon="garage" />
          </div>
        </div>

        {user?.isAdmin ? (
          <div className="relative mt-5">
            <div className={`${compact ? 'sr-only' : 'px-1 text-[11px] font-semibold tracking-[0.22em] text-zinc-500'}`}>{t('sidebar_section_manage')}</div>
            <div className="mt-3 grid gap-2.5">
              <SidebarNavItem to="/admin/cars" label={t('nav_admin')} icon="admin" />
              <SidebarNavItem to="/admin/security" label="Bảo mật" icon="admin" />
            </div>
          </div>
        ) : null}
      </aside>
    );
  };

  return (
    <div
      className="relative min-h-screen overflow-x-hidden text-zinc-100"
      style={{
        backgroundImage:
          'radial-gradient(900px 480px at 14% 0%, rgba(56,189,248,0.22), transparent 60%), radial-gradient(760px 520px at 86% 18%, rgba(168,85,247,0.14), transparent 62%), radial-gradient(860px 560px at 74% 96%, rgba(34,211,238,0.12), transparent 60%), linear-gradient(180deg, #070b14 0%, #05060a 65%, #04040a 100%)'
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.16]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.10) 1px, transparent 1px)',
          backgroundSize: '84px 84px'
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/0 via-black/10 to-black/35" />
      {notifToast ? (
        <div className="fixed inset-x-0 top-4 z-[120] flex justify-center px-4">
          <div className="w-full max-w-xl rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm font-semibold text-sky-100 shadow-2xl shadow-black/40 backdrop-blur-2xl">
            {notifToast}
          </div>
        </div>
      ) : null}
      {(() => {
        const path = String(loc?.pathname || '');
        const isProfile = path === '/profile' || path.startsWith('/profile/');
        const role = String(user?.role || '').trim().toUpperCase();
        const isVendor = role === 'VENDOR' && !user?.isAdmin;
        const vendorMode = (() => {
          if (!isVendor) return 'user';
          try {
            const v = String(localStorage.getItem('carbanana.vendor.mode') || '').trim().toLowerCase();
            return v === 'user' ? 'user' : 'seller';
          } catch {
            return 'seller';
          }
        })();
        const vendorOnlyShop = isVendor && (vendorMode === 'seller' || path.startsWith('/seller-center'));
        const showSidebar = !isProfile && !vendorOnlyShop;
        return (
          <>
      {isHome && pwdOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm"
            aria-label={t('seller_common_close')}
            onClick={() => setPwdOpen(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-10">
            <div className="w-full max-w-md">
              <div className="relative">
                <div className="absolute -inset-1 rounded-[1.75rem] bg-gradient-to-r from-sky-500/26 via-cyan-500/20 to-sky-500/26 blur-xl" />
                <div className="relative overflow-hidden rounded-[1.75rem] border border-white/15 bg-black/45 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_26px_90px_-45px_rgba(0,0,0,0.90),0_0_60px_rgba(14,165,233,0.16)] backdrop-blur-2xl">
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_28%_16%,rgba(255,255,255,0.10),transparent_48%)]" />
                  <div className="relative flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-2">
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold tracking-wide text-sky-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-sky-300 shadow-[0_0_18px_rgba(56,189,248,0.55)]" />
                        {t('common_account')}
                      </div>
                      <div className="text-2xl font-black tracking-tight text-zinc-50">{t('auth_change_password_title')}</div>
                      <div className="h-px w-20 bg-gradient-to-r from-sky-300/90 via-cyan-400/70 to-transparent" />
                    </div>
                    <button
                      type="button"
                      onClick={() => setPwdOpen(false)}
                      className="rounded-2xl border border-white/10 bg-white/5 p-2 text-zinc-200 transition hover:bg-white/10"
                      aria-label={t('seller_common_close')}
                    >
                      <Icon name="close" className="h-5 w-5" />
                    </button>
                  </div>

                  {pwdDone ? (
                    <div className="relative mt-5 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-sky-500/25 bg-sky-500/12 shadow-[0_0_24px_rgba(56,189,248,0.25)]">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-sky-200">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-zinc-50">{t('auth_change_password_success')}</div>
                        <div className="mt-1 text-xs text-zinc-300">{t('auth_redirect_dashboard_hint')}</div>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={onSubmitPassword} className="relative mt-5 space-y-4">
                      {!pwdAltMode ? (
                        <label className="block">
                          <div className="mb-1.5 text-sm font-semibold text-zinc-200">{t('auth_current_password')}</div>
                          <div className="relative">
                            <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(500px_200px_at_10%_0%,rgba(56,189,248,0.10),transparent_60%)]" />
                            <input
                              className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-sky-400/70 focus:shadow-[0_0_0_3px_rgba(56,189,248,0.18)]"
                              type="password"
                              value={pwdOld}
                              onChange={(e) => setPwdOld(e.target.value)}
                              autoComplete="current-password"
                              required
                            />
                          </div>
                        </label>
                      ) : pwdOtpVerified ? (
                        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-100">
                          {t('auth_otp_verified')}
                        </div>
                      ) : (
                        <>
                          <label className="block">
                            <div className="mb-1.5 text-sm font-semibold text-zinc-200">{t('common_email')}</div>
                            <div className="relative">
                              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(500px_200px_at_10%_0%,rgba(56,189,248,0.10),transparent_60%)]" />
                              <input
                                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-sky-400/70 focus:shadow-[0_0_0_3px_rgba(56,189,248,0.18)]"
                                type="email"
                                value={pwdEmail}
                                onChange={(e) => {
                                  setPwdEmail(e.target.value);
                                  setPwdOtpVerified(false);
                                }}
                                autoComplete="email"
                                placeholder="you@example.com"
                                required
                              />
                            </div>
                          </label>

                          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                            <label className="block">
                              <div className="mb-1.5 text-sm font-semibold text-zinc-200">{t('auth_otp_code')}</div>
                              <div className="relative">
                                <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(500px_200px_at_10%_0%,rgba(34,211,238,0.10),transparent_60%)]" />
                                <input
                                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-400/60 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.16)]"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  maxLength={6}
                                  value={pwdOtp}
                                  onChange={(e) => {
                                    setPwdOtp(e.target.value.replace(/\\D/g, '').slice(0, 6));
                                    setPwdOtpVerified(false);
                                  }}
                                  placeholder="123456"
                                  required
                                />
                              </div>
                            </label>
                            <button
                              type="button"
                              onClick={onSendOtp}
                              disabled={pwdOtpSending || pwdLoading}
                              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-100 transition hover:bg-white/10 disabled:opacity-60"
                            >
                              {pwdOtpSending ? t('auth_processing') : t('auth_send_otp')}
                            </button>
                          </div>

                          {pwdOtpSent ? (
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-zinc-300">
                              {t('auth_otp_sent')}
                            </div>
                          ) : null}

                          <button
                            type="button"
                            onClick={onVerifyOtp}
                            disabled={pwdOtpVerifying || pwdLoading || pwdOtpSending}
                            className="w-full rounded-2xl bg-gradient-to-r from-sky-400 to-cyan-300 px-5 py-3 text-sm font-black text-zinc-950 shadow-[0_18px_60px_-42px_rgba(56,189,248,0.75)] transition hover:brightness-110 disabled:opacity-60"
                          >
                            {pwdOtpVerifying ? t('auth_processing') : t('auth_verify_otp')}
                          </button>
                        </>
                      )}

                      {!pwdAltMode ? (
                        <>
                          <label className="block">
                            <div className="mb-1.5 text-sm font-semibold text-zinc-200">{t('auth_new_password')}</div>
                            <div className="relative">
                              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(500px_200px_at_10%_0%,rgba(34,211,238,0.10),transparent_60%)]" />
                              <input
                                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-400/60 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.16)]"
                                type="password"
                                value={pwdNext}
                                onChange={(e) => setPwdNext(e.target.value)}
                                autoComplete="new-password"
                                required
                              />
                            </div>
                          </label>

                          <label className="block">
                            <div className="mb-1.5 text-sm font-semibold text-zinc-200">{t('auth_confirm_password')}</div>
                            <div className="relative">
                              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(500px_200px_at_10%_0%,rgba(56,189,248,0.10),transparent_60%)]" />
                              <input
                                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-sky-400/70 focus:shadow-[0_0_0_3px_rgba(56,189,248,0.18)]"
                                type="password"
                                value={pwdConfirm}
                                onChange={(e) => setPwdConfirm(e.target.value)}
                                autoComplete="new-password"
                                required
                              />
                            </div>
                          </label>
                        </>
                      ) : pwdAltMode && pwdOtpVerified ? (
                        <>
                          <label className="block">
                            <div className="mb-1.5 text-sm font-semibold text-zinc-200">{t('auth_new_password')}</div>
                            <div className="relative">
                              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(500px_200px_at_10%_0%,rgba(34,211,238,0.10),transparent_60%)]" />
                              <input
                                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-400/60 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.16)]"
                                type="password"
                                value={pwdNext}
                                onChange={(e) => setPwdNext(e.target.value)}
                                autoComplete="new-password"
                                required
                              />
                            </div>
                          </label>

                          <label className="block">
                            <div className="mb-1.5 text-sm font-semibold text-zinc-200">{t('auth_confirm_password')}</div>
                            <div className="relative">
                              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(500px_200px_at_10%_0%,rgba(56,189,248,0.10),transparent_60%)]" />
                              <input
                                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-sky-400/70 focus:shadow-[0_0_0_3px_rgba(56,189,248,0.18)]"
                                type="password"
                                value={pwdConfirm}
                                onChange={(e) => setPwdConfirm(e.target.value)}
                                autoComplete="new-password"
                                required
                              />
                            </div>
                          </label>
                        </>
                      ) : null}

                      {pwdFriendlyError ? (
                        <div className="rounded-2xl border border-red-900/40 bg-red-950/30 p-3 text-sm text-red-200">
                          {pwdFriendlyError}
                        </div>
                      ) : null}

                      {!pwdAltMode ? (
                        <button
                          type="button"
                          onClick={() => {
                            setPwdError('');
                            setPwdOtpSent(false);
                            setPwdOtp('');
                            setPwdOld('');
                            setPwdOtpVerified(false);
                            setPwdAltMode(true);
                          }}
                          className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-zinc-100 transition hover:bg-white/10"
                        >
                          {t('auth_try_otp_method')}
                        </button>
                      ) : null}

                      {!pwdAltMode ? (
                        <button
                          type="submit"
                          disabled={pwdLoading}
                          className={`w-full rounded-2xl px-5 py-3 text-sm font-black text-zinc-950 shadow-[0_18px_60px_-42px_rgba(56,189,248,0.75)] transition ${
                            pwdLoading ? 'bg-sky-200/70' : 'bg-gradient-to-r from-sky-400 to-cyan-300 hover:brightness-110'
                          }`}
                        >
                          {pwdLoading ? t('auth_processing') : t('auth_change_password_btn')}
                        </button>
                      ) : pwdOtpVerified ? (
                        <button
                          type="submit"
                          disabled={pwdLoading}
                          className={`w-full rounded-2xl px-5 py-3 text-sm font-black text-zinc-950 shadow-[0_18px_60px_-42px_rgba(56,189,248,0.75)] transition ${
                            pwdLoading ? 'bg-sky-200/70' : 'bg-gradient-to-r from-sky-400 to-cyan-300 hover:brightness-110'
                          }`}
                        >
                          {pwdLoading ? t('auth_processing') : t('auth_change_password_btn')}
                        </button>
                      ) : null}
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {isHome && (accountOpen || notifOpen) ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-transparent"
          aria-label={t('seller_common_close')}
          onClick={() => {
            setAccountOpen(false);
            setNotifOpen(false);
          }}
        />
      ) : null}

      {isHome ? (
        <header className="sticky top-0 z-50 border-b border-white/10 bg-zinc-950/70 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
            {(() => {
              const path = String(loc?.pathname || '');
              const isProfile = path === '/profile' || path.startsWith('/profile/');
              const showSidebar = !isProfile;
              return (
                <>
                  {showSidebar ? (
                    <button
                      type="button"
                      onClick={() => setMobileOpen(true)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-zinc-200 shadow-[0_12px_40px_-26px_rgba(0,0,0,0.75)] transition hover:bg-white/10 lg:hidden"
                      aria-label={t('sidebar_open')}
                    >
                      <Icon name="menu" />
                    </button>
                  ) : null}

                  <Link
                    to="/dashboard"
                    className="group inline-flex min-w-0 items-center gap-4"
                    aria-label={t('app_name')}
                    title={t('app_name')}
                  >
                    <img
                      src="/logo-mark.png"
                      alt={t('app_name')}
                      className="h-16 w-16 select-none object-contain transition group-hover:opacity-90 sm:h-20 sm:w-20"
                      draggable={false}
                    />
                    <span className="min-w-0 text-left">
                      <span className="block whitespace-nowrap text-[18px] font-black leading-none tracking-[0.28em] text-white sm:text-[22px]">
                        ELORIDE
                      </span>
                      <span className="mt-1 hidden whitespace-nowrap text-[11px] font-semibold leading-none tracking-[0.22em] text-white/70 sm:block">
                        MOD YOUR RIDE | SYSTEM CUSTOMS
                      </span>
                    </span>
                  </Link>
                </>
              );
            })()}

            <div className="min-w-0 flex-1">
              <SearchBar />
            </div>

            <div className="flex shrink-0 items-center justify-end">
              <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-white/10 bg-black/25 p-1.5 shadow-[0_12px_40px_-26px_rgba(0,0,0,0.75)] backdrop-blur">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setAccountOpen(false);
                      setNotifOpen((v) => !v);
                      refreshNotifications({});
                    }}
                    className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl text-zinc-200 transition hover:bg-white/10"
                    aria-label={t('nav_notifications')}
                    title={t('nav_notifications')}
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a3 3 0 006 0" />
                    </svg>
                    {notif.unreadCount ? (
                      <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-[20px] place-items-center rounded-full bg-sky-400 px-1 text-[11px] font-black text-zinc-950">
                        {Math.min(99, Number(notif.unreadCount) || 0)}
                      </span>
                    ) : null}
                  </button>

                  {notifOpen ? (
                    <div className="absolute right-0 mt-2 w-[360px] max-w-[calc(100vw-32px)] overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/95 shadow-2xl backdrop-blur">
                      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
                        <div className="text-sm font-semibold text-zinc-100">{t('notifications_title')}</div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              if (!token) return;
                              await markAllNotificationsRead({ token });
                              await refreshNotifications({});
                            }}
                            className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-white/10"
                          >
                            {t('notifications_mark_all')}
                          </button>
                          <Link
                            to="/notifications"
                            onClick={() => setNotifOpen(false)}
                            className="rounded-xl border border-sky-400/25 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-100 transition hover:bg-sky-500/15"
                          >
                            {t('nav_notifications')}
                          </Link>
                        </div>
                      </div>

                      <div className="max-h-[420px] overflow-y-auto p-2">
                        {!notif.items.length ? (
                          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-zinc-300">
                            {t('notifications_empty')}
                          </div>
                        ) : (
                          notif.items.slice(0, 8).map((n) => {
                            const id = String(n?._id || '');
                            const isRead = Boolean(n?.isRead);
                            const content = String(n?.content || '').trim() || String(n?.type || '').trim();
                            const meta = n?.meta && typeof n.meta === 'object' ? n.meta : null;
                            const orderId = String(meta?.orderId || '').trim();
                            const itemType = String(meta?.itemType || '').trim();
                            const itemId = String(meta?.itemId || '').trim();
                            const to = orderId
                              ? `/orders/${encodeURIComponent(orderId)}`
                              : itemType === 'build' && itemId
                                ? `/builds/${encodeURIComponent(itemId)}`
                                : itemType === 'part'
                                  ? '/parts'
                                  : '';
                            return (
                              <button
                                key={id}
                                type="button"
                                onClick={async () => {
                                  if (!token || !id) return;
                                  if (!isRead) await markNotificationRead({ token, id });
                                  await refreshNotifications({ silent: true });
                                  setNotifOpen(false);
                                  if (to) window.location.href = to;
                                }}
                                className={`w-full rounded-xl border px-3 py-3 text-left text-sm transition ${
                                  isRead
                                    ? 'border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10'
                                    : 'border-sky-400/20 bg-sky-500/10 text-zinc-50 hover:bg-sky-500/15'
                                }`}
                              >
                                <div className="font-semibold">{content}</div>
                                {n?.createdAt ? (
                                  <div className="mt-1 text-xs text-zinc-400">{new Date(n.createdAt).toLocaleString()}</div>
                                ) : null}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="hidden h-8 w-px bg-white/10 sm:block" />

                <Link
                  to="/partner-application"
                  title={t('lp_cta_partner_shop')}
                  className="inline-flex h-10 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-sky-100 transition hover:bg-white/10"
                >
                  <Icon name="shop" className="h-5 w-5" />
                  <span className="hidden xl:block">{t('lp_cta_partner_shop')}</span>
                  <span className="xl:hidden">Đối tác</span>
                </Link>

                <button
                  type="button"
                  onClick={toggle}
                  title={lang === 'vi' ? t('lang_en') : t('lang_vi')}
                  className="inline-flex h-10 items-center justify-center rounded-xl px-3 text-xs font-semibold text-zinc-200 transition hover:bg-white/10"
                >
                  {lang === 'vi' ? t('lang_en') : t('lang_vi')}
                </button>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setAccountOpen((v) => !v)}
                    className="inline-flex h-10 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-zinc-200 transition hover:bg-white/10"
                  >
                    <span className="grid h-7 w-7 place-items-center rounded-xl bg-white/5 text-[11px] font-black text-white/90">
                      {userInitials}
                    </span>
                    <span className="hidden max-w-[160px] truncate xl:block">{userLabel || t('common_account')}</span>
                  </button>

                  {accountOpen ? (
                    <div className="absolute right-0 mt-2 w-[200px] overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/95 shadow-2xl backdrop-blur">
                      <Link
                        to="/profile"
                        onClick={() => setAccountOpen(false)}
                        target="_blank"
                        rel="noreferrer"
                        className="block px-4 py-3 text-sm font-semibold text-zinc-100 hover:bg-white/5"
                      >
                        {t('register_btn_edit_account')}
                      </Link>
                      <button
                        type="button"
                        onClick={openPasswordModal}
                        className="w-full px-4 py-3 text-left text-sm font-semibold text-zinc-100 hover:bg-white/5"
                      >
                        {t('auth_change_password_title')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAccountOpen(false);
                          logout();
                        }}
                        className="w-full px-4 py-3 text-left text-sm font-semibold text-red-200 hover:bg-red-500/10"
                      >
                        {t('nav_logout')}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </header>
      ) : null}

      {showSidebar && !isHome ? (
        <>
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="fixed left-4 top-4 z-50 rounded-2xl border border-white/10 bg-white/5 p-2.5 text-zinc-200 shadow-[0_12px_40px_-26px_rgba(0,0,0,0.75)] hover:bg-white/10 lg:hidden"
            aria-label={t('sidebar_open')}
          >
            <Icon name="menu" />
          </button>

          {mobileOpen ? (
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm lg:hidden"
              aria-label={t('seller_common_close')}
            />
          ) : null}

          <div
            className={`fixed inset-y-0 left-0 z-50 w-[calc(100vw-16px)] max-w-[320px] transform transition-transform duration-300 ease-out lg:hidden ${
              mobileOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <div className="h-full p-3">
              <SidebarContent compact={false} inDrawer />
            </div>
          </div>
        </>
      ) : null}

      <div className={`mx-auto max-w-7xl px-4 py-6 ${showSidebar ? 'flex gap-6' : ''}`}>
        {showSidebar ? (
          <div className="hidden lg:block">
            <SidebarContent compact={collapsed} />
          </div>
        ) : null}

        <main className={showSidebar ? 'min-w-0 flex-1' : ''}>
          <Outlet />
        </main>
      </div>
          </>
        );
      })()}
    </div>
  );
};

export default DashboardLayout;
