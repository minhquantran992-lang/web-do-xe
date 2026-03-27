const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const User = require('../models/User');
const Vendor = require('../models/Vendor');
const { asyncHandler } = require('../middleware/asyncHandler');
const { sendMail } = require('../services/mailer');

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const normalizeRole = (value) => {
  const v = String(value || '')
    .trim()
    .toUpperCase();
  if (v === 'ADMIN' || v === 'VENDOR' || v === 'USER') return v;
  return 'USER';
};

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

const signToken = ({ userId, email, role }) => {
  if (!process.env.JWT_SECRET) {
    const err = new Error('MISSING_JWT_SECRET');
    err.statusCode = 500;
    throw err;
  }
  const adminEmails = parseAdminEmails();
  const normalizedEmail = normalizeEmail(email);
  const isAdmin = normalizedEmail ? adminEmails.has(normalizedEmail) : false;
  const safeRole = isAdmin ? 'ADMIN' : normalizeRole(role);
  return jwt.sign({ sub: String(userId), email: normalizedEmail, isAdmin, role: safeRole }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

const toUserJson = (user) => {
  const email = normalizeEmail(user?.email);
  const adminEmails = parseAdminEmails();
  const isAdmin = email ? adminEmails.has(email) : false;
  const role = isAdmin ? 'ADMIN' : normalizeRole(user?.role);
  return {
    id: user?._id,
    name: user?.name || '',
    email,
    provider: user?.provider || 'local',
    providerId: user?.providerId ? String(user.providerId) : '',
    avatar: user?.avatar || '',
    createdAt: user?.createdAt,
    isAdmin,
    role
  };
};

const upsertOAuthUser = async ({ provider, providerId, email, name, avatar }) => {
  const p = String(provider || '').trim();
  const pid = String(providerId || '').trim();
  const normalizedEmail = normalizeEmail(email);
  const safeName = String(name || '').trim();
  const safeAvatar = String(avatar || '').trim();

  if (!['google', 'facebook'].includes(p)) {
    const err = new Error('INVALID_PROVIDER');
    err.statusCode = 400;
    throw err;
  }
  if (!pid) {
    const err = new Error('MISSING_PROVIDER_ID');
    err.statusCode = 400;
    throw err;
  }

  const byProvider = await User.findOne({ provider: p, providerId: pid });
  if (byProvider) {
    const patch = {};
    if (safeName && !String(byProvider.name || '').trim()) patch.name = safeName;
    if (safeAvatar && !String(byProvider.avatar || '').trim()) patch.avatar = safeAvatar;
    if (Object.keys(patch).length) await User.updateOne({ _id: byProvider._id }, { $set: patch });
    return User.findById(byProvider._id).select('name email provider providerId avatar createdAt role');
  }

  if (!normalizedEmail) {
    const err = new Error('MISSING_EMAIL');
    err.statusCode = 400;
    throw err;
  }

  const byEmail = await User.findOne({ email: normalizedEmail }).select('+password name email provider providerId avatar createdAt role');
  if (byEmail) {
    const existingPid = String(byEmail.providerId || '').trim();
    const existingProvider = String(byEmail.provider || '').trim();

    if (existingPid && (existingProvider !== p || existingPid !== pid)) {
      const err = new Error('EMAIL_ALREADY_LINKED');
      err.statusCode = 409;
      throw err;
    }

    const patch = { provider: p, providerId: pid };
    if (safeName && !String(byEmail.name || '').trim()) patch.name = safeName;
    if (safeAvatar && !String(byEmail.avatar || '').trim()) patch.avatar = safeAvatar;
    const adminEmails = parseAdminEmails();
    const adminBoot = String(process.env.ADMIN_BOOT_PASSWORD || '').trim();
    if (adminEmails.has(normalizedEmail) && !String(byEmail.password || '').trim() && adminBoot) {
      patch.password = await bcrypt.hash(adminBoot, 10);
      patch.passwordHash = patch.password;
      patch.role = 'ADMIN';
    }

    await User.updateOne({ _id: byEmail._id }, { $set: patch });
    return User.findById(byEmail._id).select('name email provider providerId avatar createdAt role');
  }

  return User.create({
    name: safeName,
    email: normalizedEmail,
    password: null,
    provider: p,
    providerId: pid,
    avatar: safeAvatar,
    role: parseAdminEmails().has(normalizedEmail) ? 'ADMIN' : 'USER'
  });
};

const register = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || '');
  const name = String(req.body?.name || '').trim();
  const isVendor = Boolean(req.body?.isVendor) || normalizeRole(req.body?.role) === 'VENDOR';

  if (!email || !password) return res.status(400).json({ error: 'MISSING_FIELDS' });
  if (password.length < 6) return res.status(400).json({ error: 'WEAK_PASSWORD' });

  const existing = await User.findOne({ email }).lean();
  if (existing) return res.status(409).json({ error: 'EMAIL_EXISTS' });

  let vendorPayload = null;
  if (isVendor) {
    const shopName = String(req.body?.shopName || '').trim();
    if (!shopName) return res.status(400).json({ error: 'MISSING_SHOP_NAME' });
    vendorPayload = {
      shopName,
      description: String(req.body?.description || '').trim(),
      phone: String(req.body?.phone || '').trim(),
      email: String(req.body?.vendorEmail || req.body?.shopEmail || '').trim(),
      address: String(req.body?.address || '').trim(),
      website: String(req.body?.website || '').trim(),
      facebook: String(req.body?.facebook || '').trim(),
      zalo: String(req.body?.zalo || '').trim(),
      logo: String(req.body?.logo || '').trim(),
      coverImage: String(req.body?.coverImage || '').trim(),
      status: 'pending'
    };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const adminEmails = parseAdminEmails();
  const role = adminEmails.has(email) ? 'ADMIN' : isVendor ? 'VENDOR' : 'USER';
  const user = await User.create({
    email,
    password: passwordHash,
    passwordHash,
    name,
    provider: 'local',
    providerId: email,
    role
  });

  if (vendorPayload) {
    await Vendor.create({ userId: user._id, ...vendorPayload });
  }

  const token = signToken({ userId: user._id, email: user.email, role: user.role });
  res.status(201).json({ ok: true, token, user: toUserJson(user) });
});

