import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { resetByCode, resetPassword } from '../services/api/auth.js';
import { useI18n } from '../services/i18n.jsx';

const ResetPassword = () => {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { t } = useI18n();
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const wrapRef = useRef(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const mxSmooth = useSpring(mx, { stiffness: 90, damping: 16, mass: 0.7 });
  const mySmooth = useSpring(my, { stiffness: 90, damping: 16, mass: 0.7 });
  const bgX = useTransform(mxSmooth, (v) => v * -0.22);
  const bgY = useTransform(mySmooth, (v) => v * -0.18);

  useEffect(() => {
    const nextToken = params.get('token') || '';
    const nextEmail = params.get('email') || '';
    setToken(nextToken);
    setEmail(nextEmail);
  }, [params]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = (e.clientX - cx) / Math.max(r.width, 1);
      const dy = (e.clientY - cy) / Math.max(r.height, 1);
      mx.set(Math.max(-1, Math.min(1, dx)) * 24);
      my.set(Math.max(-1, Math.min(1, dy)) * 18);
    };
    const onLeave = () => {
      mx.set(0);
      my.set(0);
    };
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, [mx, my]);

  const friendlyError = (code) => {
    const c = String(code || '').trim();
    if (!c) return '';
    if (c === 'INVALID_TOKEN') return t('auth_invalid_token');
    if (c === 'INVALID_CODE') return t('auth_invalid_code');
    if (c === 'MISSING_EMAIL') return t('auth_missing_email');
    if (c === 'WEAK_PASSWORD') return t('auth_weak_password');
    if (c === 'PASSWORDS_NOT_MATCH') return t('auth_passwords_not_match');
    return c;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('WEAK_PASSWORD');
      return;
    }
    if (password !== confirm) {
      setError('PASSWORDS_NOT_MATCH');
      return;
    }
    setLoading(true);
    try {
      if (token) {
        await resetPassword({ token, newPassword: password });
      } else {
        if (!String(email || '').trim()) {
          setError('MISSING_EMAIL');
          return;
        }
        if (String(code || '').trim().length !== 6) {
          setError('INVALID_CODE');
          return;
        }
        await resetByCode({ email, code, newPassword: password });
      }
      setDone(true);
      setTimeout(() => nav('/login'), 1200);
    } catch (err) {
      setError(err?.message || 'REQUEST_FAILED');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={wrapRef} className="-mx-4 -my-6 relative min-h-[100svh] overflow-hidden bg-black">
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute inset-0 bg-[url('/bg/register-bike.jpg')] bg-cover bg-center brightness-[1.06] contrast-[1.14] saturate-[1.14] blur-[1px] scale-[1.04] opacity-70"
          style={{ x: bgX, y: bgY }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.06)_0%,rgba(0,0,0,0.52)_62%,rgba(0,0,0,0.92)_100%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-black/35 to-black/90" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_52%_30%,rgba(56,189,248,0.26),transparent_58%),radial-gradient(circle_at_22%_82%,rgba(34,211,238,0.14),transparent_62%)] opacity-90 mix-blend-screen" />
        <div className="absolute -left-28 -top-28 h-[26rem] w-[26rem] rounded-full bg-sky-500/18 blur-[110px]" />
        <div className="absolute -right-28 -bottom-28 h-[28rem] w-[28rem] rounded-full bg-cyan-500/14 blur-[110px]" />
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.18)_1px,transparent_1px)] bg-[size:160px_160px] opacity-10 animate-pulse" />
        <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent,rgba(56,189,248,0.16),transparent)] opacity-30 blur-2xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,.06)_1px,transparent_1px)] bg-[size:44px_44px] opacity-[0.14]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative mx-auto flex min-h-[100svh] max-w-7xl items-center justify-center px-4 py-16"
      >
        <div className="w-full max-w-md">
          <div className="relative">
            <div className="absolute -inset-1 rounded-[1.75rem] bg-gradient-to-r from-sky-500/26 via-cyan-500/20 to-sky-500/26 blur-xl" />
            <div className="relative overflow-hidden rounded-[1.75rem] border border-white/15 bg-black/45 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_26px_90px_-45px_rgba(0,0,0,0.90),0_0_60px_rgba(14,165,233,0.16)] backdrop-blur-2xl">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_28%_16%,rgba(255,255,255,0.10),transparent_48%)]" />

              <div className="relative space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold tracking-wide text-sky-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-300 shadow-[0_0_18px_rgba(56,189,248,0.55)]" />
                  {t('auth_section_label')}
                </div>
                <h1 className="text-3xl font-black tracking-tight text-zinc-50">{t('auth_reset_title')}</h1>
                <div className="h-px w-20 bg-gradient-to-r from-sky-300/90 via-cyan-400/70 to-transparent" />
              </div>

              {done ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  className="relative mt-6 space-y-4"
                >
                  <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-sky-500/25 bg-sky-500/12 shadow-[0_0_24px_rgba(56,189,248,0.25)]">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-sky-200">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-zinc-50">{t('auth_reset_success')}</div>
                      <div className="mt-1 text-xs text-zinc-300">{t('auth_redirect_login_hint')}</div>
                    </div>
                  </div>

                  <Link to="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-sky-300 transition hover:text-sky-200">
                    {t('auth_back_to_login')}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </Link>
                </motion.div>
              ) : (
                <form onSubmit={onSubmit} className="relative mt-6 space-y-4">
                  {!token ? (
                    <>
                      <label className="block">
                        <div className="mb-1.5 text-sm font-semibold text-zinc-200">{t('common_email')}</div>
                        <div className="relative">
                          <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(500px_200px_at_10%_0%,rgba(56,189,248,0.10),transparent_60%)]" />
                          <input
                            className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-sky-400/70 focus:shadow-[0_0_0_3px_rgba(56,189,248,0.18)]"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoComplete="email"
                            placeholder="you@example.com"
                            required
                          />
                        </div>
                      </label>

                      <label className="block">
                        <div className="mb-1.5 text-sm font-semibold text-zinc-200">{t('auth_code_label')}</div>
                        <div className="relative">
                          <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(500px_200px_at_10%_0%,rgba(34,211,238,0.10),transparent_60%)]" />
                          <input
                            className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-400/60 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.16)]"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={6}
                            value={code}
                            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="123456"
                            required
                          />
                        </div>
                      </label>
                    </>
                  ) : null}

                  <label className="block">
                    <div className="mb-1.5 text-sm font-semibold text-zinc-200">{t('auth_new_password')}</div>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(500px_200px_at_10%_0%,rgba(56,189,248,0.10),transparent_60%)]" />
                      <input
                        className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-sky-400/70 focus:shadow-[0_0_0_3px_rgba(56,189,248,0.18)]"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
                        required
                      />
                    </div>
                  </label>

                  <label className="block">
                    <div className="mb-1.5 text-sm font-semibold text-zinc-200">{t('auth_confirm_password')}</div>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(500px_200px_at_10%_0%,rgba(34,211,238,0.10),transparent_60%)]" />
                      <input
                        className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-400/60 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.16)]"
                        type="password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        autoComplete="new-password"
                        required
                      />
                    </div>
                  </label>

                  {error ? (
                    <div className="rounded-2xl border border-red-900/40 bg-red-950/30 px-4 py-3 text-sm text-red-200">
                      {t('common_error_prefix')}
                      {friendlyError(error)}
                    </div>
                  ) : null}

                  <button
                    disabled={loading}
                    className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-sky-400 via-cyan-400 to-sky-400 px-4 py-3 text-sm font-bold text-zinc-950 shadow-[0_18px_60px_-30px_rgba(56,189,248,0.65)] transition duration-200 hover:scale-[1.01] hover:from-sky-300 hover:via-cyan-300 hover:to-sky-300 hover:shadow-[0_22px_70px_-30px_rgba(56,189,248,0.75)] disabled:cursor-not-allowed disabled:opacity-60"
                    type="submit"
                  >
                    <span className="pointer-events-none absolute inset-0 opacity-0 transition duration-200 group-hover:opacity-100 bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.45),transparent)]" />
                    <span className="relative inline-flex items-center justify-center gap-2">
                      <span>{loading ? t('auth_processing') : t('auth_reset_btn')}</span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 12h12" />
                        <path d="M13 6l6 6-6 6" />
                      </svg>
                    </span>
                  </button>

                  <div className="flex items-center justify-between text-sm">
                    <Link to="/login" className="font-semibold text-sky-300 transition hover:text-sky-200">
                      {t('auth_back_to_login')}
                    </Link>
                    <Link to="/forgot-password" className="text-zinc-400 transition hover:text-zinc-200">
                      {t('auth_try_another_email')}
                    </Link>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ResetPassword;
