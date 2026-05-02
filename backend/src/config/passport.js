const { Strategy: GoogleStrategy } = require('passport-google-oauth20');

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const getBackendUrl = () =>
  String(
    process.env.BACKEND_URL ||
      process.env.API_BASE_URL ||
      `http://localhost:${Number(process.env.PORT || 5000)}`
  )
    .trim()
    .replace(/\/+$/, '');

const configurePassport = (passport) => {
  const googleClientID = String(process.env.GOOGLE_CLIENT_ID || '').trim();
  const googleClientSecret = String(process.env.GOOGLE_CLIENT_SECRET || '').trim();
  const googleCallbackURL = String(process.env.GOOGLE_CALLBACK_URL || '').trim();
  const resolvedGoogleCallbackURL = googleCallbackURL || `${getBackendUrl()}/auth/google/callback`;

  if (googleClientID && googleClientSecret) {
    passport.use(
      new GoogleStrategy(
        { clientID: googleClientID, clientSecret: googleClientSecret, callbackURL: resolvedGoogleCallbackURL },
        async (_accessToken, _refreshToken, profile, done) => {
          const email = normalizeEmail(profile?.emails?.[0]?.value);
          const avatar = String(profile?.photos?.[0]?.value || '').trim();
          const name = String(profile?.displayName || '').trim();
          const providerId = String(profile?.id || '').trim();
          return done(null, { provider: 'google', providerId, email, name, avatar });
        }
      )
    );
  }
};

module.exports = { configurePassport };
