const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const mongoose = require('mongoose');

const User = require('../models/User');
const Vendor = require('../models/Vendor');
const RefreshSession = require('../models/RefreshSession');
const { asyncHandler } = require('../middleware/asyncHandler');
const { sendMail } = require('../services/mailer');
const { createCsrfToken } = require('../middleware/csrfProtection');

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const isValidEmail = (value) => {
  const email = normalizeEmail(value);
  if (!email) return false;
  if (email.length > 254) return false;
  const at = email.indexOf('@');
  if (at <= 0) return false;
  if (at !== email.lastIndexOf('@')) return false;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (!local || !domain) return false;
  if (local.length > 64) return false;
  if (domain.length > 255) return false;
  if (local.startsWith('.') || local.endsWith('.')) return false;
  if (local.includes('..')) return false;
  if (!/^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/i.test(local)) return false;
  if (domain.includes('..')) return false;
  if (!domain.includes('.')) return false;
  const labels = domain.split('.');
  if (labels.some((l) => !l || l.length > 63)) return false;
  if (labels.some((l) => !/^[a-z0-9-]+$/i.test(l))) return false;
  if (labels.some((l) => l.startsWith('-') || l.endsWith('-'))) return false;
  const tld = labels[labels.length - 1] || '';
  if (tld.length < 2 || tld.length > 63) return false;
  return true;
};
const normalizePhone = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const cleaned = raw.replace(/[^\d+]/g, '');
  const digits = cleaned.replace(/[^\d]/g, '');
  if (digits.length < 8) return '';
  if (cleaned.startsWith('+')) return `+${digits}`;
  return digits;
};

const normalizeGender = (value) => {
  const k = String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
  if (!k) return '';
  if (k === 'male' || k === 'nam') return 'male';
  if (k === 'female' || k === 'nu') return 'female';
  return '';
};

const normalizeForBlockedText = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[\s\-_.]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim();

const isInappropriateText = (value) => {
  const s = normalizeForBlockedText(value);
  if (!s) return false;
  const compact = s.replace(/\s+/g, '');
  const profanity = [
    /\b(fuck|shit|bitch|cunt|motherfucker)\b/i,
    /\b(dcm|dm)\b/i,
    /(địt|dit|đụ|du|lồn|lon|cặc|cac|cak|buồi|buoi)/i,
    /(chó\s*mày|cho\s*may)/i,
    /(dit|du|lon|cac|cak|buoi)/i
  ];
  if (profanity.some((rx) => rx.test(s) || rx.test(compact))) return true;
  const sensitive = [
    /\b(porn|xxx|sex|nude)\b/i,
    /(hiep\s*dam|rape)/i,
    /(au\s*dam|pedo|pedophile|child\s*porn)/i,
    /(tu\s*tu|suicide|kill\s*(myself|yourself))/i,
    /(ma\s*tuy|cocaine|heroin|meth|mdma|\bweed\b|can\s*sa)/i
  ];
  if (sensitive.some((rx) => rx.test(s) || rx.test(compact))) return true;
  return false;
};

const validateUserEmail = (value) => {
  const email = normalizeEmail(value);
  if (!email) return { ok: false, error: 'INVALID_EMAIL' };
  if (!isValidEmail(email)) return { ok: false, error: 'INVALID_EMAIL' };
  if (isInappropriateText(email)) return { ok: false, error: 'EMAIL_INAPPROPRIATE' };
  return { ok: true, value: email };
};

const validateUserPhone = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return { ok: true, value: '' };
  if (isInappropriateText(raw)) return { ok: false, error: 'PHONE_INAPPROPRIATE' };
  const phone = normalizePhone(raw);
  if (!phone) return { ok: false, error: 'INVALID_PHONE' };
  const digits = phone.replace(/[^\d]/g, '');
  if (digits.length < 8 || digits.length > 15) return { ok: false, error: 'INVALID_PHONE' };
  return { ok: true, value: phone };
};

const validateUserName = (value) => {
  const raw = String(value || '').trim().replace(/\s+/g, ' ');
  if (!raw) return { ok: false, error: 'INVALID_NAME' };
  if (raw.length < 2 || raw.length > 80) return { ok: false, error: 'INVALID_NAME' };
  if (!/^[\p{L}][\p{L}\s.'-]*$/u.test(raw)) return { ok: false, error: 'INVALID_NAME' };
  if (!/[\p{L}]/u.test(raw)) return { ok: false, error: 'INVALID_NAME' };
  if (isInappropriateText(raw)) return { ok: false, error: 'NAME_INAPPROPRIATE' };
  return { ok: true, value: raw };
};

const parseIdentifier = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return { kind: '', email: '', phone: '' };
  if (raw.includes('@')) return { kind: 'email', email: isValidEmail(raw) ? normalizeEmail(raw) : '', phone: '' };
  return { kind: 'phone', email: '', phone: normalizePhone(raw) };
};

const createOtpCode = () => `${Math.floor(100000 + Math.random() * 900000)}`;
const createOpaqueToken = () => crypto.randomBytes(24).toString('hex');
const sha256 = (value) => crypto.createHash('sha256').update(String(value || '')).digest('hex');

const getRefreshSecret = () => String(process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET || '').trim();
const hashRefreshToken = (token) => sha256(`refresh:${getRefreshSecret()}:${String(token || '')}`);
const getAccessTokenExpiresIn = () => String(process.env.JWT_ACCESS_EXPIRES_IN || '7d').trim() || '7d';
const getRefreshTtlDays = () => {
  const raw = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30);
  return Number.isFinite(raw) ? Math.min(365, Math.max(1, Math.floor(raw))) : 30;
};

const isProd = () => String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production';
const setAuthCookies = (res, { refreshToken, csrfToken }) => {
  const secure = isProd();
  const sameSite = secure ? 'none' : 'lax';
  const refreshDays = getRefreshTtlDays();
  res.cookie('refreshToken', String(refreshToken || ''), {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    maxAge: refreshDays * 24 * 60 * 60 * 1000
  });
  res.cookie('csrfToken', String(csrfToken || ''), {
    httpOnly: false,
    secure,
    sameSite,
    path: '/',
    maxAge: refreshDays * 24 * 60 * 60 * 1000
  });
};

const clearAuthCookies = (res) => {
  const secure = isProd();
  const sameSite = secure ? 'none' : 'lax';
  res.clearCookie('refreshToken', { httpOnly: true, secure, sameSite, path: '/' });
  res.clearCookie('csrfToken', { httpOnly: false, secure, sameSite, path: '/' });
};

