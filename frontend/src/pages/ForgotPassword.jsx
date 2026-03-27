import { useState } from 'react';
import { requestReset } from '../services/api/auth.js';
import { useI18n } from '../services/i18n.jsx';

const ForgotPassword = () => {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [resetUrl, setResetUrl] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await requestReset({ email });
      setDone(true);
      setResetUrl(String(data?.resetUrl || ''));
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

  return (
    <div className="mx-auto max-w-md space-y-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
      <h1 className="text-xl font-semibold">{t('auth_forgot_title')}</h1>
      {done ? (
        <div className="space-y-2 text-sm text-zinc-300">
          <p>{t('auth_forgot_sent')}</p>
          {resetUrl ? (
            <p>
              {t('auth_reset_link_test')}{' '}
              <a href={resetUrl} className="text-emerald-400 hover:text-emerald-300">
                {resetUrl}
              </a>
            </p>
          ) : null}
          <p>
            {t('auth_or_enter_code')}{' '}
            <a href="/reset-by-code" className="text-emerald-400 hover:text-emerald-300">
              {t('auth_here')}
            </a>
            .
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-zinc-300">{t('common_email')}</span>
            <input
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-600"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
            />
          </label>
          {error ? <div className="text-sm text-red-400">{t('common_error_prefix')}{error}</div> : null}
          <button
            disabled={loading}
            className="w-full rounded bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-60"
          >
            {loading ? t('auth_processing') : t('auth_send_reset_link')}
          </button>
        </form>
      )}
    </div>
  );
};

export default ForgotPassword;
