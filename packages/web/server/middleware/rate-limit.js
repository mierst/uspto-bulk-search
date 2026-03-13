const rateLimit = require('express-rate-limit');

module.exports = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  keyGenerator: (req) => req.user?.userId || req.ip,
  message: { error: 'Too many requests', code: 'RATE_LIMITED' },
});