const trimHeaderValue = (value, maxLen) => {
  const s = String(value || '').trim();
  if (!s) return '';
  const n = Number(maxLen);
  const lim = Number.isFinite(n) ? Math.max(1, Math.floor(n)) : 200;
  return s.length > lim ? s.slice(0, lim) : s;
};

const pruneRefreshSessions = async ({ userId, keep = 20 }) => {
  const uid = String(userId || '').trim();
  if (!uid) return;
  const cap = Number.isFinite(Number(keep)) ? Math.max(1, Math.floor(keep)) : 20;
  const sessions = await RefreshSession.find({ userId: uid, revokedAt: null }).sort({ createdAt: -1 }).select('_id').lean();
  if (!Array.isArray(sessions) || sessions.length <= cap) return;
  const toDelete = sessions.slice(cap).map((s) => s?._id).filter(Boolean);
  if (!toDelete.length) return;
  await RefreshSession.deleteMany({ _id: { $in: toDelete } });
};

const createRefreshSession = async ({ req, userId }) => {
  if (!getRefreshSecret()) return { ok: false, error: 'MISSING_REFRESH_SECRET' };
  const uid = String(userId || '').trim();
  if (!uid) return { ok: false, error: 'MISSING_USER' };
  const refreshToken = crypto.randomBytes(48).toString('hex');
  const tokenHash = hashRefreshToken(refreshToken);
  const now = new Date();
  const ttlDays = getRefreshTtlDays();
  const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);
  const ip = trimHeaderValue(req?.clientIp || req?.ip, 80);
  const ua = trimHeaderValue(req?.headers?.['user-agent'], 300);
  await RefreshSession.create({ userId: uid, tokenHash, createdAt: now, expiresAt, lastUsedAt: now, ip, ua });
  await pruneRefreshSessions({ userId: uid, keep: 20 });
  return { ok: true, refreshToken };
};

const maskEmail = (email) => {
  const e = String(email || '').trim();
  const at = e.indexOf('@');
  if (at <= 0) return e || '';
  const name = e.slice(0, at);
  const domain = e.slice(at + 1);
  const left = name.slice(0, 2);
  const masked = left ? `${left}***` : '***';
  return `${masked}@${domain}`;
};

const buildOtpEmail = ({ subject, heading, message, code, expiresMinutes, recipient, cta }) => {
  const safeCode = String(code || '').trim();
  const safeMinutes = Number(expiresMinutes);
  const mins = Number.isFinite(safeMinutes) ? Math.max(1, Math.round(safeMinutes)) : 5;
  const safeRecipient = String(recipient || '').trim();
  const ctaUrl = cta?.url ? String(cta.url).trim() : '';
  const ctaLabel = cta?.label ? String(cta.label).trim() : '';
  const year = new Date().getFullYear();

  const text = [
    `${heading}`,
    message ? `${message}${safeRecipient ? ` (${safeRecipient})` : ''}` : safeRecipient ? safeRecipient : '',
    '',
    `Mã xác thực: ${safeCode}`,
    `Hiệu lực: ${mins} phút`,
    ctaUrl ? `Liên kết: ${ctaUrl}` : '',
    '',
    'Không chia sẻ mã này cho bất kỳ ai (kể cả nhân viên hỗ trợ).',
    'Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.'
  ]
    .filter(Boolean)
    .join('\n');

  const html = `
    <div style="margin:0;padding:0;background:#0b1220;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">
        ${heading}: ${safeCode} (hết hạn sau ${mins} phút)
      </div>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse">
        <tr>
          <td align="center" style="padding:28px 16px">
            <table role="presentation" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;width:100%;border-collapse:separate;border-spacing:0;border:1px solid #1f2937;border-radius:18px;overflow:hidden;background:#0f172a">
              <tr>
                <td style="padding:22px 22px 16px 22px;background:linear-gradient(135deg,#0ea5e9 0%,#22c55e 100%);color:#071018">
                  <div style="font-weight:900;font-size:18px;letter-spacing:0.2px">eloride</div>
                  <div style="margin-top:6px;font-weight:800;font-size:14px;opacity:0.95">${heading}</div>
                </td>
              </tr>
              <tr>
                <td style="padding:20px 22px;color:#e5e7eb">
                  <div style="font-size:14px;line-height:1.7;color:#cbd5e1">
                    Xin chào,
                    <div style="margin-top:8px;color:#94a3b8">
                      ${message || ''}
                      ${safeRecipient ? `<span style="color:#e2e8f0;font-weight:700">(${safeRecipient})</span>` : ''}
                    </div>
                  </div>
                  <div style="margin-top:16px;padding:16px 14px;border:1px solid #223047;border-radius:14px;background:#0b1220;text-align:center">
                    <div style="font-size:12px;letter-spacing:0.6px;color:#94a3b8">MÃ XÁC THỰC</div>
                    <div style="margin-top:8px">
                      <span style="display:inline-block;font-weight:950;font-size:30px;letter-spacing:10px;color:#f8fafc">${safeCode}</span>
                    </div>
                  </div>
                  <div style="margin-top:14px;font-size:13px;line-height:1.7;color:#94a3b8">
                    Mã có hiệu lực trong <b style="color:#e2e8f0">${mins} phút</b> và chỉ dùng 1 lần.
                  </div>
                  ${
                    ctaUrl && ctaLabel
                      ? `
                  <div style="margin-top:16px;text-align:center">
                    <a href="${ctaUrl}" style="display:inline-block;background:#0ea5e9;color:#071018;text-decoration:none;padding:10px 16px;border-radius:10px;font-size:13px;font-weight:800">
                      ${ctaLabel}
                    </a>
                  </div>
                  <div style="margin-top:10px;font-size:12px;line-height:1.7;color:#64748b">
                    Nếu nút không hoạt động, hãy sao chép liên kết này và mở trên trình duyệt:
                    <div style="margin-top:6px;word-break:break-all;color:#94a3b8">${ctaUrl}</div>
                  </div>
                  `.trim()
                      : ''
                  }
                  <div style="margin-top:18px;height:1px;background:#1f2937"></div>
                  <div style="margin-top:14px;font-size:12px;line-height:1.7;color:#64748b">
                    Không chia sẻ mã này cho bất kỳ ai (kể cả nhân viên hỗ trợ).
                    Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.
                  </div>
                  <div style="margin-top:14px;font-size:12px;line-height:1.7;color:#64748b">
                    Trân trọng,<br/>Đội ngũ eloride
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 22px;background:#0b1220;color:#64748b;font-size:12px;line-height:1.6">
                  © ${year} eloride
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `.trim();

  return { subject, text, html };
};

