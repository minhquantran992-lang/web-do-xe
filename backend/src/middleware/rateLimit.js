const { RateLimiterMemory, RateLimiterRedis } = require('rate-limiter-flexible');
const { getRedis } = require('../security/redisClient');
const { logSecurityEvent } = require('../security/securityLog');

const limiterCache = new Map();

const safeKey = (v) =>
  String(v ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9:_-]/g, '')
    .slice(0, 180);

const getLimiter = ({ keyPrefix, points, durationSec, blockDurationSec = 0 }) => {
  const k = `${safeKey(keyPrefix)}:${Number(points)}:${Number(durationSec)}:${Number(blockDurationSec)}`;
  const existing = limiterCache.get(k);
  if (existing) return existing;

  const redis = getRedis();
  const opts = {
    keyPrefix: safeKey(keyPrefix || 'rl'),
    points: Math.max(1, Math.floor(Number(points) || 1)),
    duration: Math.max(1, Math.floor(Number(durationSec) || 60)),
    blockDuration: Math.max(0, Math.floor(Number(blockDurationSec) || 0))
  };

  const limiter = redis
    ? new RateLimiterRedis({
        storeClient: redis,
        ...opts
      })
    : new RateLimiterMemory(opts);

  limiterCache.set(k, limiter);
  return limiter;
};

const rateLimit = ({ name, keyPrefix, points, durationSec, blockDurationSec, keyFn, weight = 1 }) => {
  const limiter = getLimiter({ keyPrefix: keyPrefix || name || 'rl', points, durationSec, blockDurationSec });
  return async (req, res, next) => {
    const keyRaw = keyFn ? keyFn(req) : '';
    const key = safeKey(keyRaw);
    if (!key) return next();

    try {
      await limiter.consume(key, Math.max(1, Math.floor(Number(weight) || 1)));
      return next();
    } catch (rej) {
      const ms = Number(rej?.msBeforeNext) || 0;
      const retryAfterMs = Math.max(250, ms);
      res.set('Retry-After', String(Math.max(1, Math.ceil(retryAfterMs / 1000))));
      await logSecurityEvent({
        req,
        kind: 'rate_limit',
        outcome: 'blocked',
        score: 40,
        meta: { name: String(name || keyPrefix || ''), retryAfterMs }
      });
      return res.status(429).json({ error: 'RATE_LIMITED', retryAfterMs });
    }
  };
};

const compose = (...middlewares) => {
  const list = middlewares.flat().filter(Boolean);
  return async (req, res, next) => {
    let idx = 0;
    const run = async () => {
      const mw = list[idx++];
      if (!mw) return next();
      return mw(req, res, (err) => {
        if (err) return next(err);
        return run();
      });
    };
    return run();
  };
};

module.exports = { rateLimit, compose };
