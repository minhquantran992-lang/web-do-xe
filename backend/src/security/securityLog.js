const SecurityEvent = require('../models/SecurityEvent');

const safeStr = (v, max = 500) => {
  const s = String(v ?? '').trim();
  if (!s) return '';
  return s.length > max ? s.slice(0, max) : s;
};

const toObjectIdOrNull = (v) => {
  try {
    return v ? String(v) : null;
  } catch {
    return null;
  }
};

const logSecurityEvent = async ({ req, kind, outcome, score = 0, meta = {} }) => {
  try {
    const ip = safeStr(req?.clientIp || req?.ip || '');
    const endpoint = safeStr(req?.originalUrl || req?.url || '', 300);
    const method = safeStr(req?.method || '', 20);
    const ua = safeStr(req?.headers?.['user-agent'] || '', 300);
    const userIdRaw = req?.user?.id || null;
    const userId = toObjectIdOrNull(userIdRaw);

    await SecurityEvent.create({
      at: new Date(),
      kind: safeStr(kind, 120),
      outcome: safeStr(outcome, 120),
      endpoint,
      method,
      ip,
      userId,
      ua,
      score: Number.isFinite(Number(score)) ? Number(score) : 0,
      meta: meta && typeof meta === 'object' ? meta : {}
    });
  } catch {}
};

module.exports = { logSecurityEvent };