const buildPasswordResetEmail = ({ subject, code, expiresMinutes, recipient, cta }) => {
  const safeCode = String(code || '').trim();
  const safeMinutes = Number(expiresMinutes);
  const mins = Number.isFinite(safeMinutes) ? Math.max(1, Math.round(safeMinutes)) : 10;
  const safeRecipient = String(recipient || '').trim();
  const ctaUrl = cta?.url ? String(cta.url).trim() : '';
  const ctaLabel = cta?.label ? String(cta.label).trim() : '';
  const year = new Date().getFullYear();

  const text = [
    String(subject || 'eloride • Đặt lại mật khẩu'),
    safeRecipient ? `Xin chào ${safeRecipient},` : 'Xin chào,',
    'Chúng tôi vừa nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.',
    '',
    `Mã xác thực: ${safeCode}`,
    `Hiệu lực: ${mins} phút`,
    ctaUrl ? `Liên kết: ${ctaUrl}` : '',
    '',
    'Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.',
    'Không chia sẻ mã xác thực cho bất kỳ ai (kể cả nhân viên hỗ trợ).'
  ]
    .filter(Boolean)
    .join('\n');

  const html = `
    <div style="margin:0;padding:0;background:#05080f;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">
        eloride: Mã xác thực ${safeCode} (hết hạn sau ${mins} phút)
      </div>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse">
        <tr>
          <td align="center" style="padding:32px 16px">
            <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;border-collapse:separate;border-spacing:0;border:1px solid #1f2937;border-radius:22px;overflow:hidden;background:#0b1220">
              <tr>
                <td style="padding:26px 24px;background:linear-gradient(135deg,#0ea5e9 0%,#22d3ee 45%,#a855f7 100%);color:#071018">
                  <div style="font-weight:900;font-size:18px;letter-spacing:0.4px;text-transform:uppercase">eloride</div>
                  <div style="margin-top:8px;font-weight:900;font-size:20px;letter-spacing:0.2px">Đặt lại mật khẩu</div>
                  <div style="margin-top:6px;font-size:12px;opacity:0.85">Bảo mật tài khoản của bạn trong vài phút</div>
                </td>
              </tr>
              <tr>
                <td style="padding:22px 24px;color:#e5e7eb">
                  <div style="font-size:14px;line-height:1.7;color:#cbd5e1">
                    Xin chào${safeRecipient ? ` <b style="color:#f8fafc">${safeRecipient}</b>` : ''},
                    <div style="margin-top:8px;color:#94a3b8">
                      Chúng tôi vừa nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.
                    </div>
                  </div>
                  <div style="margin-top:18px;padding:18px;border:1px solid #1f2937;border-radius:16px;background:#0a1020;text-align:center">
                    <div style="font-size:12px;letter-spacing:1.2px;color:#94a3b8">MÃ XÁC THỰC</div>
                    <div style="margin-top:10px">
                      <span style="display:inline-block;font-weight:950;font-size:34px;letter-spacing:12px;color:#f8fafc">${safeCode}</span>
                    </div>
                    <div style="margin-top:10px;font-size:12px;color:#94a3b8">Hiệu lực <b style="color:#e2e8f0">${mins} phút</b></div>
                  </div>
                  ${
                    ctaUrl && ctaLabel
                      ? `
                  <div style="margin-top:18px;text-align:center">
                    <a href="${ctaUrl}" style="display:inline-block;background:#0ea5e9;color:#071018;text-decoration:none;padding:12px 18px;border-radius:12px;font-size:13px;font-weight:900;letter-spacing:0.2px">
                      ${ctaLabel}
                    </a>
                  </div>
                  <div style="margin-top:10px;font-size:12px;line-height:1.7;color:#64748b">
                    Nếu nút không hoạt động, hãy sao chép liên kết này và mở trên trình duyệt:
                    <div style="margin-top:6px;word-break:break-all;color:#94a3b8">${ctaUrl}</div>
                  </div>
                  `.trim()
                      : ''
                  }
                  <div style="margin-top:18px;height:1px;background:#1f2937"></div>
                  <div style="margin-top:14px;font-size:12px;line-height:1.7;color:#64748b">
                    Không chia sẻ mã xác thực cho bất kỳ ai (kể cả nhân viên hỗ trợ).
                    Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.
                  </div>
                  <div style="margin-top:14px;font-size:12px;line-height:1.7;color:#64748b">
                    Trân trọng,<br/>Đội ngũ eloride
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 24px;background:#0a0f1a;color:#64748b;font-size:12px;line-height:1.6">
                  © ${year} eloride
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `.trim();

  return { subject, text, html };
};

const normalizeRole = (value) => {
  const v = String(value || '')
    .trim()
    .toUpperCase();
  if (v === 'ADMIN' || v === 'VENDOR' || v === 'USER' || v === 'ACCOUNTANT') return v;
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
  return jwt.sign(
    { sub: String(userId), email: normalizedEmail, isAdmin, role: safeRole },
    process.env.JWT_SECRET,
    { expiresIn: getAccessTokenExpiresIn() }
  );
};

