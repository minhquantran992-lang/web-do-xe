const mongoose = require('mongoose');
const SecurityEvent = require('../models/SecurityEvent');
const { asyncHandler } = require('../middleware/asyncHandler');

const clampLimit = (v, def = 50, min = 1, max = 200) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.floor(n)));
};

const listSecurityEvents = asyncHandler(async (req, res) => {
  const kind = String(req.query?.kind || '').trim();
  const ip = String(req.query?.ip || '').trim();
  const userIdRaw = String(req.query?.userId || '').trim();
  const outcome = String(req.query?.outcome || '').trim();
  const beforeRaw = String(req.query?.before || '').trim();
  const before = beforeRaw ? new Date(beforeRaw) : null;
  const beforeOk = before && !Number.isNaN(before.getTime());
  const limit = clampLimit(req.query?.limit, 60, 1, 200);

  const q = {
    ...(kind ? { kind } : {}),
    ...(ip ? { ip } : {}),
    ...(outcome ? { outcome } : {}),
    ...(mongoose.isValidObjectId(userIdRaw) ? { userId: new mongoose.Types.ObjectId(userIdRaw) } : {}),
    ...(beforeOk ? { at: { $lt: before } } : {})
  };

  const rows = await SecurityEvent.find(q).sort({ at: -1 }).limit(limit).lean();
  const nextBefore = rows.length ? rows[rows.length - 1].at : null;

  res.json({
    items: rows.map((e) => ({
      _id: e._id,
      at: e.at,
      kind: String(e.kind || ''),
      outcome: String(e.outcome || ''),
      endpoint: String(e.endpoint || ''),
      method: String(e.method || ''),
      ip: String(e.ip || ''),
      userId: e.userId || null,
      ua: String(e.ua || ''),
      score: Number(e.score) || 0,
      meta: e.meta && typeof e.meta === 'object' ? e.meta : {}
    })),
    nextBefore
  });
});

module.exports = { listSecurityEvents };
