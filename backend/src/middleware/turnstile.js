const https = require('https');
const { logSecurityEvent } = require('../security/securityLog');

const postForm = ({ url, data }) =>
  new Promise((resolve, reject) => {
    try {
      const u = new URL(url);
      const body = new URLSearchParams(data || {}).toString();
      const req = https.request(
        {
          method: 'POST',
          hostname: u.hostname,
          path: u.pathname + (u.search || ''),
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
            'content-length': Buffer.byteLength(body)
          }
        },
        (res) => {
          let chunks = '';
          res.on('data', (d) => (chunks += d));
          res.on('end', () => resolve({ status: res.statusCode || 0, text: chunks }));
        }
      );
      req.on('error', reject);
      req.end(body);
    } catch (e) {
      reject(e);
    }
  });

const readToken = (req) => {
  const h = String(req.headers['cf-turnstile-response'] || req.headers['x-turnstile-token'] || '').trim();
  if (h) return h;
  const b = req.body || {};
  return String(b.turnstileToken || b.cfTurnstileToken || b.captchaToken || '').trim();
};

const requireTurnstile = ({ action }) => {
  return async (req, res, next) => {
    const bypass =
      String(process.env.TURNSTILE_BYPASS || '')
        .trim()
        .toLowerCase() === 'true' || String(process.env.TURNSTILE_BYPASS || '').trim() === '1';
    if (bypass) return next();

    const secret = String(process.env.TURNSTILE_SECRET_KEY || '').trim();
    const required =
      String(process.env.TURNSTILE_REQUIRED || '')
        .trim()
        .toLowerCase() === 'true' || String(process.env.TURNSTILE_REQUIRED || '').trim() === '1';
    if (!secret) {
      if (!required) return next();
      return res.status(500).json({ error: 'TURNSTILE_NOT_CONFIGURED' });
    }

    const token = readToken(req);
    if (!token) {
      await logSecurityEvent({ req, kind: 'captcha', outcome: 'missing', score: 50, meta: { action: String(action || '') } });
      return res.status(403).json({ error: 'CAPTCHA_REQUIRED' });
    }

    try {
      const { status, text } = await postForm({
        url: 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        data: { secret, response: token, remoteip: String(req.clientIp || req.ip || '').trim() || undefined }
      });
      const parsed = JSON.parse(String(text || '{}'));
      const ok = status >= 200 && status < 300 && parsed && parsed.success === true;
      if (!ok) {
        await logSecurityEvent({
          req,
          kind: 'captcha',
          outcome: 'failed',
          score: 70,
          meta: { action: String(action || ''), codes: parsed?.['error-codes'] || [] }
        });
        return res.status(403).json({ error: 'CAPTCHA_FAILED' });
      }

      req.turnstile = {
        action: String(action || ''),
        ok: true,
        challengeTs: String(parsed?.challenge_ts || ''),
        hostname: String(parsed?.hostname || '')
      };
      return next();
    } catch (e) {
      await logSecurityEvent({ req, kind: 'captcha', outcome: 'error', score: 60, meta: { action: String(action || '') } });
      return res.status(503).json({ error: 'CAPTCHA_UNAVAILABLE' });
    }
  };
};

module.exports = { requireTurnstile };