const toUserJson = (user) => {
  const email = normalizeEmail(user?.email);
  const adminEmails = parseAdminEmails();
  const isAdmin = email ? adminEmails.has(email) : false;
  const role = isAdmin ? 'ADMIN' : normalizeRole(user?.role);
  const ownedCars = Array.isArray(user?.ownedCars) ? user.ownedCars.map((x) => String(x)) : [];
  return {
    id: user?._id,
    name: user?.name || '',
    email,
    provider: user?.provider || 'local',
    providerId: user?.providerId ? String(user.providerId) : '',
    avatar: user?.avatar || '',
    phone: user?.phone || '',
    dob: user?.dob || null,
    gender: user?.gender || '',
    country: user?.country || '',
    city: user?.city || '',
    ownedCars,
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
  if (!isValidEmail(normalizedEmail)) {
    const err = new Error('INVALID_EMAIL');
    err.statusCode = 400;
    throw err;
  }

  const byEmail = await User.findOne({ email: normalizedEmail }).select('+password name email provider providerId avatar createdAt role');
  if (byEmail) {
    const existingPid = String(byEmail.providerId || '').trim();
    const existingProvider = String(byEmail.provider || '').trim();

    if (existingPid && existingProvider && existingProvider !== 'local' && (existingProvider !== p || existingPid !== pid)) {
      const err = new Error('EMAIL_ALREADY_LINKED');
      err.statusCode = 409;
      throw err;
    }

    const patch = {};
    if (!existingProvider || existingProvider === p) {
      patch.provider = p;
      patch.providerId = pid;
    }
    if (existingProvider === 'local' && existingPid) {
      patch.providerId = existingPid;
    }
    if (safeName && !String(byEmail.name || '').trim()) patch.name = safeName;
    if (safeAvatar && !String(byEmail.avatar || '').trim()) patch.avatar = safeAvatar;
    const adminEmails = parseAdminEmails();
    const adminBoot = String(process.env.ADMIN_BOOT_PASSWORD || '').trim();
    if (adminEmails.has(normalizedEmail) && !String(byEmail.password || '').trim() && adminBoot) {
      patch.password = await bcrypt.hash(adminBoot, 10);
      patch.passwordHash = patch.password;
      patch.role = 'ADMIN';
    }

    if (Object.keys(patch).length) await User.updateOne({ _id: byEmail._id }, { $set: patch });
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
  const password = String(req.body?.password || '');
  const name = String(req.body?.name || '').trim();
  const isVendor = Boolean(req.body?.isVendor) || normalizeRole(req.body?.role) === 'VENDOR';

  if (!password) return res.status(400).json({ error: 'MISSING_FIELDS' });
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  if (password.length < 8 || !hasUpper || !hasDigit) return res.status(400).json({ error: 'WEAK_PASSWORD' });

  let vendorPayload = null;
  if (isVendor) {
    const checkedEmail = validateUserEmail(req.body?.email);
    if (!checkedEmail.ok) return res.status(400).json({ error: checkedEmail.error });
    const email = checkedEmail.value;
    const existing = await User.findOne({ email }).lean();
    if (existing) return res.status(409).json({ error: 'EMAIL_EXISTS' });
    const shopName = String(req.body?.shopName || '').trim();
    if (!shopName) return res.status(400).json({ error: 'MISSING_SHOP_NAME' });
    if (isInappropriateText(shopName)) return res.status(400).json({ error: 'SHOP_NAME_INAPPROPRIATE' });

    const checkedName = name ? validateUserName(name) : { ok: true, value: '' };
    if (!checkedName.ok) return res.status(400).json({ error: checkedName.error });

    const checkedVendorPhone = validateUserPhone(req.body?.phone);
    if (!checkedVendorPhone.ok) return res.status(400).json({ error: checkedVendorPhone.error });

    const vendorEmailRaw = String(req.body?.vendorEmail || req.body?.shopEmail || '').trim();
    const checkedVendorEmail = vendorEmailRaw ? validateUserEmail(vendorEmailRaw) : { ok: true, value: '' };
    if (!checkedVendorEmail.ok) return res.status(400).json({ error: checkedVendorEmail.error });

    vendorPayload = {
      shopName,
      description: String(req.body?.description || '').trim(),
      phone: checkedVendorPhone.value,
      email: checkedVendorEmail.value,
      address: String(req.body?.address || '').trim(),
      website: String(req.body?.website || '').trim(),
      facebook: String(req.body?.facebook || '').trim(),
      logo: String(req.body?.logo || '').trim(),
      coverImage: String(req.body?.coverImage || '').trim(),
      status: 'pending'
    };
    const passwordHash = await bcrypt.hash(password, 10);
    const adminEmails = parseAdminEmails();
    const role = adminEmails.has(email) ? 'ADMIN' : 'USER';
    const user = await User.create({
      email,
      password: passwordHash,
      passwordHash,
      name: checkedName.value,
      provider: 'local',
      providerId: email,
      role
    });

    await Vendor.create({ userId: user._id, ...vendorPayload });
    const token = signToken({ userId: user._id, email: user.email, role: user.role });
    return res.status(201).json({ ok: true, token, user: toUserJson(user) });
  }

  const identifierRaw = String(req.body?.identifier || req.body?.emailOrPhone || req.body?.email || req.body?.phone || '').trim();
  if (identifierRaw && isInappropriateText(identifierRaw)) {
    return res.status(400).json({ error: identifierRaw.includes('@') ? 'EMAIL_INAPPROPRIATE' : 'PHONE_INAPPROPRIATE' });
  }
  const id = parseIdentifier(identifierRaw);
  if (!id.kind) return res.status(400).json({ error: 'MISSING_FIELDS' });
  if (id.kind === 'email' && !id.email) return res.status(400).json({ error: 'INVALID_EMAIL' });
  if (id.kind === 'phone' && !id.phone) return res.status(400).json({ error: 'INVALID_PHONE' });

  const checkedName = name ? validateUserName(name) : { ok: true, value: '' };
  if (!checkedName.ok) return res.status(400).json({ error: checkedName.error });

  const dobRaw = String(req.body?.dob || '').trim();
  const dob = dobRaw ? new Date(dobRaw) : null;
  const gender = normalizeGender(req.body?.gender);
  const country = String(req.body?.country || '').trim();

  const now = new Date();
  const code = createOtpCode();
  const codeHash = crypto.createHash('sha256').update(code).digest('hex');
  const expires = new Date(Date.now() + 5 * 60 * 1000);
  const passwordHash = await bcrypt.hash(password, 10);

  const noSmtp =
    !(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS);
  const echo = String(process.env.ALLOW_RESET_CODE_ECHO || '').toLowerCase() === 'true';

  const patch = {
    name: checkedName.value,
    dob: dob && !Number.isNaN(dob.getTime()) ? dob : null,
    gender,
    country,
    emailVerified: false,
    verifyCodeHash: codeHash,
    verifyCodeExpires: expires,
    registrationPending: true,
    otpLastSentAt: now,
    otpVerifyFailCount: 0,
    otpVerifyLockedUntil: null,
    provider: 'local'
  };

  let user = null;
  if (id.kind === 'email') {
    const existing = await User.findOne({ email: id.email }).select(
      '_id email emailVerified registrationPending provider role name avatar createdAt +password +passwordHash'
    );
    if (existing && String(existing.provider || '') !== 'local') return res.status(409).json({ error: 'EMAIL_ALREADY_LINKED' });
    if (existing) {
      if (existing.registrationPending && !existing.emailVerified) {
        await User.updateOne(
          { _id: existing._id },
          {
            $set: {
              ...patch,
              password: passwordHash,
              passwordHash
            }
          }
        );
        const mail = buildOtpEmail({
          subject: 'eloride • Mã xác thực đăng ký',
          heading: 'Xác thực đăng ký',
          message: 'Chúng tôi vừa nhận được yêu cầu tạo tài khoản eloride cho',
          code,
          expiresMinutes: 5,
          recipient: maskEmail(id.email)
        });
        await sendMail({ to: id.email, subject: mail.subject, text: mail.text, html: mail.html });
        return res.status(200).json(
          noSmtp || echo ? { ok: true, existing: true, requiresOtp: true, channel: 'email', code } : { ok: true, existing: true, requiresOtp: true, channel: 'email' }
        );
      }

      let storedHash = String(existing.password || '').trim();
      if (!storedHash) {
        const legacy = String(existing.passwordHash || '').trim();
        if (legacy) storedHash = legacy;
      }
      if (!storedHash) return res.status(409).json({ error: 'EMAIL_EXISTS' });

      const ok = await bcrypt.compare(password, storedHash);
      if (!ok) return res.status(409).json({ error: 'EMAIL_EXISTS' });

      const token = signToken({ userId: existing._id, email: existing.email, role: existing.role });
      return res.status(200).json({ ok: true, existing: true, token, user: toUserJson(existing) });
    }
    {
      const adminEmails = parseAdminEmails();
      const role = adminEmails.has(id.email) ? 'ADMIN' : 'USER';
      user = await User.create({
        ...patch,
        email: id.email,
        phone: '',
        password: passwordHash,
        passwordHash,
        providerId: id.email,
        role
      });
    }

    const mail = buildOtpEmail({
      subject: 'eloride • Mã xác thực đăng ký',
      heading: 'Xác thực đăng ký',
      message: 'Chúng tôi vừa nhận được yêu cầu tạo tài khoản eloride cho',
      code,
      expiresMinutes: 5,
      recipient: maskEmail(id.email)
    });
    await sendMail({ to: id.email, subject: mail.subject, text: mail.text, html: mail.html });
    return res.status(200).json(noSmtp || echo ? { ok: true, requiresOtp: true, channel: 'email', code } : { ok: true, requiresOtp: true, channel: 'email' });
  }

  const phone = id.phone;
  const internalEmail = `phone_${phone.replace(/[^\d]/g, '')}@carbanana.local`;
  const existingByPhone = await User.findOne({ phone }).select('_id emailVerified registrationPending provider');
  if (existingByPhone && String(existingByPhone.provider || '') !== 'local') return res.status(409).json({ error: 'PHONE_ALREADY_LINKED' });
  if (existingByPhone) return res.status(409).json({ error: 'PHONE_EXISTS' });
  user = await User.create({
    ...patch,
    email: internalEmail,
    phone,
    password: passwordHash,
    passwordHash,
    providerId: internalEmail,
    role: 'USER'
  });

  console.log(`[auth] mock sms otp to ${phone}: ${code}`);
  return res.status(200).json(echo ? { ok: true, requiresOtp: true, channel: 'sms', code } : { ok: true, requiresOtp: true, channel: 'sms' });
});

const verifyOtp = asyncHandler(async (req, res) => {
  const identifierRaw = String(req.body?.identifier || req.body?.emailOrPhone || req.body?.email || req.body?.phone || '').trim();
  const code = String(req.body?.code || req.body?.otp || '').trim();
  if (!identifierRaw || !code) return res.status(400).json({ error: 'MISSING_FIELDS' });
  if (isInappropriateText(identifierRaw)) {
    return res.status(400).json({ error: identifierRaw.includes('@') ? 'EMAIL_INAPPROPRIATE' : 'PHONE_INAPPROPRIATE' });
  }

  const id = parseIdentifier(identifierRaw);
  if (id.kind === 'email' && !id.email) return res.status(400).json({ error: 'INVALID_EMAIL' });
  if (id.kind === 'phone' && !id.phone) return res.status(400).json({ error: 'INVALID_PHONE' });

  const now = new Date();
  const LOCK_AFTER = 5;
  const LOCK_MS = 5 * 60 * 1000;

  const identityQuery = id.kind === 'email' ? { email: id.email } : { phone: id.phone };
  const pending = await User.findOne({ ...identityQuery, registrationPending: true })
    .select('_id email role +verifyCodeHash +verifyCodeExpires +otpVerifyFailCount +otpVerifyLockedUntil');
  if (!pending) return res.status(400).json({ error: 'INVALID_OTP' });

  const lockedUntil = pending.otpVerifyLockedUntil instanceof Date ? pending.otpVerifyLockedUntil : null;
  if (lockedUntil && lockedUntil.getTime() > now.getTime()) return res.status(429).json({ error: 'OTP_LOCKED' });
  if (lockedUntil && lockedUntil.getTime() <= now.getTime()) {
    await User.updateOne(
      { _id: pending._id },
      { $set: { otpVerifyFailCount: 0 }, $unset: { otpVerifyLockedUntil: '' } }
    );
    pending.otpVerifyFailCount = 0;
    pending.otpVerifyLockedUntil = null;
  }

  const expiresAt = pending.verifyCodeExpires instanceof Date ? pending.verifyCodeExpires : null;
  if (expiresAt && expiresAt.getTime() <= now.getTime()) return res.status(400).json({ error: 'OTP_EXPIRED' });

  const codeHash = crypto.createHash('sha256').update(code).digest('hex');
  const storedHash = String(pending.verifyCodeHash || '').trim();
  if (!storedHash || storedHash !== codeHash) {
    const prev = Number.isFinite(pending.otpVerifyFailCount) ? pending.otpVerifyFailCount : 0;
    const nextCount = prev + 1;
    if (nextCount >= LOCK_AFTER) {
      await User.updateOne(
        { _id: pending._id },
        { $set: { otpVerifyFailCount: nextCount, otpVerifyLockedUntil: new Date(now.getTime() + LOCK_MS) } }
      );
      return res.status(429).json({ error: 'OTP_LOCKED' });
    }
    await User.updateOne({ _id: pending._id }, { $set: { otpVerifyFailCount: nextCount } });
    return res.status(400).json({ error: 'INVALID_OTP' });
  }

  await User.updateOne(
    { _id: pending._id },
    {
      $set: { emailVerified: true, registrationPending: false, otpVerifyFailCount: 0 },
      $unset: {
        verifyCodeHash: '',
        verifyCodeExpires: '',
        otpLastSentAt: '',
        otpVerifyLockedUntil: ''
      }
    }
  );

  const fresh = await User.findById(pending._id).select('name email provider providerId avatar createdAt role');
  const token = signToken({ userId: pending._id, email: fresh?.email, role: fresh?.role });
  const csrfToken = createCsrfToken();
  const refresh = await createRefreshSession({ req, userId: pending._id });
  if (refresh.ok) setAuthCookies(res, { refreshToken: refresh.refreshToken, csrfToken });
  res.json({ ok: true, token, csrfToken: refresh.ok ? csrfToken : '', user: toUserJson(fresh) });
});

const resendOtp = asyncHandler(async (req, res) => {
  const identifierRaw = String(req.body?.identifier || req.body?.emailOrPhone || req.body?.email || req.body?.phone || '').trim();
  if (!identifierRaw) return res.status(400).json({ error: 'MISSING_FIELDS' });
  if (isInappropriateText(identifierRaw)) {
    return res.status(400).json({ error: identifierRaw.includes('@') ? 'EMAIL_INAPPROPRIATE' : 'PHONE_INAPPROPRIATE' });
  }

  const id = parseIdentifier(identifierRaw);
  if (id.kind === 'email' && !id.email) return res.status(400).json({ error: 'INVALID_EMAIL' });
  if (id.kind === 'phone' && !id.phone) return res.status(400).json({ error: 'INVALID_PHONE' });

  const now = new Date();
  const query = id.kind === 'email' ? { email: id.email } : { phone: id.phone };
  const user = await User.findOne(query).select('_id email emailVerified registrationPending +otpLastSentAt +otpVerifyLockedUntil');
  if (!user) return res.json({ ok: true });
  if (user.emailVerified || !user.registrationPending) return res.json({ ok: true });

  const lockedUntil = user.otpVerifyLockedUntil instanceof Date ? user.otpVerifyLockedUntil : null;
  if (lockedUntil && lockedUntil.getTime() > now.getTime()) return res.status(429).json({ error: 'OTP_LOCKED' });

  const last = user.otpLastSentAt instanceof Date ? user.otpLastSentAt.getTime() : 0;
  if (last && now.getTime() - last < 30 * 1000) return res.status(429).json({ error: 'OTP_TOO_SOON' });

  const code = createOtpCode();
  const codeHash = crypto.createHash('sha256').update(code).digest('hex');
  const expires = new Date(Date.now() + 5 * 60 * 1000);

  await User.updateOne(
    { _id: user._id },
    {
      $set: { verifyCodeHash: codeHash, verifyCodeExpires: expires, otpLastSentAt: now, otpVerifyFailCount: 0 },
      $unset: { otpVerifyLockedUntil: '' }
    }
  );

  const echo = String(process.env.ALLOW_RESET_CODE_ECHO || '').toLowerCase() === 'true';
  const noSmtp =
    !(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS);

  if (id.kind === 'email') {
    const mail = buildOtpEmail({
      subject: 'eloride • Mã xác thực đăng ký',
      heading: 'Xác thực đăng ký',
      message: 'Chúng tôi vừa nhận được yêu cầu gửi lại mã xác thực đăng ký cho',
      code,
      expiresMinutes: 5,
      recipient: maskEmail(id.email)
    });
    await sendMail({ to: id.email, subject: mail.subject, text: mail.text, html: mail.html });
    return res.json(noSmtp || echo ? { ok: true, code } : { ok: true });
  }

  console.log(`[auth] mock sms otp to ${id.phone}: ${code}`);
  return res.json(echo ? { ok: true, code } : { ok: true });
});

const beginOAuthOtpLogin = async ({ provider, providerId, email, name, avatar }) => {
  const p = String(provider || '').trim();
  const pid = String(providerId || '').trim();
  const inputEmail = normalizeEmail(email);

  const preExisting =
    (p && pid) || inputEmail
      ? await User.findOne({
          $or: [
            p && pid ? { provider: p, providerId: pid } : null,
            inputEmail ? { email: inputEmail } : null
          ].filter(Boolean)
        })
          .select('_id provider registrationPending emailVerified')
          .lean()
      : null;

  const user = await upsertOAuthUser({ provider, providerId, email, name, avatar });
  const normalizedEmail = normalizeEmail(user?.email);
  if (!normalizedEmail) {
    const err = new Error('MISSING_EMAIL');
    err.statusCode = 400;
    throw err;
  }

  const canSkipOtp = Boolean(
    preExisting &&
      !(
        String(preExisting?.provider || '') === 'local' &&
        Boolean(preExisting?.registrationPending) &&
        !Boolean(preExisting?.emailVerified)
      )
  );
  if (canSkipOtp) {
    await User.updateOne(
      { _id: user._id },
      {
        $set: { emailVerified: true, registrationPending: false },
        $unset: {
          oauthLoginTicketHash: '',
          oauthLoginTicketExpires: '',
          oauthLoginOtpHash: '',
          oauthLoginOtpExpires: '',
          oauthLoginOtpLastSentAt: ''
        }
      }
    );
    const token = signToken({ userId: user._id, email: user.email, role: user.role });
    return { token };
  }

  const buildLoginOtpEmail = ({ code }) => {
    return buildOtpEmail({
      subject: 'eloride • Mã xác thực đăng nhập',
      heading: 'Xác thực đăng nhập',
      message: 'Chúng tôi vừa nhận được yêu cầu đăng nhập eloride cho',
      code,
      expiresMinutes: 5,
      recipient: maskEmail(normalizedEmail)
    });
  };

  const now = new Date();
  const ticket = createOpaqueToken();
  const code = createOtpCode();
  const ticketHash = sha256(ticket);
  const codeHash = sha256(code);
  const otpExpires = new Date(Date.now() + 5 * 60 * 1000);
  const ticketExpires = new Date(Date.now() + 15 * 60 * 1000);

  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        oauthLoginTicketHash: ticketHash,
        oauthLoginTicketExpires: ticketExpires,
        oauthLoginOtpHash: codeHash,
        oauthLoginOtpExpires: otpExpires,
        oauthLoginOtpLastSentAt: now
      }
    }
  );

  const mail = buildLoginOtpEmail({ code });
  await sendMail({ to: normalizedEmail, subject: mail.subject, text: mail.text, html: mail.html });

  return { ticket };
};

