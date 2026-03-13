const { Router } = require('express');
const path = require('path');
const database = require('../database');

const router = Router();

function getDataRoot() {
  return process.env.DATA_DIR || path.join(__dirname, '../../../data');
}

/**
 * GET /api/projects
 * List all projects for the authenticated user.
 */
router.get('/', (req, res, next) => {
  try {
    const projects = database.listProjects(req.user.userId, getDataRoot());
    res.json(projects);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/projects
 * Create a new project.
 * Body: { name, searchTerms }
 */
router.post('/', (req, res, next) => {
  try {
    const { name, searchTerms } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Project name is required', code: 'BAD_REQUEST' });
    }

    const project = database.createProject(req.user.userId, getDataRoot(), name, searchTerms || []);
    res.status(201).json(project);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/projects/find-or-create
 * Find an existing project by name or create a new one.
 * Body: { name, searchTerms }
 */
router.post('/find-or-create', (req, res, next) => {
  try {
    const { name, searchTerms } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Project name is required', code: 'BAD_REQUEST' });
    }

    const project = database.findOrCreateProject(req.user.userId, getDataRoot(), name, searchTerms || []);
    res.json(project);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/projects/:id
 * Get a single project by ID.
 */
router.get('/:id', (req, res, next) => {
  try {
    const project = database.getProject(req.user.userId, getDataRoot(), parseInt(req.params.id, 10));
    if (!project) {
      return res.status(404).json({ error: 'Project not found', code: 'NOT_FOUND' });
    }
    res.json(project);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/projects/:id
 * Rename a project.
 * Body: { name }
 */
router.put('/:id', (req, res, next) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Project name is required', code: 'BAD_REQUEST' });
    }

    database.renameProject(req.user.userId, parseInt(req.params.id, 10), name);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/projects/:id
 * Delete a project and all its data.
 */
router.delete('/:id', (req, res, next) => {
  try {
    database.deleteProject(req.user.userId, getDataRoot(), parseInt(req.params.id, 10));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
