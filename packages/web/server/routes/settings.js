const { Router } = require('express');
const database = require('../database');

const router = Router();

/**
 * GET /api/settings
 * Get current user's account settings/info.
 */
router.get('/', (req, res, next) => {
  try {
    const user = database.getUserByGoogleId(null); // Not useful without googleId
    // For now, return the info from the JWT payload
    res.json({
      userId: req.user.userId,
      email: req.user.email,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/settings
 * Update user settings.
 * Body: settings object (extensible for future use)
 */
router.put('/', (req, res, next) => {
  try {
    const { apiKey } = req.body;

    // For now, API key can be set via env var on the server.
    // This endpoint is a placeholder for future user-level settings.
    // In a SaaS context, per-user API keys could be stored in a settings table.

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
