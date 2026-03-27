const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const { Strategy: FacebookStrategy } = require('passport-facebook');

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const configurePassport = (passport) => {
  const googleClientID = String(process.env.GOOGLE_CLIENT_ID || '').trim();
  const googleClientSecret = String(process.env.GOOGLE_CLIENT_SECRET || '').trim();
  const googleCallbackURL = String(process.env.GOOGLE_CALLBACK_URL || '').trim();

  if (googleClientID && googleClientSecret && googleCallbackURL) {
    passport.use(
      new GoogleStrategy(
        { clientID: googleClientID, clientSecret: googleClientSecret, callbackURL: googleCallbackURL },
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

  const facebookAppID = String(process.env.FACEBOOK_APP_ID || '').trim();
  const facebookAppSecret = String(process.env.FACEBOOK_APP_SECRET || '').trim();
  const facebookCallbackURL = String(process.env.FACEBOOK_CALLBACK_URL || '').trim();

  if (facebookAppID && facebookAppSecret && facebookCallbackURL) {
    passport.use(
      new FacebookStrategy(
        {
          clientID: facebookAppID,
          clientSecret: facebookAppSecret,
          callbackURL: facebookCallbackURL,
          profileFields: ['id', 'displayName', 'photos', 'email']
        },
        async (_accessToken, _refreshToken, profile, done) => {
          const email = normalizeEmail(profile?.emails?.[0]?.value);
          const avatar = String(profile?.photos?.[0]?.value || '').trim();
          const name = String(profile?.displayName || '').trim();
          const providerId = String(profile?.id || '').trim();
          return done(null, { provider: 'facebook', providerId, email, name, avatar });
        }
      )
    );
  }
};

module.exports = { configurePassport };
