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
  setMyAvatar
} = require('../controllers/authController');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

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

router.post('/register', register);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);
router.post('/login', login);
router.post('/change-password', authRequired, changePassword);
router.post('/request-reset', requestPasswordReset);
router.post('/forgot-password', requestPasswordReset);
router.post('/reset-password', resetPassword);
router.post('/reset-by-code', resetPasswordByCode);
router.post('/verify-reset-code', verifyResetCode);
router.post('/request-verify', requestVerifyEmail);
router.post('/verify-email', verifyEmail);
router.post('/oauth/verify-otp', verifyOAuthOtp);
router.post('/oauth/resend-otp', resendOAuthOtp);
router.get('/me', authRequired, getMe);
router.put('/me', authRequired, updateMe);
router.post('/me/avatar', authRequired, uploadAvatar.single('file'), setMyAvatar);

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
      return res.redirect(buildRedirectUrl({ base: frontendBase, otp: 1, ticket: result.ticket }));
    } catch (e) {
      const code = String(e?.message || 'OAUTH_FAILED');
      return res.redirect(buildRedirectUrl({ base: frontendBase, error: code }));
    }
  })(req, res, next);
});

module.exports = router;