const verifyOAuthOtp = asyncHandler(async (req, res) => {
  const ticket = String(req.body?.ticket || '').trim();
  const code = String(req.body?.code || req.body?.otp || '').trim();
  if (!ticket || !code) return res.status(400).json({ error: 'MISSING_FIELDS' });

  const now = new Date();
  const ticketHash = sha256(ticket);
  const codeHash = sha256(code);

  const user = await User.findOne({
    oauthLoginTicketHash: ticketHash,
    oauthLoginTicketExpires: { $gt: now },
    oauthLoginOtpHash: codeHash,
    oauthLoginOtpExpires: { $gt: now }
  }).select('name email provider providerId avatar createdAt role');
  if (!user) return res.status(400).json({ error: 'INVALID_OTP' });

  await User.updateOne(
    { _id: user._id },
    {
      $unset: {
        oauthLoginTicketHash: '',
        oauthLoginTicketExpires: '',
        oauthLoginOtpHash: '',
        oauthLoginOtpExpires: '',
        oauthLoginOtpLastSentAt: ''
      }
    }
  );

  const token = signToken({ userId: user._id, email: user.email, role: user.role });
  const csrfToken = createCsrfToken();
  const refresh = await createRefreshSession({ req, userId: user._id });
  if (refresh.ok) setAuthCookies(res, { refreshToken: refresh.refreshToken, csrfToken });
  res.json({ ok: true, token, csrfToken: refresh.ok ? csrfToken : '', user: toUserJson(user) });
});

