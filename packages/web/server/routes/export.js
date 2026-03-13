const { Router } = require('express');
const path = require('path');
const { assignmentEngine, exhibitExporter, fileManager } = require('@uspto-search/core');
const database = require('../database');

const router = Router();

function getDataRoot() {
  return process.env.DATA_DIR || path.join(__dirname, '../../../data');
}

/**
 * POST /api/export/exhibit
 * Generate a chain-of-title PDF exhibit for a project.
 * Body: { projectId, assignmentIds? }
 */
router.post('/exhibit', async (req, res, next) => {
  try {
    const { projectId, assignmentIds } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required', code: 'BAD_REQUEST' });
    }

    const dataRoot = getDataRoot();
    const project = database.getProject(req.user.userId, dataRoot, projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found', code: 'NOT_FOUND' });
    }

    let assignments = database.getAssignments(req.user.userId, dataRoot, projectId);

    // Filter to specific assignment IDs if provided
    if (assignmentIds && assignmentIds.length > 0) {
      const idSet = new Set(assignmentIds);
      assignments = assignments.filter((a) => idSet.has(a.id));
    }

    if (assignments.length === 0) {
      return res.status(400).json({ error: 'No assignments found for export', code: 'BAD_REQUEST' });
    }

    // Build chain of title
    const chain = assignmentEngine.buildChainOfTitle(assignments);

    // Save chain of title JSON
    const projectDir = path.join(dataRoot, project.storage_path);
    fileManager.saveChainOfTitle(projectDir, chain);

    // Generate PDF exhibit
    const pdfBuffer = await exhibitExporter.exportChainOfTitle(chain);
    const filename = `${chain.markText || 'exhibit'}-chain-of-title.pdf`.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = fileManager.saveExhibit(projectDir, filename, pdfBuffer);

    // Send PDF as download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
