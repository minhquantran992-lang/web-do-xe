const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const passport = require('passport');
const {
  register,
  verifyOtp,
  resendOtp,
  login,
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
} = require('../controllers/authController');
const { authRequired } = require('../middleware/auth');
const { rateLimit, compose } = require('../middleware/rateLimit');
const { requireTurnstile } = require('../middleware/turnstile');
const { requireCsrf } = require('../middleware/csrfProtection');
const { validateAvatarFile } = require('../security/uploadValidation');

const router = express.Router();

const ipKey = (req) => req.clientIp || req.ip || '';
const normalizeIdentifier = (req) => {
  const body = req.body || {};
  const raw = String(body.identifier || body.emailOrPhone || body.email || body.phone || '').trim().toLowerCase();
  if (!raw) return '';
  return raw.replace(/\s+/g, '');
};

const rlLogin = compose(
  rateLimit({ name: 'login_ip', keyPrefix: 'login_ip', points: 5, durationSec: 60, keyFn: ipKey }),
  rateLimit({ name: 'login_id', keyPrefix: 'login_id', points: 5, durationSec: 60, keyFn: normalizeIdentifier })
);
const rlRegister = rateLimit({ name: 'register_ip', keyPrefix: 'register_ip', points: 3, durationSec: 60, keyFn: ipKey });
const rlOtpVerify = compose(
  rateLimit({ name: 'otp_verify_ip', keyPrefix: 'otp_verify_ip', points: 10, durationSec: 60, keyFn: ipKey }),
  rateLimit({ name: 'otp_verify_id', keyPrefix: 'otp_verify_id', points: 10, durationSec: 60, keyFn: normalizeIdentifier })
);
const rlOtpResend = compose(
  rateLimit({ name: 'otp_resend_ip', keyPrefix: 'otp_resend_ip', points: 3, durationSec: 60, keyFn: ipKey }),
  rateLimit({ name: 'otp_resend_id', keyPrefix: 'otp_resend_id', points: 3, durationSec: 60, keyFn: normalizeIdentifier })
);
const rlReset = compose(
  rateLimit({ name: 'reset_ip', keyPrefix: 'reset_ip', points: 3, durationSec: 60, keyFn: ipKey }),
  rateLimit({ name: 'reset_id', keyPrefix: 'reset_id', points: 3, durationSec: 60, keyFn: normalizeIdentifier })
);
const rlResetVerify = compose(
  rateLimit({ name: 'reset_verify_ip', keyPrefix: 'reset_verify_ip', points: 10, durationSec: 60, keyFn: ipKey }),
  rateLimit({ name: 'reset_verify_id', keyPrefix: 'reset_verify_id', points: 10, durationSec: 60, keyFn: normalizeIdentifier })
);
const rlVerifyEmailRequest = compose(
  rateLimit({ name: 'verify_email_req_ip', keyPrefix: 'verify_email_req_ip', points: 3, durationSec: 60, keyFn: ipKey }),
  rateLimit({ name: 'verify_email_req_id', keyPrefix: 'verify_email_req_id', points: 3, durationSec: 60, keyFn: normalizeIdentifier })
);
const rlVerifyEmailCode = compose(
  rateLimit({ name: 'verify_email_code_ip', keyPrefix: 'verify_email_code_ip', points: 10, durationSec: 60, keyFn: ipKey }),
  rateLimit({ name: 'verify_email_code_id', keyPrefix: 'verify_email_code_id', points: 10, durationSec: 60, keyFn: normalizeIdentifier })
);
const rlRefresh = rateLimit({ name: 'refresh_ip', keyPrefix: 'refresh_ip', points: 30, durationSec: 60, keyFn: ipKey });