const login = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || '');

  if (!email || !password) return res.status(400).json({ error: 'MISSING_FIELDS' });

  let user = await User.findOne({ email }).select('+password +passwordHash name email provider providerId avatar createdAt role');
  if (!user) {
    const adminEmails = parseAdminEmails();
    if (adminEmails.has(email)) {
      const newHash = await bcrypt.hash(password, 10);
      user = await User.create({
        email,
        name: '',
        password: newHash,
        passwordHash: newHash,
        provider: 'local',
        providerId: email,
        avatar: '',
        role: 'ADMIN'
      });
    } else {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    }
  }

  let storedHash = String(user.password || '').trim();
  if (!storedHash) {
    const legacy = String(user.passwordHash || '').trim();
    if (legacy) {
      await User.updateOne({ _id: user._id }, { $set: { password: legacy }, $unset: { passwordHash: '' } });
      storedHash = legacy;
    }
  }
  if (!storedHash) {
    const adminEmails = parseAdminEmails();
    const isAdminEmail = adminEmails.has(email);
    if (isAdminEmail) {
      const newHash = await bcrypt.hash(password, 10);
      await User.updateOne({ _id: user._id }, { $set: { password: newHash, passwordHash: newHash } });
      storedHash = newHash;
    } else {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    }
  }

  const ok = await bcrypt.compare(password, storedHash);
  if (!ok) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });

  const adminEmails = parseAdminEmails();
  const role = adminEmails.has(email) ? 'ADMIN' : normalizeRole(user?.role);
  if (role !== normalizeRole(user?.role)) {
    await User.updateOne({ _id: user._id }, { $set: { role } });
  }
  const token = signToken({ userId: user._id, email: user.email, role });
  res.json({ ok: true, token, user: toUserJson(user) });
});

