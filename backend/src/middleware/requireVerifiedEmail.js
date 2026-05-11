const User = require('../models/User');

const cache = new Map();

const getCached = (key) => {
  const v = cache.get(key);
  const now = Date.now();
  const exp = Number(v?.exp) || 0;
  if (!v || !exp || now >= exp) {
    cache.delete(key);
    return null;
  }
  return v;
};

const setCached = (key, val, ttlMs) => {
  cache.set(key, { ...val, exp: Date.now() + Math.max(1_000, ttlMs) });
};

const requireVerifiedEmail = async (req, res, next) => {
  const userId = String(req.user?.id || '').trim();
  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });

  const cached = getCached(userId);
  if (cached) {
    if (cached.emailVerified) return next();
    return res.status(403).json({ error: 'EMAIL_NOT_VERIFIED' });
  }

  const user = await User.findById(userId).select('email emailVerified').lean();
  const email = String(user?.email || '').trim().toLowerCase();
  const effectiveVerified = Boolean(user?.emailVerified) || (email && email.endsWith('@carbanana.local'));
  setCached(userId, { emailVerified: effectiveVerified }, 5 * 60 * 1000);
  if (!effectiveVerified) return res.status(403).json({ error: 'EMAIL_NOT_VERIFIED' });
  return next();
};

module.exports = { requireVerifiedEmail };
