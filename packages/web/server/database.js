const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { DB_FILENAME } = require('@uspto-search/core').constants;

let db = null;
let dbPath = null;

/**
 * Initialize the database: open/create the SQLite file, enable WAL mode + foreign keys, run migrations.
 */
function initDatabase(dataDir) {
  if (db) return db;

  fs.mkdirSync(dataDir, { recursive: true });
  dbPath = path.join(dataDir, DB_FILENAME);

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  runMigrations();

  return db;
}

/**
 * Run numbered migration SQL files plus the web-specific users/user_id migration.
 */
function runMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY,
      filename TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const applied = new Set(
    db.prepare('SELECT filename FROM _migrations').all().map((r) => r.filename)
  );

  // Run core migrations from packages/core/migrations/
  const coreMigrationsDir = path.join(__dirname, '../../core/migrations');
  if (fs.existsSync(coreMigrationsDir)) {
    const files = fs.readdirSync(coreMigrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (applied.has(file)) continue;

      const sql = fs.readFileSync(path.join(coreMigrationsDir, file), 'utf-8');
      const statements = sql.split(';').map((s) => s.trim()).filter(Boolean);
      for (const stmt of statements) {
        try {
          db.exec(stmt);
        } catch (err) {
          console.error(`Migration error in ${file}: ${err.message}`);
          console.error(`Statement: ${stmt.substring(0, 100)}`);
        }
      }

      db.prepare('INSERT INTO _migrations (filename) VALUES (?)').run(file);
    }
  }

  // Run web-specific migration: users table + user_id columns
  const webMigration = '100-web-users.sql';
  if (!applied.has(webMigration)) {
    const webMigrationSQL = `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        google_id TEXT UNIQUE NOT NULL,
        email TEXT NOT NULL,
        name TEXT,
        avatar_url TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `;

    const statements = webMigrationSQL.split(';').map((s) => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      try {
        db.exec(stmt);
      } catch (err) {
        console.error(`Web migration error: ${err.message}`);
        console.error(`Statement: ${stmt.substring(0, 100)}`);
      }
    }

    // Add user_id column to existing tables if not already present
    const addColumnIfMissing = (table, column, type, defaultVal) => {
      try {
        const cols = db.pragma(`table_info(${table})`);
        const hasColumn = cols.some((c) => c.name === column);
        if (!hasColumn) {
          const def = defaultVal !== undefined ? ` DEFAULT ${defaultVal}` : '';
          db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}${def}`);
        }
      } catch (err) {
        console.error(`Failed to add column ${column} to ${table}: ${err.message}`);
      }
    };

    addColumnIfMissing('projects', 'user_id', 'INTEGER', null);
    addColumnIfMissing('assignments', 'user_id', 'INTEGER', null);
    addColumnIfMissing('downloads', 'user_id', 'INTEGER', null);

    // Add indexes for user_id
    try {
      db.exec('CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_assignments_user ON assignments(user_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_downloads_user ON downloads(user_id)');
    } catch (err) {
      console.error(`Index creation error: ${err.message}`);
    }

    db.prepare('INSERT INTO _migrations (filename) VALUES (?)').run(webMigration);
  }
}

/**
 * Close the database connection.
 */
function closeDb() {
  if (db) {
    db.close();
    db = null;
    dbPath = null;
  }
}

// ─── User operations ────────────────────────────────────────────────

/**
 * Create or update a user (upsert by google_id).
 */
function createUser(googleId, email, name, avatarUrl) {
  const existing = db.prepare('SELECT * FROM users WHERE google_id = ?').get(googleId);
  if (existing) {
    db.prepare(
      'UPDATE users SET email = ?, name = ?, avatar_url = ?, updated_at = datetime(\'now\') WHERE google_id = ?'
    ).run(email, name, avatarUrl || null, googleId);
    return db.prepare('SELECT * FROM users WHERE google_id = ?').get(googleId);
  }

  const result = db.prepare(
    'INSERT INTO users (google_id, email, name, avatar_url) VALUES (?, ?, ?, ?)'
  ).run(googleId, email, name, avatarUrl || null);

  return db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
}

/**
 * Find a user by their Google ID.
 */
function getUserByGoogleId(googleId) {
  return db.prepare('SELECT * FROM users WHERE google_id = ?').get(googleId) || null;
}

// ─── Project operations ─────────────────────────────────────────────

/**
 * Create a new project for a user.
 */
function createProject(userId, dataRoot, name, searchTerms) {
  const storagePath = `${name.replace(/[^a-zA-Z0-9-_ ]/g, '')}-${new Date().toISOString().slice(0, 10)}`;

  const result = db.prepare(
    'INSERT INTO projects (name, search_terms, storage_path, user_id) VALUES (?, ?, ?, ?)'
  ).run(name, JSON.stringify(searchTerms), storagePath, userId);

  // Create project directories
  const projectDir = path.join(dataRoot, storagePath);
  fs.mkdirSync(path.join(projectDir, 'assignments'), { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'downloads'), { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'exports'), { recursive: true });

  // Write project metadata
  fs.writeFileSync(
    path.join(projectDir, '_project.json'),
    JSON.stringify({ name, searchTerms, createdAt: new Date().toISOString() }, null, 2)
  );

  return { id: Number(result.lastInsertRowid), name, storagePath };
}

/**
 * Find an existing project by name for a user, or create one.
 */
function findOrCreateProject(userId, dataRoot, name, searchTerms) {
  const existing = db.prepare(
    'SELECT * FROM projects WHERE name = ? AND user_id = ? LIMIT 1'
  ).get(name, userId);

  if (existing) {
    return { id: existing.id, name: existing.name, storagePath: existing.storage_path };
  }

  return createProject(userId, dataRoot, name, searchTerms);
}

/**
 * List all projects for a user, newest first.
 */
function listProjects(userId, dataRoot) {
  return db.prepare(
    'SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC'
  ).all(userId);
}

/**
 * Get a single project by ID, scoped to user.
 */
function getProject(userId, dataRoot, id) {
  return db.prepare(
    'SELECT * FROM projects WHERE id = ? AND user_id = ?'
  ).get(id, userId) || null;
}

/**
 * Delete a project and its related data, scoped to user.
 */
function deleteProject(userId, dataRoot, id) {
  const project = db.prepare(
    'SELECT * FROM projects WHERE id = ? AND user_id = ?'
  ).get(id, userId);

  if (!project) return;

  db.prepare('DELETE FROM assignments WHERE project_id = ? AND user_id = ?').run(id, userId);
  db.prepare('DELETE FROM downloads WHERE project_id = ? AND user_id = ?').run(id, userId);
  db.prepare('DELETE FROM projects WHERE id = ? AND user_id = ?').run(id, userId);

  const projectDir = path.join(dataRoot, project.storage_path);
  if (fs.existsSync(projectDir)) {
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
}

/**
 * Rename a project, scoped to user.
 */
function renameProject(userId, id, newName) {
  db.prepare(
    'UPDATE projects SET name = ? WHERE id = ? AND user_id = ?'
  ).run(newName, id, userId);
}

// ─── Assignment operations ──────────────────────────────────────────

/**
 * Save an assignment record for a project.
 */
function saveAssignment(userId, dataRoot, projectId, data) {
  // Verify project belongs to user
  const project = db.prepare(
    'SELECT * FROM projects WHERE id = ? AND user_id = ?'
  ).get(projectId, userId);

  if (!project) {
    throw new Error('Project not found');
  }

  const result = db.prepare(
    `INSERT INTO assignments (project_id, serial_number, registration_number, mark_text,
      assignor, assignee, execution_date, recorded_date, reel_frame, raw_data, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    projectId,
    data.serialNumber || null,
    data.registrationNumber || null,
    data.markText || null,
    data.assignor || null,
    data.assignee || null,
    data.executionDate || null,
    data.recordedDate || null,
    data.reelFrame || null,
    JSON.stringify(data),
    userId
  );

  // Also save as JSON file
  const filename = `assignment-${data.serialNumber || result.lastInsertRowid}.json`;
  const filePath = path.join(dataRoot, project.storage_path, 'assignments', filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

  return { id: Number(result.lastInsertRowid) };
}

/**
 * Get all assignments for a project, scoped to user.
 */
function getAssignments(userId, dataRoot, projectId) {
  return db.prepare(
    'SELECT * FROM assignments WHERE project_id = ? AND user_id = ? ORDER BY recorded_date DESC'
  ).all(projectId, userId);
}

/**
 * Get projects that contain assignments for a given serial number, scoped to user.
 */
function getAssignmentProjects(userId, dataRoot, serialNumber) {
  if (!serialNumber) return [];
  return db.prepare(
    `SELECT p.id, p.name FROM assignments a
     JOIN projects p ON p.id = a.project_id
     WHERE a.serial_number = ? AND a.user_id = ?`
  ).all(serialNumber, userId);
}

// ─── Download tracking ──────────────────────────────────────────────

/**
 * Get downloads, optionally filtered by project, scoped to user.
 */
function getDownloads(userId, dataRoot, projectId) {
  if (projectId) {
    return db.prepare(
      'SELECT * FROM downloads WHERE project_id = ? AND user_id = ? ORDER BY downloaded_at DESC'
    ).all(projectId, userId);
  }
  return db.prepare(
    'SELECT * FROM downloads WHERE user_id = ? ORDER BY downloaded_at DESC'
  ).all(userId);
}

/**
 * Save a download record.
 */
function saveDownload(userId, dataRoot, projectId, data) {
  // Verify project belongs to user
  const project = db.prepare(
    'SELECT * FROM projects WHERE id = ? AND user_id = ?'
  ).get(projectId, userId);

  if (!project) {
    throw new Error('Project not found');
  }

  const result = db.prepare(
    `INSERT INTO downloads (project_id, filename, file_path, file_type, file_size, source_url, content_text, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    projectId,
    data.filename,
    data.filePath,
    data.fileType,
    data.fileSize || null,
    data.sourceUrl || null,
    data.contentText || null,
    userId
  );

  return { id: Number(result.lastInsertRowid) };
}

/**
 * Delete a download record and its file, scoped to user.
 */
function deleteDownload(userId, dataRoot, id) {
  const download = db.prepare(
    'SELECT * FROM downloads WHERE id = ? AND user_id = ?'
  ).get(id, userId);

  if (!download) return;

  db.prepare('DELETE FROM downloads WHERE id = ? AND user_id = ?').run(id, userId);

  if (download.file_path && fs.existsSync(download.file_path)) {
    fs.unlinkSync(download.file_path);
  }
}

// ─── Local search ───────────────────────────────────────────────────

/**
 * Search across assignments and downloads using LIKE, scoped to user.
 */
function localSearch(userId, dataRoot, query) {
  const results = [];
  const likeQuery = `%${query}%`;

  // Search assignments
  const assignmentResults = db.prepare(
    `SELECT a.*, p.name as project_name
    FROM assignments a
    JOIN projects p ON p.id = a.project_id
    WHERE a.user_id = ? AND (a.mark_text LIKE ? OR a.assignor LIKE ? OR a.assignee LIKE ? OR a.raw_data LIKE ?)
    ORDER BY a.fetched_at DESC
    LIMIT 50`
  ).all(userId, likeQuery, likeQuery, likeQuery, likeQuery);

  for (const r of assignmentResults) {
    results.push({
      type: 'assignment',
      markText: r.mark_text,
      projectName: r.project_name,
      projectId: r.project_id,
      serialNumber: r.serial_number,
      snippet: r.mark_text ? `Mark: ${r.mark_text}` : null,
      ...r,
    });
  }

  // Search downloads
  const downloadResults = db.prepare(
    `SELECT d.*, p.name as project_name
    FROM downloads d
    JOIN projects p ON p.id = d.project_id
    WHERE d.user_id = ? AND (d.filename LIKE ? OR d.content_text LIKE ?)
    ORDER BY d.downloaded_at DESC
    LIMIT 50`
  ).all(userId, likeQuery, likeQuery);

  for (const r of downloadResults) {
    results.push({
      type: 'download',
      filename: r.filename,
      projectName: r.project_name,
      projectId: r.project_id,
      snippet: r.filename,
      ...r,
    });
  }

  return results;
}

// ─── Storage stats ──────────────────────────────────────────────────

/**
 * Get storage statistics for a user.
 */
function getStorageStats(userId, dataRoot) {
  const projectCount = db.prepare(
    'SELECT COUNT(*) as count FROM projects WHERE user_id = ?'
  ).get(userId)?.count || 0;

  const fileCount = db.prepare(
    'SELECT COUNT(*) as count FROM downloads WHERE user_id = ?'
  ).get(userId)?.count || 0;

  const totalSize = db.prepare(
    'SELECT COALESCE(SUM(file_size), 0) as total FROM downloads WHERE user_id = ?'
  ).get(userId)?.total || 0;

  return { projectCount, fileCount, totalSize };
}

module.exports = {
  initDatabase,
  closeDb,
  createUser,
  getUserByGoogleId,
  createProject,
  findOrCreateProject,
  listProjects,
  getProject,
  deleteProject,
  renameProject,
  saveAssignment,
  getAssignments,
  getAssignmentProjects,
  getDownloads,
  saveDownload,
  deleteDownload,
  localSearch,
  getStorageStats,
};
