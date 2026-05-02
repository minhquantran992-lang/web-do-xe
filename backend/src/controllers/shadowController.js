const crypto = require('crypto');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const Configuration = require('../models/Configuration');
const ShadowTrackEvent = require('../models/ShadowTrackEvent');
const ShadowAdminAudit = require('../models/ShadowAdminAudit');
const { asyncHandler } = require('../middleware/asyncHandler');
const { sendMail } = require('../services/mailer');

const getShadowSecret = () => String(process.env.SHADOW_TOKEN_SECRET || process.env.JWT_SECRET || '').trim();

const sha256Hex = (input) => crypto.createHash('sha256').update(String(input || '')).digest('hex');

const getIpRaw = (req) => {
  const xf = String(req.headers['x-forwarded-for'] || '').trim();
  if (xf) return xf.split(',')[0].trim();
  const ip = String(req.ip || req.connection?.remoteAddress || '').trim();
  return ip;
};

const getTokenHash = (token) => sha256Hex(`shadow_token:${getShadowSecret()}:${String(token || '')}`);
const getIpHash = (ip) => sha256Hex(`shadow_ip:${getShadowSecret()}:${String(ip || '')}`);
const getUaHash = (ua) => sha256Hex(`shadow_ua:${getShadowSecret()}:${String(ua || '')}`);

const signDesignToken = ({ designId }) => {
  const secret = getShadowSecret();
  if (!secret) {
    const err = new Error('MISSING_SHADOW_SECRET');
    err.statusCode = 500;
    throw err;
  }
  const did = String(designId || '').trim();
  if (!mongoose.isValidObjectId(did)) {
    const err = new Error('INVALID_DESIGN_ID');
    err.statusCode = 400;
    throw err;
  }
  const jti = crypto.randomBytes(16).toString('hex');
  return jwt.sign({ typ: 'SHADOW_DESIGN', did, jti, v: 1 }, secret);
};

const verifyDesignToken = (token) => {
  const secret = getShadowSecret();
  if (!secret) return { ok: false, error: 'MISSING_SHADOW_SECRET' };
  const t = String(token || '').trim();
  if (!t) return { ok: false, error: 'MISSING_TOKEN' };
  try {
    const payload = jwt.verify(t, secret);
    if (String(payload?.typ || '') !== 'SHADOW_DESIGN') return { ok: false, error: 'INVALID_TYPE' };
    const did = String(payload?.did || '').trim();
    if (!mongoose.isValidObjectId(did)) return { ok: false, error: 'INVALID_DESIGN_ID' };
    return { ok: true, designId: did };
  } catch {
    return { ok: false, error: 'INVALID_TOKEN' };
  }
};

const buildSuspicious = ({ recentSameIpCount, recentDistinctDesignCount }) => {
  const reasons = [];
  if (recentSameIpCount >= 30) reasons.push('HIGH_RATE');
  if (recentDistinctDesignCount >= 8) reasons.push('MULTI_DESIGN');
  return { suspicious: reasons.length > 0, reasons };
};

const parseAlertEmails = () => {
  const raw = String(process.env.SHADOW_ALERT_EMAILS || process.env.ADMIN_EMAILS || '')
    .trim()
    .toLowerCase();
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
};

const NOTIFY_STATE = new Map();
const shouldNotify = (key, cooldownMs) => {
  const now = Date.now();
  const prev = Number(NOTIFY_STATE.get(key) || 0);
  if (prev && now - prev < cooldownMs) return false;
  NOTIFY_STATE.set(key, now);
  return true;
};

const sendSuspiciousAlert = async ({ kind, designId, ipHash, reasons, createdAt }) => {
  const emails = parseAlertEmails();
  if (!emails.length) return;
  if (!process.env.SHADOW_ALERT_ENABLED || String(process.env.SHADOW_ALERT_ENABLED).trim() === '0') return;

  const key = `shadow_alert:${String(kind || '')}:${String(designId || '')}:${String(ipHash || '')}`;
  if (!shouldNotify(key, 10 * 60 * 1000)) return;

  const subject = `eloride • Shadow Alert • ${String(kind || 'SUSPICIOUS')}`;
  const lines = [
    `Type: ${String(kind || '')}`,
    designId ? `DesignID: ${String(designId)}` : null,
    ipHash ? `IP Hash: ${String(ipHash)}` : null,
    Array.isArray(reasons) && reasons.length ? `Reasons: ${reasons.join(', ')}` : null,
    createdAt ? `Time: ${new Date(createdAt).toISOString()}` : null
  ].filter(Boolean);
  const text = lines.join('\n');

  try {
    await sendMail({ to: emails.join(','), subject, text });
  } catch {}
};

