const jwt = require('jsonwebtoken');

module.exports = function requireAuth(req, res, next) {
  const token = req.cookies?.jwt;
  if (!token) return res.status(401).json({ error: 'Authentication required', code: 'UNAUTHORIZED' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { userId, email }

    // Sliding window: reissue token on each request
    const newToken = jwt.sign(
      { userId: payload.userId, email: payload.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.cookie('jwt', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token', code: 'UNAUTHORIZED' });
  }
};
