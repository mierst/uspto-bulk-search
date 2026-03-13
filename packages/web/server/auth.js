const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');
const database = require('./database');

function setupAuth(app) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.DOMAIN || 'http://localhost:3000'}/api/auth/google/callback`,
  }, (accessToken, refreshToken, profile, done) => {
    const user = database.createUser(
      profile.id,
      profile.emails[0].value,
      profile.displayName,
      profile.photos?.[0]?.value
    );
    done(null, user);
  }));

  app.get('/api/auth/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

  app.get('/api/auth/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: '/login' }),
    (req, res) => {
      const token = jwt.sign(
        { userId: req.user.id, email: req.user.email },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      res.cookie('jwt', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      res.redirect('/');
    }
  );

  app.get('/api/auth/me', require('./middleware/auth'), (req, res) => {
    res.json({ userId: req.user.userId, email: req.user.email });
  });

  app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('jwt');
    res.json({ ok: true });
  });
}

module.exports = { setupAuth };
