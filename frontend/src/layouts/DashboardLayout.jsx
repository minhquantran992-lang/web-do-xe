import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../services/auth/AuthContext.jsx';
import { useI18n } from '../services/i18n.jsx';
import SearchBar from '../components/SearchBar.jsx';
import { changePassword, requestReset, resetByCode, verifyResetCode } from '../services/api/auth.js';

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

  useEffect(() => {
    setAccountOpen(false);
    setMobileOpen(false);
    setPwdOpen(false);
  }, [loc?.pathname]);

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
    'group relative flex items-center overflow-hidden rounded-2xl border text-sm font-semibold transition duration-200 ease-out will-change-transform focus:outline-none focus:ring-2 focus:ring-sky-500/40 hover:scale-[1.02]';
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
            'relative inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition duration-200',
            active
              ? 'border-white/10 bg-white/10 text-zinc-50 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]'
              : 'border-white/10 bg-white/5 text-sky-200 group-hover:border-sky-400/25 group-hover:bg-sky-500/10'
          ].join(' ')}
        >
          <Icon name={icon} className={active ? 'text-zinc-50' : ''} />
        </span>
        <span className={`${collapsed ? 'sr-only' : 'min-w-0 flex-1 truncate text-left text-[13px] font-semibold'}`}>
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
            `${linkBase} ${collapsed ? 'justify-center px-2.5 py-2.5' : 'gap-3 px-4 py-3'} ${isActive ? linkActive : linkIdle}`
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
        className={`${linkBase} ${collapsed ? 'justify-center px-2.5 py-2.5' : 'gap-3 px-4 py-3'} ${disabled ? 'opacity-60' : ''}`}
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

        <div className="relative mt-5 flex flex-col items-center">
          <Link to="/dashboard" className={`group relative inline-flex items-center ${compact ? 'h-11 w-11 justify-center' : 'w-full justify-start px-4'}`}>
            <span className="pointer-events-none absolute -inset-5 rounded-[32px] bg-[radial-gradient(760px_360px_at_30%_10%,rgba(56,189,248,0.22),transparent_62%)] blur-2xl opacity-95 transition-opacity group-hover:opacity-100" />
            {compact ? (
              <span className="relative grid h-11 w-11 place-items-center rounded-2xl border border-sky-400/18 bg-white/5 text-zinc-50 shadow-[0_20px_70px_-46px_rgba(56,189,248,0.70)]">
                <span className="pointer-events-none absolute -inset-2 rounded-[22px] bg-[radial-gradient(60px_60px_at_50%_40%,rgba(34,211,238,0.38),transparent_62%)] blur-xl" />
                <svg viewBox="0 0 200 200" className="relative h-9 w-9 drop-shadow-[0_10px_22px_rgba(56,189,248,0.35)]" aria-label={t('app_name')}>
                  <defs>
                    <linearGradient id="elorideMarkGradDash" x1="20" y1="40" x2="180" y2="160" gradientUnits="userSpaceOnUse">
                      <stop offset="0" stopColor="#1d4ed8" />
                      <stop offset="0.55" stopColor="#06b6d4" />
                      <stop offset="1" stopColor="#22d3ee" />
                    </linearGradient>
                  </defs>
                  <g fill="none" stroke="url(#elorideMarkGradDash)" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M50 70c22-26 64-26 86 0" />
                    <path d="M50 100h96l-16-16m16 16-16 16" />
                    <path d="M50 130c22 26 64 26 86 0" />
                    <path d="M70 70v60" />
                  </g>
                </svg>
              </span>
            ) : (
              <span className="relative w-full py-2">
                <span className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-[0_18px_70px_-52px_rgba(56,189,248,0.35)] transition group-hover:border-sky-400/25 group-hover:bg-sky-500/10">
                  <svg viewBox="0 0 200 200" className="h-10 w-10 shrink-0 drop-shadow-[0_18px_40px_rgba(56,189,248,0.35)]" aria-hidden="true">
                    <defs>
                      <linearGradient id="elorideMarkGradDashWord" x1="20" y1="40" x2="180" y2="160" gradientUnits="userSpaceOnUse">
                        <stop offset="0" stopColor="#1d4ed8" />
                        <stop offset="0.55" stopColor="#06b6d4" />
                        <stop offset="1" stopColor="#22d3ee" />
                      </linearGradient>
                    </defs>
                    <g fill="none" stroke="url(#elorideMarkGradDashWord)" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M50 70c22-26 64-26 86 0" />
                      <path d="M50 100h96l-16-16m16 16-16 16" />
                      <path d="M50 130c22 26 64 26 86 0" />
                      <path d="M70 70v60" />
                    </g>
                  </svg>
                  <span className="min-w-0 text-left">
                    <span className="block whitespace-nowrap text-[16px] font-black leading-none tracking-[0.18em] text-white">ELORIDE</span>
                    <span className="mt-1 block truncate text-[10px] font-semibold leading-none tracking-[0.12em] text-white/70">
                      MOD YOUR RIDE • SYSTEM CUSTOMS
                    </span>
                  </span>
                </span>
              </span>
            )}
          </Link>
        </div>

        <div className="relative mt-5">
          <div className={`${compact ? 'sr-only' : 'px-1 text-[11px] font-semibold tracking-[0.22em] text-zinc-500'}`}>{t('sidebar_section_menu')}</div>
          <div className="mt-3 grid gap-2.5">
            <SidebarNavItem to="/dashboard" label={t('nav_home')} icon="home" />
            <SidebarNavItem to="/custom" label={t('nav_custom')} icon="custom" />
            <SidebarNavItem to="/marketplace" label={t('nav_marketplace')} icon="market" />
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
            </div>
          </div>
        ) : null}
      </aside>
    );
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-zinc-950 text-zinc-100">
      {(() => {
        const path = String(loc?.pathname || '');
        const isProfile = path === '/profile' || path.startsWith('/profile/');
        const showSidebar = !isProfile;
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

      {isHome && accountOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-transparent"
          aria-label={t('seller_common_close')}
          onClick={() => setAccountOpen(false)}
        />
      ) : null}

      {isHome ? (
        <div className="fixed right-4 top-4 z-50 flex items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 shadow-[0_12px_40px_-26px_rgba(0,0,0,0.75)] transition hover:bg-white/10"
          >
            {lang === 'vi' ? t('lang_en') : t('lang_vi')}
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setAccountOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 shadow-[0_12px_40px_-26px_rgba(0,0,0,0.75)] transition hover:bg-white/10"
            >
              <span className="grid h-7 w-7 place-items-center rounded-xl border border-white/10 bg-black/20 text-[11px] font-black text-white/90">
                {userInitials}
              </span>
              <span className="hidden max-w-[160px] truncate sm:block">{userLabel || t('common_account')}</span>
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
      ) : null}

      {showSidebar ? (
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
          {isHome ? (
            <div className="mb-5 flex justify-center">
              <div className="w-full max-w-[560px]">
                <SearchBar />
              </div>
            </div>
          ) : null}
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
