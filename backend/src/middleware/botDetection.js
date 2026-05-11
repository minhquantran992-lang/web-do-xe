const { logSecurityEvent } = require('../security/securityLog');

const scoreRequest = (req) => {
  const ua = String(req.headers['user-agent'] || '').trim().toLowerCase();
  const al = String(req.headers['accept-language'] || '').trim();
  const secUa = String(req.headers['sec-ch-ua'] || '').trim();

  let score = 0;
  const reasons = [];

  if (!ua) {
    score += 40;
    reasons.push('missing_ua');
  }
  if (ua.includes('headless') || ua.includes('puppeteer') || ua.includes('playwright') || ua.includes('selenium')) {
    score += 60;
    reasons.push('automation_ua');
  }
  if (!al) {
    score += 10;
    reasons.push('missing_accept_language');
  }
  if (!secUa) {
    score += 5;
    reasons.push('missing_sec_ch_ua');
  }

  return { score, reasons };
};

const botDetection = (req, res, next) => {
  const scored = scoreRequest(req);
  req.bot = scored;

  const high = scored.score >= 70;
  const enforce =
    String(process.env.BOT_BLOCK_HIGH || '')
      .trim()
      .toLowerCase() === 'true' || String(process.env.BOT_BLOCK_HIGH || '').trim() === '1';

  if (high) {
    logSecurityEvent({ req, kind: 'bot', outcome: enforce ? 'blocked' : 'flagged', score: scored.score, meta: { reasons: scored.reasons } }).catch(() => {});
    if (enforce) return res.status(403).json({ error: 'BOT_BLOCKED' });
  }

  next();
};

module.exports = { botDetection };