const shadowTrackScan = asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const token = String(req.params.token || '').trim();
  const ipRaw = getIpRaw(req);
  const ipHash = getIpHash(ipRaw);
  const uaHash = getUaHash(String(req.headers['user-agent'] || '').trim());
  const ref = String(req.headers.referer || '').trim().slice(0, 500);

  const verified = verifyDesignToken(token);
  if (!verified.ok) {
    if (getShadowSecret()) {
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
      const recentSameIpCount = await ShadowTrackEvent.countDocuments({ ipHash, createdAt: { $gte: oneMinuteAgo } });
      if (recentSameIpCount < 10) {
        const created = await ShadowTrackEvent.create({
          kind: 'INVALID_TOKEN',
          designId: null,
          tokenHash: token ? getTokenHash(token) : '',
          ipHash,
          uaHash,
          ref,
          suspicious: recentSameIpCount >= 5,
          suspiciousReasons: recentSameIpCount >= 5 ? ['INVALID_TOKEN_BURST'] : []
        });
        if (created?.suspicious) {
          void sendSuspiciousAlert({
            kind: 'INVALID_TOKEN',
            designId: null,
            ipHash,
            reasons: created?.suspiciousReasons || [],
            createdAt: created?.createdAt
          });
        }
      }
    }
    return res.status(200).type('text/plain').send('OK');
  }

  const designId = verified.designId;
  const designExists = await Configuration.exists({ _id: designId });
  if (!designExists) return res.status(200).type('text/plain').send('OK');

  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
  const recentSameIpCount = await ShadowTrackEvent.countDocuments({ ipHash, kind: 'SCAN', createdAt: { $gte: oneMinuteAgo } });
  if (recentSameIpCount >= 60) return res.status(200).type('text/plain').send('OK');

  const recentDistinctDesigns = await ShadowTrackEvent.distinct('designId', {
    ipHash,
    kind: 'SCAN',
    createdAt: { $gte: oneMinuteAgo }
  });
  const { suspicious, reasons } = buildSuspicious({
    recentSameIpCount: recentSameIpCount + 1,
    recentDistinctDesignCount: Array.isArray(recentDistinctDesigns) ? new Set(recentDistinctDesigns.map(String)).size : 0
  });

  const created = await ShadowTrackEvent.create({
    kind: 'SCAN',
    designId,
    tokenHash: getTokenHash(token),
    ipHash,
    uaHash,
    ref,
    suspicious,
    suspiciousReasons: reasons
  });
  if (created?.suspicious) {
    void sendSuspiciousAlert({
      kind: 'SCAN',
      designId,
      ipHash,
      reasons: created?.suspiciousReasons || [],
      createdAt: created?.createdAt
    });
  }

  return res.status(200).type('text/plain').send('OK');
});

const auditAdminAccess = async ({ req, action, meta }) => {
  const adminUserId = String(req.user?.id || '').trim();
  if (!mongoose.isValidObjectId(adminUserId)) return;
  await ShadowAdminAudit.create({
    adminUserId,
    adminEmail: String(req.user?.email || '').trim().toLowerCase(),
    action: String(action || '').trim(),
    path: String(req.originalUrl || '').trim().slice(0, 500),
    meta: meta && typeof meta === 'object' ? meta : {}
  });
};

const adminShadowIssueToken = asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const designId = String(req.body?.designId || '').trim();
  if (!mongoose.isValidObjectId(designId)) return res.status(400).json({ error: 'INVALID_DESIGN_ID' });
  const exists = await Configuration.exists({ _id: designId });
  if (!exists) return res.status(404).json({ error: 'NOT_FOUND' });
  const token = signDesignToken({ designId });
  await auditAdminAccess({ req, action: 'SHADOW_TOKEN_ISSUE', meta: { designId } });
  res.status(201).json({ token });
});

const parseRange = (req) => {
  const fromRaw = req.query?.from;
  const toRaw = req.query?.to;
  const from = fromRaw ? new Date(String(fromRaw)) : new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const to = toRaw ? new Date(String(toRaw)) : new Date();
  const safeFrom = from && !Number.isNaN(from.getTime()) ? from : new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const safeTo = to && !Number.isNaN(to.getTime()) ? to : new Date();
  if (safeFrom.getTime() > safeTo.getTime()) return { from: safeTo, to: safeFrom };
  return { from: safeFrom, to: safeTo };
};

const calcLeakRiskScore = ({ scanCount, suspiciousCount, uniqueIpCount }) => {
  const sc = Math.max(0, Number(scanCount) || 0);
  const su = Math.max(0, Number(suspiciousCount) || 0);
  const uc = Math.max(0, Number(uniqueIpCount) || 0);
  const score = Math.round(Math.min(100, Math.log10(sc + 1) * 18 + su * 12 + Math.log10(uc + 1) * 14));
  return Math.max(0, Math.min(100, score));
};

