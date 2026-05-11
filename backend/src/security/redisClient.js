const Redis = require('ioredis');

let _redis = null;
let _redisInit = false;

const getRedisUrl = () => {
  const url = String(process.env.REDIS_URL || '').trim();
  return url || '';
};

const getRedis = () => {
  if (_redisInit) return _redis;
  _redisInit = true;

  const url = getRedisUrl();
  if (!url) {
    _redis = null;
    return _redis;
  }

  try {
    _redis = new Redis(url, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      lazyConnect: true
    });
    _redis.on('error', () => {});
    _redis.connect().catch(() => {});
    return _redis;
  } catch {
    _redis = null;
    return _redis;
  }
};

module.exports = { getRedis };