const completeOAuthLogin = async ({ provider, providerId, email, name, avatar }) => {
  const user = await upsertOAuthUser({ provider, providerId, email, name, avatar });
  const token = signToken({ userId: user._id, email: user.email, role: user.role });
  return { token, user: toUserJson(user) };
};

const changePassword = asyncHandler(async (req, res) => {
  const userId = String(req.user?.id || '');
  const oldPassword = String(req.body?.oldPassword || '');
  const newPassword = String(req.body?.newPassword || '');
  if (!userId || !oldPassword || !newPassword) return res.status(400).json({ error: 'MISSING_FIELDS' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'WEAK_PASSWORD' });
  const user = await User.findById(userId).select('+password +passwordHash');
  if (!user) return res.status(401).json({ error: 'UNAUTHORIZED' });
  let storedHash = String(user.password || '').trim();
  if (!storedHash) {
    const legacy = String(user.passwordHash || '').trim();
    if (legacy) {
      storedHash = legacy;
    } else {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    }
  }
  const ok = await bcrypt.compare(oldPassword, storedHash);
  if (!ok) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
  const nextHash = await bcrypt.hash(newPassword, 10);
  await User.updateOne({ _id: userId }, { $set: { password: nextHash, passwordHash: nextHash } });
  res.json({ ok: true });
});

const requestPasswordReset = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!email) return res.status(400).json({ error: 'MISSING_EMAIL' });
  const user = await User.findOne({ email }).select('_id');
  if (!user) {
    console.log(`[auth] request-reset ignored: email not found (${email})`);
    return res.status(404).json({ error: 'EMAIL_NOT_FOUND' });
  }
  const token = crypto.randomBytes(32).toString('hex');
  const code = `${Math.floor(100000 + Math.random() * 900000)}`;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const codeHash = crypto.createHash('sha256').update(code).digest('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000);
  await User.updateOne(
    { _id: user._id },
    { $set: { resetTokenHash: tokenHash, resetCodeHash: codeHash, resetTokenExpires: expires } }
  );
  const base = String(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
  const resetUrl = `${base}/reset-password?token=${encodeURIComponent(token)}`;
  const subject = 'Carbanana • Đặt lại mật khẩu';
  const text = [
    'Bạn đã yêu cầu đặt lại mật khẩu Carbanana.',
    `Mã xác nhận: ${code}`,
    `Hoặc mở liên kết để đặt lại mật khẩu: ${resetUrl}`,
    'Mã/Link có hiệu lực trong 60 phút.',
    'Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.'
  ].join('\n');
  const html = `
  <div style="background:#f6f9fc;padding:32px 12px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:24px;">
      <div style="text-align:center;margin-bottom:12px;font-weight:700;font-size:20px;">Carbanana</div>
      <h1 style="margin:0 0 12px 0;font-size:18px;">Đặt lại mật khẩu</h1>
      <p style="margin:0 0 16px 0;color:#334155;font-size:14px;">Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản Carbanana.</p>
      <div style="text-align:center;margin:18px 0;padding:12px;border:1px dashed #cbd5e1;border-radius:10px;background:#f8fafc;">
        <div style="font-size:12px;color:#64748b;margin-bottom:6px;">Mã xác nhận</div>
        <div style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace;font-size:28px;letter-spacing:4px;color:#0f172a;">${code}</div>
      </div>
      <div style="text-align:center;margin:20px 0;">
        <a href="${resetUrl}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;">Đặt lại mật khẩu</a>
      </div>
      <p style="margin:12px 0 0 0;color:#475569;font-size:13px;">Mã/Link có hiệu lực trong 60 phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
    </div>
    <div style="max-width:560px;margin:12px auto 0;text-align:center;color:#94a3b8;font-size:12px;">
      © Carbanana
    </div>
  </div>
  `;
  await sendMail({ to: email, subject, text, html });
  const noSmtp =
    !(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS);
  const echo =
    String(process.env.ALLOW_RESET_CODE_ECHO || '').toLowerCase() === 'true';
  if (noSmtp || echo) {
    return res.json({ ok: true, resetUrl, code });
  }
  res.json({ ok: true });
});