const resendOAuthOtp = asyncHandler(async (req, res) => {
  const ticket = String(req.body?.ticket || '').trim();
  if (!ticket) return res.status(400).json({ error: 'MISSING_FIELDS' });

  const now = new Date();
  const ticketHash = sha256(ticket);
  const user = await User.findOne({
    oauthLoginTicketHash: ticketHash,
    oauthLoginTicketExpires: { $gt: now }
  }).select('_id email +oauthLoginOtpLastSentAt');
  if (!user) return res.status(400).json({ error: 'INVALID_SESSION' });

  const last = user.oauthLoginOtpLastSentAt instanceof Date ? user.oauthLoginOtpLastSentAt.getTime() : 0;
  if (last && now.getTime() - last < 30 * 1000) return res.status(429).json({ error: 'OTP_TOO_SOON' });

  const code = createOtpCode();
  const codeHash = sha256(code);
  const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

  await User.updateOne(
    { _id: user._id },
    { $set: { oauthLoginOtpHash: codeHash, oauthLoginOtpExpires: otpExpires, oauthLoginOtpLastSentAt: now } }
  );

  const mail = buildOtpEmail({
    subject: 'eloride • Mã xác thực đăng nhập',
    heading: 'Xác thực đăng nhập',
    message: 'Chúng tôi vừa nhận được yêu cầu gửi lại mã xác thực đăng nhập cho',
    code,
    expiresMinutes: 5,
    recipient: maskEmail(normalizeEmail(user.email))
  });
  await sendMail({ to: normalizeEmail(user.email), subject: mail.subject, text: mail.text, html: mail.html });

  res.json({ ok: true });
});