const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'avatars');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const userId = String(req.user?.id || 'user').replace(/[^\w-]/g, '');
    const original = String(file?.originalname || '').trim().toLowerCase();
    const ext = original.endsWith('.png')
      ? '.png'
      : original.endsWith('.webp')
        ? '.webp'
        : original.endsWith('.jpeg') || original.endsWith('.jpg')
          ? '.jpg'
          : '';
    const filename = `${userId}-${Date.now()}${ext || '.jpg'}`;
    cb(null, filename);
  }
});

const uploadAvatar = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const name = String(file?.originalname || '').toLowerCase();
    if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.webp')) return cb(null, true);
    return cb(new Error('INVALID_FILE_TYPE'));
  }
});

const validateAvatarUploaded = async (req, res, next) => {
  const file = req.file;
  if (!file?.path) return next();
  try {
    const checked = await validateAvatarFile({ filePath: file.path, originalName: file.originalname });
    if (!checked.ok) {
      try {
        await fs.promises.unlink(file.path);
      } catch {}
      const status = checked.error === 'FILE_TOO_LARGE' ? 413 : 400;
      return res.status(status).json({ error: checked.error });
    }
    return next();
  } catch (e) {
    try {
      await fs.promises.unlink(file.path);
    } catch {}
    return next(e);
  }
};

router.post('/register', compose(rlRegister, requireTurnstile({ action: 'register' })), register);
router.post('/verify-otp', rlOtpVerify, verifyOtp);
router.post('/resend-otp', rlOtpResend, resendOtp);
router.post('/login', compose(rlLogin, requireTurnstile({ action: 'login' })), login);
router.post('/change-password', authRequired, changePassword);
router.post('/request-reset', rlReset, requestPasswordReset);
router.post('/forgot-password', rlReset, requestPasswordReset);
router.post('/reset-password', rateLimit({ name: 'reset_token_ip', keyPrefix: 'reset_token_ip', points: 10, durationSec: 60, keyFn: ipKey }), resetPassword);
router.post('/reset-by-code', rlResetVerify, resetPasswordByCode);
router.post('/verify-reset-code', rlResetVerify, verifyResetCode);
router.post('/request-verify', rlVerifyEmailRequest, requestVerifyEmail);
router.post('/verify-email', rlVerifyEmailCode, verifyEmail);
router.post('/refresh', compose(rlRefresh, requireCsrf), refreshAccessToken);
router.post('/logout', compose(rlRefresh, requireCsrf), logout);
router.post('/oauth/verify-otp', rlOtpVerify, verifyOAuthOtp);
router.post('/oauth/resend-otp', rlOtpResend, resendOAuthOtp);
router.get('/me', authRequired, getMe);
router.put('/me', authRequired, updateMe);
router.post(
  '/me/avatar',
  authRequired,
  compose(
    rateLimit({ name: 'avatar_upload_user_day', keyPrefix: 'avatar_upload_user_day', points: 10, durationSec: 24 * 60 * 60, keyFn: (req) => req.user?.id }),
    requireTurnstile({ action: 'upload' })
  ),
  uploadAvatar.single('file'),
  validateAvatarUploaded,
  setMyAvatar
);

const getFrontendUrl = () => String(process.env.FRONTEND_URL || 'http://localhost:5173').trim().replace(/\/+$/, '');

const parseAllowedFrontendUrls = () => {
  const fromSingle = String(process.env.FRONTEND_URL || '').trim();
  const fromList = String(process.env.FRONTEND_URLS || '').trim();
  return [fromSingle, ...fromList.split(',')]
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .map((s) => s.replace(/\/+$/, ''));
};

const isLocalhostOrigin = (origin) => {
  try {
    const u = new URL(origin);
    return u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1');
  } catch {
    return false;
  }
};

const isAllowedFrontendOrigin = (origin) => {
  const value = String(origin || '').trim().replace(/\/+$/, '');
  if (!value) return false;
  const allow = parseAllowedFrontendUrls();
  if (allow.includes(value)) return true;
  if (isLocalhostOrigin(value)) return true;
  return false;
};

