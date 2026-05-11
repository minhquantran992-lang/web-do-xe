const crypto = require('crypto');

const createCsrfToken = () => crypto.randomBytes(24).toString('hex');

const requireCsrf = (req, res, next) => {
  const cookieToken = String(req.cookies?.csrfToken || '').trim();
  const headerToken = String(req.headers['x-csrf-token'] || '').trim();
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: 'CSRF_BLOCKED' });
  }
  return next();
};

module.exports = { createCsrfToken, requireCsrf };
