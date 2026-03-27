import { useState } from 'react';
import { resetByCode } from '../services/api/auth.js';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '../services/i18n.jsx';

const ResetByCode = () => {
  const nav = useNavigate();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('PASSWORDS_NOT_MATCH');
      return;
    }
    setLoading(true);
    try {
      await resetByCode({ email, code, newPassword: password });
      setDone(true);
      setTimeout(() => nav('/login'), 1200);
    } catch (err) {
      setError(err?.message || 'REQUEST_FAILED');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
      <h1 className="text-xl font-semibold">{t('auth_reset_by_code_title')}</h1>
      {done ? (
        <div className="text-sm text-emerald-400">{t('auth_reset_success')}</div>
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
          <label className="block text-sm">
            <span className="mb-1 block text-zinc-300">{t('auth_code_label')}</span>
            <input
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-600"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-zinc-300">{t('auth_new_password')}</span>
            <input
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-600"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-zinc-300">{t('auth_confirm_password')}</span>
            <input
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-600"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          {error ? <div className="text-sm text-red-400">{t('common_error_prefix')}{error}</div> : null}
          <button
            disabled={loading}
            className="w-full rounded bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-60"
          >
            {loading ? t('auth_processing') : t('auth_reset_btn')}
          </button>
        </form>
      )}
      <div className="text-sm text-zinc-400">
        {t('auth_no_code')}{' '}
        <Link to="/forgot-password" className="text-emerald-400 hover:text-emerald-300">{t('auth_resend')}</Link>
      </div>
    </div>
  );
};

export default ResetByCode;