const resetPassword = asyncHandler(async (req, res) => {
  const token = String(req.body?.token || '');
  const newPassword = String(req.body?.newPassword || '');
  if (!token || !newPassword) return res.status(400).json({ error: 'MISSING_FIELDS' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'WEAK_PASSWORD' });
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const now = new Date();
  const user = await User.findOne({
    resetTokenHash: hash,
    resetTokenExpires: { $gt: now }
  }).select('_id');
  if (!user) return res.status(400).json({ error: 'INVALID_TOKEN' });
  const nextHash = await bcrypt.hash(newPassword, 10);
  await User.updateOne(
    { _id: user._id },
    { $set: { password: nextHash, passwordHash: nextHash }, $unset: { resetTokenHash: '', resetTokenExpires: '' } }
  );
  res.json({ ok: true });
});

const resetPasswordByCode = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const code = String(req.body?.code || '');
  const newPassword = String(req.body?.newPassword || '');
  if (!email || !code || !newPassword) return res.status(400).json({ error: 'MISSING_FIELDS' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'WEAK_PASSWORD' });
  const codeHash = crypto.createHash('sha256').update(code).digest('hex');
  const now = new Date();
  const user = await User.findOne({
    email,
    resetCodeHash: codeHash,
    resetTokenExpires: { $gt: now }
  }).select('_id');
  if (!user) return res.status(400).json({ error: 'INVALID_CODE' });
  const nextHash = await bcrypt.hash(newPassword, 10);
  await User.updateOne(
    { _id: user._id },
    { $set: { password: nextHash, passwordHash: nextHash }, $unset: { resetTokenHash: '', resetCodeHash: '', resetTokenExpires: '' } }
  );
  res.json({ ok: true });
});

const requestVerifyEmail = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!email) return res.status(400).json({ error: 'MISSING_EMAIL' });
  const user = await User.findOne({ email }).select('_id emailVerified');
  if (!user) return res.json({ ok: true });
  if (user.emailVerified) return res.json({ ok: true });
  const code = `${Math.floor(100000 + Math.random() * 900000)}`;
  const codeHash = crypto.createHash('sha256').update(code).digest('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000);
  await User.updateOne({ _id: user._id }, { $set: { verifyCodeHash: codeHash, verifyCodeExpires: expires } });
  const subject = 'Xác minh email Carbanana';
  const text = `Mã xác nhận của bạn: ${code}\nMã có hiệu lực trong 60 phút.`;
  const html = `<p>Mã xác nhận của bạn: <b>${code}</b></p><p>Mã có hiệu lực trong 60 phút.</p>`;
  await sendMail({ to: email, subject, text, html });
  const inDevNoSmtp = !(
    process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS
  );
  res.json(inDevNoSmtp ? { ok: true, code } : { ok: true });
});

const verifyEmail = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const code = String(req.body?.code || '');
  if (!email || !code) return res.status(400).json({ error: 'MISSING_FIELDS' });
  const codeHash = crypto.createHash('sha256').update(code).digest('hex');
  const now = new Date();
  const user = await User.findOne({
    email,
    verifyCodeHash: codeHash,
    verifyCodeExpires: { $gt: now }
  }).select('_id');
  if (!user) return res.status(400).json({ error: 'INVALID_CODE' });
  await User.updateOne(
    { _id: user._id },
    { $set: { emailVerified: true }, $unset: { verifyCodeHash: '', verifyCodeExpires: '' } }
  );
  res.json({ ok: true });
});

module.exports = {
  register,
  login,
  signToken,
  upsertOAuthUser,
  completeOAuthLogin,
  changePassword,
  requestPasswordReset,
  resetPassword,
  resetPasswordByCode,
  requestVerifyEmail,
  verifyEmail
};
