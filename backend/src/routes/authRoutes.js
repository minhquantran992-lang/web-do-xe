const express = require('express');
const passport = require('passport');
const {
  register,
  login,
  completeOAuthLogin,
  changePassword,
  requestPasswordReset,
  resetPassword,
  resetPasswordByCode,
  requestVerifyEmail,
  verifyEmail
} = require('../controllers/authController');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/change-password', authRequired, changePassword);
router.post('/request-reset', requestPasswordReset);
router.post('/reset-password', resetPassword);
router.post('/reset-by-code', resetPasswordByCode);
router.post('/request-verify', requestVerifyEmail);
router.post('/verify-email', verifyEmail);

const getFrontendUrl = () => String(process.env.FRONTEND_URL || 'http://localhost:5173').trim().replace(/\/+$/, '');

const buildRedirectUrl = ({ token, error }) => {
  const base = getFrontendUrl();
  const url = new URL(`${base}/auth/callback`);
  if (token) url.searchParams.set('token', token);
  if (error) url.searchParams.set('error', error);
  return url.toString();
};

router.get('/google', (req, res, next) => {
  if (!passport._strategy('google')) return res.status(500).json({ error: 'OAUTH_NOT_CONFIGURED' });
  return passport.authenticate('google', { scope: ['profile', 'email'], session: false })(req, res, next);
});

router.get('/google/callback', (req, res, next) => {
  if (!passport._strategy('google')) return res.redirect(buildRedirectUrl({ error: 'OAUTH_NOT_CONFIGURED' }));
  return passport.authenticate('google', { session: false }, async (err, profile) => {
    if (err) return res.redirect(buildRedirectUrl({ error: 'OAUTH_FAILED' }));
    if (!profile) return res.redirect(buildRedirectUrl({ error: 'OAUTH_FAILED' }));
    try {
      const result = await completeOAuthLogin(profile);
      return res.redirect(buildRedirectUrl({ token: result.token }));
    } catch (e) {
      const code = String(e?.message || 'OAUTH_FAILED');
      return res.redirect(buildRedirectUrl({ error: code }));
    }
  })(req, res, next);
});

router.get('/facebook', (req, res, next) => {
  if (!passport._strategy('facebook')) return res.status(500).json({ error: 'OAUTH_NOT_CONFIGURED' });
  return passport.authenticate('facebook', { scope: ['email'], session: false })(req, res, next);
});

router.get('/facebook/callback', (req, res, next) => {
  if (!passport._strategy('facebook')) return res.redirect(buildRedirectUrl({ error: 'OAUTH_NOT_CONFIGURED' }));
  return passport.authenticate('facebook', { session: false }, async (err, profile) => {
    if (err) return res.redirect(buildRedirectUrl({ error: 'OAUTH_FAILED' }));
    if (!profile) return res.redirect(buildRedirectUrl({ error: 'OAUTH_FAILED' }));
    try {
      const result = await completeOAuthLogin(profile);
      return res.redirect(buildRedirectUrl({ token: result.token }));
    } catch (e) {
      const code = String(e?.message || 'OAUTH_FAILED');
      return res.redirect(buildRedirectUrl({ error: code }));
    }
  })(req, res, next);
});

module.exports = router;
