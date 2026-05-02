import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPublicConfigurations } from '../services/api/configurations.js';
import { useI18n } from '../services/i18n.jsx';

const Builds = () => {
  const { t } = useI18n();
  const [publicBuilds, setPublicBuilds] = useState([]);
  const [loadingPublic, setLoadingPublic] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoadingPublic(true);
    getPublicConfigurations({ limit: 12 })
      .then((items) => {
        if (!alive) return;
        setPublicBuilds(Array.isArray(items) ? items : []);
      })
      .catch(() => {
        if (!alive) return;
        setPublicBuilds([]);
      })
      .finally(() => {
        if (!alive) return;
        setLoadingPublic(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{t('builds_title')}</h1>
            <div className="mt-1 text-sm text-zinc-400">{t('builds_subtitle')}</div>
          </div>
          <Link to="/" className="text-sm text-sky-300 hover:text-sky-200">
            {t('common_back_home')}
          </Link>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5">
            <div className="text-sm font-semibold">{t('builds_my_saved')}</div>
            <div className="mt-1 text-sm text-zinc-400">{t('builds_my_saved_desc')}</div>
            <Link
              to="/my-configs"
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-sky-400 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-sky-300"
            >
              {t('builds_open_my')}
            </Link>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold">{t('builds_trending')}</div>
                <div className="mt-1 text-sm text-zinc-400">{t('builds_trending_desc')}</div>
              </div>
              <Link
                to="/leaderboard"
                className="shrink-0 inline-flex items-center justify-center rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs font-semibold text-white/90 transition hover:bg-black/35"
              >
                {t('builds_open_leaderboard')}
              </Link>
            </div>
            {loadingPublic ? (
              <div className="mt-4 text-sm text-zinc-500">{t('common_loading')}</div>
            ) : publicBuilds.length ? (
              <div className="mt-4 space-y-2">
                {publicBuilds.slice(0, 6).map((b) => {
                  const carName = b?.carId?.name || '';
                  const buildName = String(b?.name || '').trim();
                  const userName = b?.userId?.name || '';
                  const partsCount = (Array.isArray(b?.selectedParts) ? b.selectedParts.length : 0) + (b?.selectedWheels ? 1 : 0);
                  const title = buildName || carName || t('carcard_default');
                  return (
                    <Link
                      key={b?._id}
                      to={`/builds/${encodeURIComponent(String(b?._id || ''))}`}
                      className="block rounded-lg border border-zinc-800 bg-black/20 px-3 py-2 transition hover:border-sky-400/25 hover:bg-black/30"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-zinc-100">{title}</div>
                          <div className="mt-0.5 truncate text-xs text-zinc-400">
                            {userName ? `${userName} • ` : ''}
                            {partsCount} {t('landing_parts_unit')}
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 text-sm text-zinc-500">{t('builds_public_empty')}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Builds;
