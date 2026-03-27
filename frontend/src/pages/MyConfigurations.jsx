import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../services/auth/AuthContext.jsx';
import { getMyConfigurations } from '../services/api/configurations.js';
import { useI18n } from '../services/i18n.jsx';

const MyConfigurations = () => {
  const { t } = useI18n();
  const { token, isAuthed } = useAuth();
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!isAuthed) {
      setLoading(false);
      setItems([]);
      return undefined;
    }

    setLoading(true);
    getMyConfigurations({ token })
      .then((data) => {
        if (!alive) return;
        setItems(data);
        setError('');
      })
      .catch((e) => {
        if (!alive) return;
        setError(e?.message || 'FAILED_TO_LOAD');
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [isAuthed, token]);

  if (!isAuthed) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="text-zinc-300">{t('my_builds_login_req')}</div>
        <div className="mt-3">
          <Link to="/login" className="rounded bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500">
            {t('nav_login')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{t('my_builds_title')}</h1>
      {loading ? <div className="text-zinc-400">{t('common_loading')}</div> : null}
      {error ? <div className="text-red-400">{t('common_error')}: {error}</div> : null}

      <div className="space-y-3">
        {items.map((c) => (
          <div key={c._id} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold">{c.name || 'Untitled'}</div>
                <div className="text-sm text-zinc-400">{c.carId?.name || 'Unknown car'}</div>
              </div>
              {c.carId?._id ? (
                <Link
                  to={`/configurator/${c.carId._id}`}
                  className="rounded bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700"
                >
                  {t('my_builds_open_config')}
                </Link>
              ) : null}
            </div>
            <div className="mt-3 text-sm text-zinc-300">
              <div>{t('cfg_color')}: {c.selectedColor}</div>
              <div>Wheels: {c.selectedWheels?.name || '-'}</div>
              <div>Parts: {Array.isArray(c.selectedParts) && c.selectedParts.length ? c.selectedParts.map((p) => p.name).join(', ') : '-'}</div>
            </div>
          </div>
        ))}
        {!loading && items.length === 0 ? <div className="text-zinc-400">{t('my_builds_empty')}</div> : null}
      </div>
    </div>
  );
};

export default MyConfigurations;
