const { Router } = require('express');
const path = require('path');
const { usptoClient } = require('@uspto-search/core');
const database = require('../database');

const router = Router();

function getDataRoot() {
  return process.env.DATA_DIR || path.join(__dirname, '../../../data');
}

/**
 * POST /api/batch
 * Run a batch search for multiple marks. Streams progress via Server-Sent Events (SSE).
 * Body: { marks: string[] }
 */
router.post('/', async (req, res, next) => {
  try {
    const { marks } = req.body;

    if (!marks || !Array.isArray(marks) || marks.length === 0) {
      return res.status(400).json({ error: 'marks array is required', code: 'BAD_REQUEST' });
    }

    const dataRoot = getDataRoot();
    const userId = req.user.userId;

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Create a project for this batch
    const projectName = `Batch-${new Date().toISOString().slice(0, 10)}`;
    const project = database.createProject(userId, dataRoot, projectName, marks);

    // Send initial event
    res.write(`data: ${JSON.stringify({
      type: 'started',
      projectId: project.id,
      projectName: project.name,
      total: marks.length,
    })}\n\n`);

    for (let i = 0; i < marks.length; i++) {
      const mark = marks[i];

      // Send progress event
      res.write(`data: ${JSON.stringify({
        type: 'progress',
        current: i + 1,
        total: marks.length,
        currentMark: mark,
        complete: false,
      })}\n\n`);

      try {
        const results = await usptoClient.search(mark);
        for (const item of results.items) {
          database.saveAssignment(userId, dataRoot, project.id, item);
        }

        res.write(`data: ${JSON.stringify({
          type: 'mark_complete',
          mark,
          resultCount: results.items.length,
          current: i + 1,
          total: marks.length,
        })}\n\n`);
      } catch (err) {
        console.error(`Batch search failed for "${mark}":`, err.message);
        res.write(`data: ${JSON.stringify({
          type: 'mark_error',
          mark,
          error: err.message,
          current: i + 1,
          total: marks.length,
        })}\n\n`);
      }
    }

    // Send completion event
    res.write(`data: ${JSON.stringify({
      type: 'complete',
      projectId: project.id,
      projectName: project.name,
      current: marks.length,
      total: marks.length,
      complete: true,
    })}\n\n`);

    res.end();
  } catch (err) {
    // If headers haven't been sent yet, pass to error handler
    if (!res.headersSent) {
      return next(err);
    }
    // Otherwise try to send an error event before closing
    try {
      res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
    } catch (e) {
      // Connection already closed
    }
    res.end();
  }
});

module.exports = router;
