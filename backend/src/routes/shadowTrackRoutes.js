const express = require('express');

const { shadowTrackScan } = require('../controllers/shadowController');

const router = express.Router();

const makeIpRateLimiter = ({ windowMs, maxHits }) => {
  const buckets = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const xf = String(req.headers['x-forwarded-for'] || '').trim();
    const ip = (xf ? xf.split(',')[0].trim() : String(req.ip || '').trim()) || 'unknown';
    const key = `ip:${ip}`;

    const item = buckets.get(key);
    if (!item || now - item.startMs >= windowMs) {
      buckets.set(key, { startMs: now, hits: 1 });
      return next();
    }

    item.hits += 1;
    if (item.hits > maxHits) {
      res.set('Cache-Control', 'no-store');
      return res.status(200).type('text/plain').send('OK');
    }

    return next();
  };
};

const rateLimit = makeIpRateLimiter({ windowMs: 60 * 1000, maxHits: 120 });

router.get('/track/design/:token', rateLimit, shadowTrackScan);
router.post('/track/design/:token', rateLimit, shadowTrackScan);

module.exports = router;
