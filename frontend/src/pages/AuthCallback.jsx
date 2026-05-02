import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../services/auth/AuthContext.jsx';
import { useI18n } from '../services/i18n.jsx';
import { resendOAuthOtp, verifyOAuthOtp } from '../services/api/auth.js';

const decodeJwtPayload = (token) => {
  try {
    const parts = String(token || '').split('.');
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=');
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
};

const AuthCallback = () => {
  const nav = useNavigate();
  const { setAuth } = useAuth();
  const { t } = useI18n();
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [otp, setOtp] = useState('');
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpResendBusy, setOtpResendBusy] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const token = params.get('token') || '';
  const error = params.get('error') || '';
  const requiresOtp = params.get('otp') === '1';
  const ticket = params.get('ticket') || '';

  const AuthBackdrop = () => (
    <div className="pointer-events-none fixed inset-0 -z-10">
      <div
        className="absolute inset-0 -z-20"
        style={{
          backgroundImage: "url('/bg/login-car.jpg'), url('/login-car.jpg')",
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          filter: 'brightness(0.58) saturate(1.08)'
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: 'rgba(0,0,0,0.62)',
          backgroundImage:
            'radial-gradient(1200px 1200px at 18% 12%, rgba(56,189,248,0.28), transparent 70%), radial-gradient(1100px 1100px at 82% 88%, rgba(34,211,238,0.14), transparent 70%)'
        }}
      />
      <div className="absolute inset-0 opacity-[0.10] [background-image:linear-gradient(transparent_97%,rgba(255,255,255,0.10)_98%),linear-gradient(90deg,transparent_97%,rgba(255,255,255,0.10)_98%)] [background-size:20px_20px]" />
      <div className="absolute inset-0 opacity-[0.08] [background-image:repeating-linear-gradient(45deg,rgba(255,255,255,0.08)_0_5px,transparent_5px_14px)]" />
      <div className="absolute left-1/2 top-[42%] h-[120vh] w-[120vh] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.24)_0%,transparent_62%)] opacity-70 blur-3xl" />
    </div>
  );

  useEffect(() => {
    const next = sessionStorage.getItem('post_auth_redirect') || '/dashboard';

    if (error) {
      sessionStorage.removeItem('post_auth_redirect');
      setStatus('error');
      setMessage(error);
      return;
    }

    if (requiresOtp) {
      if (!ticket) {
        sessionStorage.removeItem('post_auth_redirect');
        setStatus('error');
        setMessage('MISSING_TICKET');
        return;
      }
      setStatus('otp');
      return;
    }

    if (!token) {
      sessionStorage.removeItem('post_auth_redirect');
      setStatus('error');
      setMessage('MISSING_TOKEN');
      return;
    }

    const payload = decodeJwtPayload(token);
    const user = payload
      ? {
          id: payload.sub || '',
          email: String(payload.email || '').trim(),
          isAdmin: Boolean(payload.isAdmin),
          role: String(payload.role || '').trim() || (Boolean(payload.isAdmin) ? 'ADMIN' : 'USER')
        }
      : null;

    setAuth({ token, user });
    setStatus('done');
    sessionStorage.removeItem('post_auth_redirect');
    nav(next, { replace: true });
  }, [error, nav, requiresOtp, setAuth, ticket, token]);

  useEffect(() => {
    if (status !== 'otp') return;
    if (!resendCooldown) return;
    const id = window.setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(id);
  }, [resendCooldown, status]);

  const onVerifyOtp = async (e) => {
    e.preventDefault();
    if (!ticket) return;
    const code = String(otp || '').replace(/[^\d]/g, '').slice(0, 6);
    if (code.length !== 6) {
      setNotice('');
      setMessage('INVALID_OTP');
      return;
    }
    setOtpBusy(true);
    setMessage('');
    setNotice('');
    try {
      const data = await verifyOAuthOtp({ ticket, code });
      setAuth({ token: data.token, user: data.user });
      const next = sessionStorage.getItem('post_auth_redirect') || '/dashboard';
      sessionStorage.removeItem('post_auth_redirect');
      nav(next, { replace: true });
    } catch (err) {
      setMessage(err?.message || 'INVALID_OTP');
    } finally {
      setOtpBusy(false);
    }
  };

  const onResendOtp = async () => {
    if (!ticket) return;
    if (otpResendBusy || resendCooldown) return;
    setOtpResendBusy(true);
    setMessage('');
    setNotice('');
    try {
      await resendOAuthOtp({ ticket });
      setResendCooldown(30);
      setNotice(t('auth_oauth_otp_resent'));
    } catch (err) {
      setMessage(err?.message || 'RESEND_FAILED');
    } finally {
      setOtpResendBusy(false);
    }
  };

  if (status === 'processing') {
    return (
      <div className="relative mx-auto flex min-h-[100svh] max-w-5xl items-center justify-center px-4">
        <AuthBackdrop />
        <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6 text-center text-sm text-zinc-300 shadow-2xl shadow-black/40 backdrop-blur-md">
          {t('auth_oauth_processing')}
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="relative mx-auto flex min-h-[100svh] max-w-5xl items-center justify-center px-4">
        <AuthBackdrop />
        <div className="w-full max-w-md space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6 shadow-2xl shadow-black/40 backdrop-blur-md">
          <div className="text-lg font-semibold">{t('auth_oauth_failed_title')}</div>
          <div className="text-sm text-zinc-400">{message || 'OAUTH_FAILED'}</div>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-xl bg-sky-400 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-sky-300"
            >
              {t('auth_back_to_login')}
            </Link>
            <Link to="/" className="text-sm text-zinc-300 hover:text-white">
              {t('common_back_home')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'otp') {
    const otpValue = String(otp || '').replace(/[^\d]/g, '').slice(0, 6);
    const resendLabel = resendCooldown ? t('auth_oauth_otp_resend_in', { sec: resendCooldown }) : t('auth_oauth_otp_resend');
    return (
      <div className="relative mx-auto flex min-h-[90vh] max-w-5xl items-center justify-center px-4">
        <AuthBackdrop />
        <div className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/60 shadow-2xl shadow-black/40 backdrop-blur-md">
          <div className="relative p-6">
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,#38bdf8_0%,transparent_48%)] opacity-40" />
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-400/15 ring-1 ring-sky-300/25">
                <div className="h-2.5 w-2.5 rounded-full bg-sky-300" />
              </div>
              <div className="min-w-0">
                <div className="text-lg font-semibold text-zinc-100">{t('auth_oauth_otp_title')}</div>
                <div className="mt-1 text-sm text-zinc-400">{t('auth_oauth_otp_desc')}</div>
              </div>
            </div>

            <form onSubmit={onVerifyOtp} className="mt-6 space-y-3">
              <div className="rounded-2xl border-2 border-white/90 bg-white/10 p-2">
                <div className="rounded-xl border border-zinc-300 bg-white p-3">
                  <input
                    value={otpValue}
                    onChange={(e) => {
                      setOtp(e.target.value);
                      setMessage('');
                      setNotice('');
                    }}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="••••••"
                    className="w-full bg-transparent text-center text-[20px] font-semibold tracking-[0.35em] text-zinc-900 outline-none placeholder:text-zinc-400"
                  />
                  <div className="mt-1 text-center text-[12px] text-zinc-600">
                    {t('auth_oauth_otp_hint')} • {t('auth_oauth_otp_expires')}
                  </div>
                </div>
              </div>

              {message ? <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">{message}</div> : null}
              {notice ? <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{notice}</div> : null}

              <button
                disabled={otpBusy || otpValue.length !== 6}
                className="w-full rounded-xl bg-sky-400 px-4 py-3 text-sm font-semibold text-zinc-950 hover:bg-sky-300 disabled:opacity-60"
              >
                {otpBusy ? t('auth_processing') : t('auth_oauth_otp_submit')}
              </button>
            </form>

            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={otpResendBusy || Boolean(resendCooldown)}
                onClick={onResendOtp}
                className="text-sm font-semibold text-sky-300 hover:text-sky-200 disabled:opacity-60"
              >
                {resendLabel}
              </button>
              <Link to="/login" className="text-sm text-zinc-300 hover:text-white">
                {t('auth_back_to_login')}
              </Link>
            </div>

            <div className="mt-3 text-xs text-zinc-500">{t('auth_oauth_otp_spam')}</div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default AuthCallback;
