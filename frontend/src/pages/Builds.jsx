import { Link } from 'react-router-dom';
import { useI18n } from '../services/i18n.jsx';

const Builds = () => {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{t('builds_title')}</h1>
            <div className="mt-1 text-sm text-zinc-400">{t('builds_subtitle')}</div>
          </div>
          <Link to="/" className="text-sm text-emerald-400 hover:text-emerald-300">
            {t('common_back_home')}
          </Link>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5">
            <div className="text-sm font-semibold">{t('builds_my_saved')}</div>
            <div className="mt-1 text-sm text-zinc-400">{t('builds_my_saved_desc')}</div>
            <Link
              to="/my-configs"
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium transition hover:bg-emerald-500"
            >
              {t('builds_open_my')}
            </Link>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5">
            <div className="text-sm font-semibold">{t('builds_trending')}</div>
            <div className="mt-1 text-sm text-zinc-400">{t('builds_trending_desc')}</div>
            <div className="mt-4 text-sm text-zinc-500">{t('builds_coming')}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Builds;
