const jwt = require('jsonwebtoken');

const User = require('../models/User');
const Vendor = require('../models/Vendor');

const parseAdminEmails = () => {
  const raw = String(process.env.ADMIN_EMAILS || '').trim().toLowerCase();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
};

const normalizeRole = (value) => {
  const v = String(value || '')
    .trim()
    .toUpperCase();
  if (v === 'ADMIN' || v === 'VENDOR' || v === 'USER') return v;
  return 'USER';
};

const authRequired = (req, res, next) => {
  const header = String(req.headers.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';

  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
  if (!process.env.JWT_SECRET) return res.status(500).json({ error: 'MISSING_JWT_SECRET' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const email = String(payload.email || '').trim().toLowerCase();
    const adminEmails = parseAdminEmails();
    const isAdmin = Boolean(payload.isAdmin) || (email ? adminEmails.has(email) : false);
    const payloadRole = normalizeRole(payload.role);
    const role = isAdmin ? 'ADMIN' : payloadRole;
    req.user = { id: payload.sub, email, isAdmin, role };
    return next();
  } catch {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
};

const adminRequired = (req, res, next) => {
  return authRequired(req, res, async () => {
    if (req.user?.isAdmin) return next();

    const userId = String(req.user?.id || '');
    if (!userId) return res.status(403).json({ error: 'FORBIDDEN' });

    const user = await User.findById(userId).select('email').lean();
    const email = String(user?.email || '').trim().toLowerCase();
    if (!email) return res.status(403).json({ error: 'FORBIDDEN' });

    const adminEmails = parseAdminEmails();
    if (!adminEmails.has(email)) return res.status(403).json({ error: 'FORBIDDEN' });

    req.user.email = email;
    req.user.isAdmin = true;
    req.user.role = 'ADMIN';
    return next();
  });
};

const requireVendor = (req, res, next) => {
  return authRequired(req, res, async () => {
    const userId = String(req.user?.id || '');
    if (!userId) return res.status(403).json({ error: 'FORBIDDEN' });

    const user = await User.findById(userId).select('email role').lean();
    const email = String(user?.email || req.user?.email || '').trim().toLowerCase();
    const adminEmails = parseAdminEmails();
    const isAdmin = email ? adminEmails.has(email) : false;
    if (isAdmin) return res.status(403).json({ error: 'VENDOR_REQUIRED' });

    const role = normalizeRole(user?.role || req.user?.role);
    if (role !== 'VENDOR') return res.status(403).json({ error: 'VENDOR_REQUIRED' });

    const vendor = await Vendor.findOne({ userId }).lean();
    if (!vendor) return res.status(404).json({ error: 'VENDOR_NOT_FOUND' });

    req.user.email = email;
    req.user.isAdmin = false;
    req.user.role = role;
    req.vendor = vendor;
    return next();
  });
};

const requireVendorApproved = (req, res, next) => {
  return requireVendor(req, res, () => {
    const status = req.vendor?.status == null ? 'approved' : String(req.vendor.status).trim().toLowerCase();
    if (status !== 'approved') return res.status(403).json({ error: 'VENDOR_NOT_APPROVED' });
    return next();
  });
};

module.exports = { authRequired, adminRequired, requireVendor, requireVendorApproved };