const login = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || '');

  if (!email || !password) return res.status(400).json({ error: 'MISSING_FIELDS' });
  if (!isValidEmail(email)) return res.status(400).json({ error: 'INVALID_EMAIL' });
  if (isInappropriateText(email)) return res.status(400).json({ error: 'EMAIL_INAPPROPRIATE' });

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

  if (String(user.provider || '') === 'local' && user.registrationPending && !user.emailVerified) {
    return res.status(403).json({ error: 'OTP_REQUIRED' });
  }

  const adminEmails = parseAdminEmails();
  const role = adminEmails.has(email) ? 'ADMIN' : normalizeRole(user?.role);
  if (role !== normalizeRole(user?.role)) {
    await User.updateOne({ _id: user._id }, { $set: { role } });
  }
  const token = signToken({ userId: user._id, email: user.email, role });
  const csrfToken = createCsrfToken();
  const refresh = await createRefreshSession({ req, userId: user._id });
  if (refresh.ok) setAuthCookies(res, { refreshToken: refresh.refreshToken, csrfToken });
  res.json({ ok: true, token, csrfToken: refresh.ok ? csrfToken : '', user: toUserJson(user) });
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
  if (!isValidEmail(email)) return res.status(400).json({ error: 'INVALID_EMAIL' });
  if (isInappropriateText(email)) return res.status(400).json({ error: 'EMAIL_INAPPROPRIATE' });
  const user = await User.findOne({ email }).select('_id');
  if (!user) {
    console.log(`[auth] request-reset ignored: email not found (${email})`);
    return res.status(404).json({ error: 'EMAIL_NOT_FOUND' });
  }
  const token = crypto.randomBytes(32).toString('hex');
  const code = `${Math.floor(100000 + Math.random() * 900000)}`;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const codeHash = crypto.createHash('sha256').update(code).digest('hex');
  const expires = new Date(Date.now() + 10 * 60 * 1000);
  await User.updateOne(
    { _id: user._id },
    { $set: { resetTokenHash: tokenHash, resetCodeHash: codeHash, resetTokenExpires: expires } }
  );
  const base = String(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
  const resetUrl = `${base}/reset-password?token=${encodeURIComponent(token)}`;
  const mail = buildPasswordResetEmail({
    subject: 'eloride • Mã xác thực đặt lại mật khẩu',
    code,
    expiresMinutes: 10,
    recipient: maskEmail(email),
    cta: { label: 'Đặt lại mật khẩu', url: resetUrl }
  });
  await sendMail({ to: email, subject: mail.subject, text: mail.text, html: mail.html });
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
  if (!isValidEmail(email)) return res.status(400).json({ error: 'INVALID_EMAIL' });
  if (isInappropriateText(email)) return res.status(400).json({ error: 'EMAIL_INAPPROPRIATE' });
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

const verifyResetCode = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const code = String(req.body?.code || '');
  if (!email || !code) return res.status(400).json({ error: 'MISSING_FIELDS' });
  if (!isValidEmail(email)) return res.status(400).json({ error: 'INVALID_EMAIL' });
  if (isInappropriateText(email)) return res.status(400).json({ error: 'EMAIL_INAPPROPRIATE' });
  const codeHash = crypto.createHash('sha256').update(code).digest('hex');
  const now = new Date();
  const user = await User.findOne({
    email,
    resetCodeHash: codeHash,
    resetTokenExpires: { $gt: now }
  }).select('_id');
  if (!user) return res.status(400).json({ error: 'INVALID_CODE' });
  res.json({ ok: true });
});

