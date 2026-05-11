const pickFirst = (v) => String(v || '').split(',')[0].trim();

const getClientIp = (req) => {
  const trustProxy =
    String(process.env.TRUST_PROXY || '')
      .trim()
      .toLowerCase() === 'true' || String(process.env.TRUST_PROXY || '').trim() === '1';

  if (trustProxy) {
    const xff = pickFirst(req.headers['x-forwarded-for']);
    if (xff) return xff;
    const xri = pickFirst(req.headers['x-real-ip']);
    if (xri) return xri;
  }

  const ip = String(req.ip || '').trim();
  if (ip) return ip;
  const ra = String(req.connection?.remoteAddress || '').trim();
  return ra;
};

const securityContext = (req, res, next) => {
  req.clientIp = getClientIp(req);
  req.userAgent = String(req.headers['user-agent'] || '').trim();
  next();
};

module.exports = { securityContext };
