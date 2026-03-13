const { Router } = require('express');
const { usptoClient } = require('@uspto-search/core');
const database = require('../database');

const router = Router();

/**
 * GET /api/search
 * Search USPTO trademarks by query string.
 * Query params: q, rows, start, alive, markType, internationalClass, ownerName, filedAfter, filedBefore
 */
router.get('/', async (req, res, next) => {
  try {
    const { q, rows, start, alive, markType, internationalClass, ownerName, filedAfter, filedBefore } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Query parameter "q" is required', code: 'BAD_REQUEST' });
    }

    const options = {};
    if (rows) options.rows = parseInt(rows, 10);
    if (start) options.start = parseInt(start, 10);
    if (alive !== undefined) options.alive = alive === 'true';
    if (markType) options.markType = markType;
    if (internationalClass) options.internationalClass = internationalClass;
    if (ownerName) options.ownerName = ownerName;
    if (filedAfter) options.filedAfter = filedAfter;
    if (filedBefore) options.filedBefore = filedBefore;

    const results = await usptoClient.search(q, options);
    res.json(results);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/search/local
 * Search local database (assignments + downloads) for the authenticated user.
 * Query params: q
 */
router.get('/local', (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Query parameter "q" is required', code: 'BAD_REQUEST' });
    }

    const dataRoot = process.env.DATA_DIR || require('path').join(__dirname, '../../../data');
    const results = database.localSearch(req.user.userId, dataRoot, q);
    res.json(results);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/search/case/:serialNumber/status
 * Get TSDR case status by serial or registration number.
 */
router.get('/case/:serialNumber/status', async (req, res, next) => {
  try {
    const { serialNumber } = req.params;
    const result = await usptoClient.getCaseStatus(serialNumber);
    res.type('application/xml').send(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