const requestVerifyEmail = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!email) return res.status(400).json({ error: 'MISSING_EMAIL' });
  if (!isValidEmail(email)) return res.status(400).json({ error: 'INVALID_EMAIL' });
  if (isInappropriateText(email)) return res.status(400).json({ error: 'EMAIL_INAPPROPRIATE' });
  const user = await User.findOne({ email }).select('_id emailVerified');
  if (!user) return res.json({ ok: true });
  if (user.emailVerified) return res.json({ ok: true });
  const code = `${Math.floor(100000 + Math.random() * 900000)}`;
  const codeHash = crypto.createHash('sha256').update(code).digest('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000);
  await User.updateOne({ _id: user._id }, { $set: { verifyCodeHash: codeHash, verifyCodeExpires: expires } });
  const mail = buildOtpEmail({
    subject: 'eloride • Xác minh email',
    heading: 'Xác minh email',
    message: 'Chúng tôi vừa nhận được yêu cầu xác minh email cho',
    code,
    expiresMinutes: 60,
    recipient: maskEmail(email)
  });
  await sendMail({ to: email, subject: mail.subject, text: mail.text, html: mail.html });
  const inDevNoSmtp = !(
    process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS
  );
  res.json(inDevNoSmtp ? { ok: true, code } : { ok: true });
});

const verifyEmail = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const code = String(req.body?.code || '');
  if (!email || !code) return res.status(400).json({ error: 'MISSING_FIELDS' });
  if (!isValidEmail(email)) return res.status(400).json({ error: 'INVALID_EMAIL' });
  if (isInappropriateText(email)) return res.status(400).json({ error: 'EMAIL_INAPPROPRIATE' });
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

const isValidObjectId = (value) => {
  try {
    return mongoose.Types.ObjectId.isValid(String(value || '').trim());
  } catch {
    return false;
  }
};

const uniqueStrings = (arr) => {
  const out = [];
  const seen = new Set();
  for (const v of Array.isArray(arr) ? arr : []) {
    const s = String(v || '').trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
};

const getMe = asyncHandler(async (req, res) => {
  const userId = String(req.user?.id || '').trim();
  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });
  const user = await User.findById(userId).select('name email provider providerId avatar createdAt role phone dob gender country city ownedCars');
  if (!user) return res.status(401).json({ error: 'UNAUTHORIZED' });
  res.json({ ok: true, user: toUserJson(user) });
});

const updateMe = asyncHandler(async (req, res) => {
  const userId = String(req.user?.id || '').trim();
  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });

  const patch = {};
  if (req.body?.name != null) {
    const checked = validateUserName(req.body.name);
    if (!checked.ok) return res.status(400).json({ error: checked.error });
    patch.name = checked.value;
  }
  if (req.body?.phone != null) {
    const checkedPhone = validateUserPhone(req.body.phone);
    if (!checkedPhone.ok) return res.status(400).json({ error: checkedPhone.error });
    patch.phone = checkedPhone.value;
  }
  if (req.body?.gender != null) patch.gender = normalizeGender(req.body.gender);
  if (req.body?.country != null) patch.country = String(req.body.country || '').trim().slice(0, 40);
  if (req.body?.city != null) patch.city = String(req.body.city || '').trim().slice(0, 60);
  if (req.body?.dob != null) {
    const raw = String(req.body.dob || '').trim();
    if (!raw) patch.dob = null;
    else {
      const d = new Date(raw);
      patch.dob = Number.isFinite(d.getTime()) ? d : null;
    }
  }

  if (req.body?.ownedCars != null) {
    const ids = uniqueStrings(req.body.ownedCars).filter(isValidObjectId);
    patch.ownedCars = ids;
  }

  await User.updateOne({ _id: userId }, { $set: patch });
  const user = await User.findById(userId).select('name email provider providerId avatar createdAt role phone dob gender country city ownedCars');
  if (!user) return res.status(401).json({ error: 'UNAUTHORIZED' });
  res.json({ ok: true, user: toUserJson(user) });
});

const setMyAvatar = asyncHandler(async (req, res) => {
  const userId = String(req.user?.id || '').trim();
  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'MISSING_FILE' });
  const url = `/uploads/avatars/${file.filename}`;
  await User.updateOne({ _id: userId }, { $set: { avatar: url } });
  const user = await User.findById(userId).select('name email provider providerId avatar createdAt role phone dob gender country city ownedCars');
  if (!user) return res.status(401).json({ error: 'UNAUTHORIZED' });
  res.json({ ok: true, user: toUserJson(user) });
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const refreshToken = String(req.cookies?.refreshToken || '').trim();
  if (!refreshToken) return res.status(401).json({ error: 'UNAUTHORIZED' });
  if (!getRefreshSecret()) return res.status(500).json({ error: 'MISSING_REFRESH_SECRET' });

  const now = new Date();
  const tokenHash = hashRefreshToken(refreshToken);
  const session = await RefreshSession.findOne({
    tokenHash,
    revokedAt: null,
    expiresAt: { $gt: now }
  })
    .select('_id userId')
    .lean();
  if (!session) return res.status(401).json({ error: 'UNAUTHORIZED' });

  const user = await User.findById(session.userId).select('email role').lean();
  if (!user) {
    await RefreshSession.updateOne({ _id: session._id }, { $set: { revokedAt: now } });
    clearAuthCookies(res);
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }

  const nextRefreshToken = crypto.randomBytes(48).toString('hex');
  const nextHash = hashRefreshToken(nextRefreshToken);
  const ip = trimHeaderValue(req?.clientIp || req?.ip, 80);
  const ua = trimHeaderValue(req?.headers?.['user-agent'], 300);
  await RefreshSession.updateOne(
    { _id: session._id },
    { $set: { tokenHash: nextHash, lastUsedAt: now, rotatedAt: now, ip, ua } }
  );

  const csrfToken = String(req.cookies?.csrfToken || '').trim() || createCsrfToken();
  setAuthCookies(res, { refreshToken: nextRefreshToken, csrfToken });

  const token = signToken({ userId: session.userId, email: user.email, role: user.role });
  res.json({ ok: true, token, csrfToken });
});

const logout = asyncHandler(async (req, res) => {
  const refreshToken = String(req.cookies?.refreshToken || '').trim();
  const now = new Date();
  if (refreshToken && getRefreshSecret()) {
    const tokenHash = hashRefreshToken(refreshToken);
    await RefreshSession.updateOne({ tokenHash, revokedAt: null }, { $set: { revokedAt: now } });
  }
  clearAuthCookies(res);
  res.json({ ok: true });
});

module.exports = {
  register,
  verifyOtp,
  resendOtp,
  login,
  signToken,
  upsertOAuthUser,
  completeOAuthLogin,
  beginOAuthOtpLogin,
  verifyOAuthOtp,
  resendOAuthOtp,
  changePassword,
  requestPasswordReset,
  resetPassword,
  resetPasswordByCode,
  verifyResetCode,
  requestVerifyEmail,
  verifyEmail,
  getMe,
  updateMe,
  setMyAvatar,
  refreshAccessToken,
  logout
};
