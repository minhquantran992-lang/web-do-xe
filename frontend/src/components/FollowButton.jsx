import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getFollowStatus, toggleFollow } from '../services/api/follow.js';
import { useAuth } from '../services/auth/AuthContext.jsx';
import { useI18n } from '../services/i18n.jsx';

const FollowButton = ({ itemType, itemId, size = 'sm' }) => {
  const { t } = useI18n();
  const { token } = useAuth();
  const loc = useLocation();
  const [loading, setLoading] = useState(false);
  const [following, setFollowing] = useState(false);

  const next = useMemo(() => `${loc.pathname}${loc.search}`, [loc.pathname, loc.search]);

  useEffect(() => {
    const id = String(itemId || '').trim();
    const type = String(itemType || '').trim();
    if (!token || !id || !type) return;
    let alive = true;
    getFollowStatus({ token, itemType: type, itemId: id })
      .then((data) => {
        if (!alive) return;
        setFollowing(Boolean(data?.following));
      })
      .catch(() => {})
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [itemId, itemType, token]);

  const cls =
    size === 'xs'
      ? 'rounded-xl px-3 py-2 text-xs'
      : 'rounded-2xl px-4 py-2.5 text-sm';

  if (!token) {
    return (
      <Link
        to={`/login?next=${encodeURIComponent(next)}`}
        className={`${cls} inline-flex items-center justify-center border border-white/10 bg-white/5 font-semibold text-zinc-200 transition hover:bg-white/10`}
      >
        {t('follow_btn_follow')}
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={async () => {
        const id = String(itemId || '').trim();
        const type = String(itemType || '').trim();
        if (!token || !id || !type || loading) return;
        setLoading(true);
        try {
          const data = await toggleFollow({ token, itemType: type, itemId: id });
          setFollowing(Boolean(data?.following));
        } catch {}
        setLoading(false);
      }}
      className={`${cls} inline-flex items-center justify-center border font-semibold transition ${
        following
          ? 'border-sky-400/25 bg-sky-500/10 text-sky-100 hover:bg-sky-500/15'
          : 'border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10'
      } disabled:opacity-60`}
    >
      {following ? t('follow_btn_following') : t('follow_btn_follow')}
    </button>
  );
};

export default FollowButton;

