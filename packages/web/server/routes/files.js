const { Router } = require('express');
const path = require('path');
const { usptoClient, fileManager, pdfExtractor } = require('@uspto-search/core');
const database = require('../database');

const router = Router();

function getDataRoot() {
  return process.env.DATA_DIR || path.join(__dirname, '../../../data');
}

/**
 * GET /api/files/stats
 * Get storage statistics for the authenticated user.
 */
router.get('/stats', (req, res, next) => {
  try {
    const stats = database.getStorageStats(req.user.userId, getDataRoot());
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/files/:projectId
 * List files for a project (from filesystem or downloads table).
 */
router.get('/:projectId', (req, res, next) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const dataRoot = getDataRoot();
    const project = database.getProject(req.user.userId, dataRoot, projectId);

    if (!project) {
      return res.status(404).json({ error: 'Project not found', code: 'NOT_FOUND' });
    }

    const projectDir = path.join(dataRoot, project.storage_path);
    const files = fileManager.listProjectFiles(projectDir);
    res.json(files);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/files/:id
 * Delete a download record and its file.
 */
router.delete('/:id', (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    database.deleteDownload(req.user.userId, getDataRoot(), id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/files or POST /api/download
 * Download a file from USPTO and save it to a project.
 * Body: { url, projectId }
 */
router.post('/', async (req, res, next) => {
  try {
    const { url, projectId } = req.body;

    if (!url || !projectId) {
      return res.status(400).json({ error: 'URL and projectId are required', code: 'BAD_REQUEST' });
    }

    const dataRoot = getDataRoot();
    const project = database.getProject(req.user.userId, dataRoot, projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found', code: 'NOT_FOUND' });
    }

    const buffer = await usptoClient.downloadFile(url);
    const filename = path.basename(new URL(url).pathname) || `download-${Date.now()}`;
    const projectDir = path.join(dataRoot, project.storage_path);
    const filePath = fileManager.saveDownload(projectDir, filename, buffer);

    // Extract text for PDFs
    let contentText = null;
    if (filename.endsWith('.pdf')) {
      contentText = await pdfExtractor.extractText(filePath);
    }

    const ext = path.extname(filename).slice(1) || 'bin';
    database.saveDownload(req.user.userId, dataRoot, projectId, {
      filename,
      filePath,
      fileType: ext,
      fileSize: buffer.length,
      sourceUrl: url,
      contentText,
    });

    res.json({ filename, filePath, size: buffer.length });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