const adminShadowLogs = asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const { from, to } = parseRange(req);
  const designId = String(req.query?.designId || '').trim();
  const match = {
    kind: 'SCAN',
    createdAt: { $gte: from, $lte: to }
  };
  if (mongoose.isValidObjectId(designId)) match.designId = new mongoose.Types.ObjectId(designId);

  const limit = Math.max(1, Math.min(500, Number(req.query?.limit) || 100));

  const events = await ShadowTrackEvent.find(match)
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('designId ipHash uaHash ref suspicious suspiciousReasons createdAt')
    .lean();

  const designAgg = await ShadowTrackEvent.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$designId',
        scanCount: { $sum: 1 },
        uniqueIps: { $addToSet: '$ipHash' },
        suspiciousCount: { $sum: { $cond: ['$suspicious', 1, 0] } },
        lastScanAt: { $max: '$createdAt' }
      }
    },
    {
      $project: {
        _id: 1,
        scanCount: 1,
        uniqueIpCount: { $size: '$uniqueIps' },
        suspiciousCount: 1,
        lastScanAt: 1
      }
    },
    { $sort: { lastScanAt: -1 } },
    { $limit: 200 }
  ]);

  const designIds = designAgg.map((x) => x._id).filter((x) => x);
  const configs = await Configuration.find({ _id: { $in: designIds } }).select('name thumbnailUrl carId isPublic publishedAt').lean();
  const cfgById = new Map(configs.map((c) => [String(c._id), c]));

  const designs = designAgg.map((row) => {
    const cfg = cfgById.get(String(row._id)) || null;
    const scanCount = Number(row.scanCount) || 0;
    const suspiciousCount = Number(row.suspiciousCount) || 0;
    const uniqueIpCount = Number(row.uniqueIpCount) || 0;
    return {
      designId: String(row._id),
      name: cfg?.name || '',
      thumbnailUrl: cfg?.thumbnailUrl || '',
      scanCount,
      uniqueIpCount,
      suspiciousCount,
      leakRiskScore: calcLeakRiskScore({ scanCount, suspiciousCount, uniqueIpCount }),
      lastScanAt: row.lastScanAt || null
    };
  });

  await auditAdminAccess({
    req,
    action: 'SHADOW_LOGS_VIEW',
    meta: { from: from.toISOString(), to: to.toISOString(), designId: mongoose.isValidObjectId(designId) ? designId : '' }
  });

  res.json({ range: { from, to }, designs, events });
});

const adminShadowSuspicious = asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const { from, to } = parseRange(req);
  const match = { suspicious: true, createdAt: { $gte: from, $lte: to } };

  const events = await ShadowTrackEvent.find(match)
    .sort({ createdAt: -1 })
    .limit(200)
    .select('kind designId ipHash uaHash ref suspiciousReasons createdAt')
    .lean();

  const ipAgg = await ShadowTrackEvent.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$ipHash',
        suspiciousCount: { $sum: 1 },
        designs: { $addToSet: '$designId' },
        lastSeenAt: { $max: '$createdAt' }
      }
    },
    {
      $project: {
        _id: 1,
        suspiciousCount: 1,
        designCount: {
          $size: {
            $filter: {
              input: '$designs',
              as: 'd',
              cond: { $ne: ['$$d', null] }
            }
          }
        },
        lastSeenAt: 1
      }
    },
    { $sort: { suspiciousCount: -1, lastSeenAt: -1 } },
    { $limit: 200 }
  ]);

  await auditAdminAccess({ req, action: 'SHADOW_SUSPICIOUS_VIEW', meta: { from: from.toISOString(), to: to.toISOString() } });
  res.json({ range: { from, to }, ipSummary: ipAgg.map((x) => ({ ipHash: x._id, suspiciousCount: x.suspiciousCount, designCount: x.designCount, lastSeenAt: x.lastSeenAt })), events });
});

const adminShadowHeatmap = asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const { from, to } = parseRange(req);
  const match = { kind: 'SCAN', createdAt: { $gte: from, $lte: to } };

  const buckets = await ShadowTrackEvent.aggregate([
    { $match: match },
    {
      $project: {
        day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        hour: { $hour: '$createdAt' }
      }
    },
    {
      $group: {
        _id: { day: '$day', hour: '$hour' },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id.day': 1, '_id.hour': 1 } }
  ]);

  await auditAdminAccess({ req, action: 'SHADOW_HEATMAP_VIEW', meta: { from: from.toISOString(), to: to.toISOString() } });
  res.json({
    range: { from, to },
    buckets: buckets.map((b) => ({ day: b._id.day, hour: b._id.hour, count: b.count }))
  });
});

module.exports = {
  shadowTrackScan,
  adminShadowIssueToken,
  adminShadowLogs,
  adminShadowSuspicious,
  adminShadowHeatmap
};
