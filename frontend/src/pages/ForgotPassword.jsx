import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { requestReset } from '../services/api/auth.js';
import { useI18n } from '../services/i18n.jsx';

const ForgotPassword = () => {
  const nav = useNavigate();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [resetUrl, setResetUrl] = useState('');
  const wrapRef = useRef(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const mxSmooth = useSpring(mx, { stiffness: 90, damping: 16, mass: 0.7 });
  const mySmooth = useSpring(my, { stiffness: 90, damping: 16, mass: 0.7 });
  const bgX = useTransform(mxSmooth, (v) => v * -0.22);
  const bgY = useTransform(mySmooth, (v) => v * -0.18);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await requestReset({ email });
      setResetUrl(String(data?.resetUrl || '').trim());
      nav(`/reset-password?email=${encodeURIComponent(String(email || '').trim())}`, { replace: true });
    } catch (err) {
      const msg = err?.message || 'REQUEST_FAILED';
      if (msg === 'EMAIL_NOT_FOUND') {
        setError(t('auth_email_not_found'));
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div ref={wrapRef} className="-mx-4 -my-6 relative min-h-[100svh] overflow-hidden bg-black">
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute inset-0 blur-[1px] scale-[1.04] opacity-70"
          style={{
            x: bgX,
            y: bgY,
            backgroundImage: "url('/bg/register-bike.jpg'), url('/register-bike.jpg')",
            backgroundSize: 'cover',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            filter: 'brightness(1.08) contrast(1.16) saturate(1.18)'
          }}
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
                <h1 className="text-3xl font-black tracking-tight text-zinc-50">{t('auth_forgot_title')}</h1>
                <div className="text-sm leading-relaxed text-zinc-300">{t('auth_forgot_subtitle')}</div>
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
                      <div className="text-sm font-semibold text-zinc-50">{t('auth_forgot_sent')}</div>
                      <div className="mt-1 text-xs text-zinc-300">{t('auth_forgot_success_hint')}</div>
                    </div>
                  </div>

                  {resetUrl ? (
                    <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-zinc-200">
                      <div className="text-xs font-semibold text-zinc-300">{t('auth_reset_link_test')}</div>
                      <a href={resetUrl} className="mt-2 block break-all text-sky-300 hover:text-sky-200">
                        {resetUrl}
                      </a>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Link to="/login" className="text-sm font-semibold text-sky-300 transition hover:text-sky-200">
                      {t('auth_back_to_login')}
                    </Link>
                    <Link to="/reset-by-code" className="text-sm font-semibold text-zinc-200 transition hover:text-white">
                      {t('auth_or_enter_code')} <span className="text-sky-300">{t('auth_here')}</span>
                    </Link>
                  </div>
                </motion.div>
              ) : (
                <form onSubmit={onSubmit} className="relative mt-6 space-y-4">
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

                  {error ? (
                    <div className="rounded-2xl border border-red-900/40 bg-red-950/30 px-4 py-3 text-sm text-red-200">
                      {t('common_error_prefix')}
                      {error}
                    </div>
                  ) : null}

                  <button
                    disabled={loading}
                    className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-sky-400 via-cyan-400 to-sky-400 px-4 py-3 text-sm font-bold text-zinc-950 shadow-[0_18px_60px_-30px_rgba(56,189,248,0.65)] transition duration-200 hover:scale-[1.01] hover:from-sky-300 hover:via-cyan-300 hover:to-sky-300 hover:shadow-[0_22px_70px_-30px_rgba(56,189,248,0.75)] disabled:cursor-not-allowed disabled:opacity-60"
                    type="submit"
                  >
                    <span className="pointer-events-none absolute inset-0 opacity-0 transition duration-200 group-hover:opacity-100 bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.45),transparent)]" />
                    <span className="relative inline-flex items-center justify-center gap-2">
                      <span>{loading ? t('auth_processing') : t('auth_send_reset_link')}</span>
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
                    <Link to="/" className="text-zinc-400 transition hover:text-zinc-200">
                      {t('common_back_to_landing')}
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

export default ForgotPassword;