const encodeState = (obj) => {
  const raw = Buffer.from(JSON.stringify(obj || {}), 'utf8').toString('base64');
  return raw.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const decodeState = (state) => {
  const s = String(state || '').trim();
  if (!s) return null;
  const padded = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=');
  try {
    const json = Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
};

const getFrontendOriginFromState = (req) => {
  const parsed = decodeState(req.query?.state);
  const origin = String(parsed?.frontend || '').trim();
  if (origin && isAllowedFrontendOrigin(origin)) return origin.replace(/\/+$/, '');
  return '';
};

const buildRedirectUrl = ({ base, token, error, otp, ticket }) => {
  const origin = String(base || '').trim().replace(/\/+$/, '') || getFrontendUrl();
  const url = new URL(`${origin}/auth/callback`);
  if (token) url.searchParams.set('token', token);
  if (error) url.searchParams.set('error', error);
  if (otp) url.searchParams.set('otp', String(otp));
  if (ticket) url.searchParams.set('ticket', String(ticket));
  return url.toString();
};

const getMissingOAuthEnv = (provider) => {
  if (provider === 'google') {
    const missing = [];
    if (!String(process.env.GOOGLE_CLIENT_ID || '').trim()) missing.push('GOOGLE_CLIENT_ID');
    if (!String(process.env.GOOGLE_CLIENT_SECRET || '').trim()) missing.push('GOOGLE_CLIENT_SECRET');
    return missing;
  }
  return [];
};

const getRequestBaseUrl = (req) => {
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http')
    .split(',')[0]
    .trim();
  const host = String(req.headers['x-forwarded-host'] || req.get('host') || '')
    .split(',')[0]
    .trim();
  if (!host) return '';
  return `${proto}://${host}`;
};

const getGoogleCallbackUrl = (req) => {
  const fromEnv = String(process.env.GOOGLE_CALLBACK_URL || '').trim();
  if (fromEnv) return fromEnv;
  return `${getRequestBaseUrl(req)}${String(req.baseUrl || '/auth')}/google/callback`;
};

router.get('/google', (req, res, next) => {
  if (!passport._strategy('google')) {
    const missing = getMissingOAuthEnv('google');
    return res.status(500).json({ error: 'OAUTH_NOT_CONFIGURED', provider: 'google', missing });
  }
  const callbackURL = getGoogleCallbackUrl(req);
  const frontend = String(req.query?.frontend || req.query?.origin || '').trim();
  const state = frontend && isAllowedFrontendOrigin(frontend) ? encodeState({ frontend: frontend.replace(/\/+$/, '') }) : undefined;
  return passport.authenticate('google', { scope: ['profile', 'email'], session: false, callbackURL, state })(req, res, next);
});

router.get('/google/callback', (req, res, next) => {
  const frontendBase = getFrontendOriginFromState(req);
  if (!passport._strategy('google')) return res.redirect(buildRedirectUrl({ base: frontendBase, error: 'OAUTH_NOT_CONFIGURED' }));
  const callbackURL = getGoogleCallbackUrl(req);
  return passport.authenticate('google', { session: false, callbackURL }, async (err, profile) => {
    if (err) return res.redirect(buildRedirectUrl({ base: frontendBase, error: 'OAUTH_FAILED' }));
    if (!profile) return res.redirect(buildRedirectUrl({ base: frontendBase, error: 'OAUTH_FAILED' }));
    try {
      const result = await beginOAuthOtpLogin(profile);
      if (result?.token) return res.redirect(buildRedirectUrl({ base: frontendBase, token: result.token }));
      return res.redirect(buildRedirectUrl({ base: frontendBase, otp: 1, ticket: result.ticket }));
    } catch (e) {
      const code = String(e?.message || 'OAUTH_FAILED');
      return res.redirect(buildRedirectUrl({ base: frontendBase, error: code }));
    }
  })(req, res, next);
});

module.exports = router;
