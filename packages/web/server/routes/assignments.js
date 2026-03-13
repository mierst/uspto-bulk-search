const { Router } = require('express');
const path = require('path');
const database = require('../database');

const router = Router();

function getDataRoot() {
  return process.env.DATA_DIR || path.join(__dirname, '../../../data');
}

/**
 * GET /api/assignments/by-serial/:serialNumber
 * Find which projects contain assignments for a given serial number.
 * NOTE: This route MUST be defined before /:projectId to avoid matching "by-serial" as a projectId.
 */
router.get('/by-serial/:serialNumber', (req, res, next) => {
  try {
    const { serialNumber } = req.params;
    const projects = database.getAssignmentProjects(req.user.userId, getDataRoot(), serialNumber);
    res.json(projects);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/assignments/:projectId
 * List all assignments for a project.
 */
router.get('/:projectId', (req, res, next) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);

    // Verify project belongs to user
    const project = database.getProject(req.user.userId, getDataRoot(), projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found', code: 'NOT_FOUND' });
    }

    const assignments = database.getAssignments(req.user.userId, getDataRoot(), projectId);
    res.json(assignments);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/assignments/:projectId
 * Save an assignment to a project.
 * Body: assignment data object
 */
router.post('/:projectId', (req, res, next) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const data = req.body;

    if (!data) {
      return res.status(400).json({ error: 'Assignment data is required', code: 'BAD_REQUEST' });
    }

    const result = database.saveAssignment(req.user.userId, getDataRoot(), projectId, data);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
