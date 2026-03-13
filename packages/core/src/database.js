const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const { DB_FILENAME } = require('./constants');

let db = null;
let dbPath = null;

async function getDb(dataRoot) {
  if (db) return db;

  dbPath = path.join(dataRoot, DB_FILENAME);

  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');
  await runMigrations();
  saveDb();
  return db;
}

function saveDb() {
  if (!db || !dbPath) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

async function runMigrations() {
  db.run(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY,
      filename TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const applied = new Set(
    db.exec('SELECT filename FROM _migrations')[0]?.values.map((r) => r[0]) || []
  );

  const migrationsDir = path.join(__dirname, '..', 'migrations');
  if (!fs.existsSync(migrationsDir)) return;

  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    // Split on semicolons and execute each statement individually
    const statements = sql.split(';').map((s) => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      try {
        db.run(stmt);
      } catch (err) {
        console.error(`Migration error in ${file}: ${err.message}`);
        console.error(`Statement: ${stmt.substring(0, 100)}`);
      }
    }

    db.run('INSERT INTO _migrations (filename) VALUES (?)', [file]);
  }
}

function closeDb() {
  if (db) {
    saveDb();
    db.close();
    db = null;
    dbPath = null;
  }
}

// Helper to run a query and return rows as objects (using prepared statements for reliable param binding)
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function runStmt(sql, params = []) {
  db.run(sql, params);
  // Must query last_insert_rowid BEFORE saveDb, because db.export() resets it to 0
  const result = db.exec('SELECT last_insert_rowid() as id');
  const lastInsertRowid = result[0]?.values[0]?.[0] || 0;
  saveDb();
  return { lastInsertRowid };
}

// Project operations
async function createProject(dataRoot, name, searchTerms) {
  await getDb(dataRoot);
  const storagePath = `${name.replace(/[^a-zA-Z0-9-_ ]/g, '')}-${new Date().toISOString().slice(0, 10)}`;

  const result = runStmt(
    'INSERT INTO projects (name, search_terms, storage_path) VALUES (?, ?, ?)',
    [name, JSON.stringify(searchTerms), storagePath]
  );

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

  return { id: result.lastInsertRowid, name, storagePath };
}

async function listProjects(dataRoot) {
  await getDb(dataRoot);
  return queryAll('SELECT * FROM projects ORDER BY created_at DESC');
}

async function getProject(dataRoot, id) {
  await getDb(dataRoot);
  const rows = queryAll('SELECT * FROM projects WHERE id = ?', [id]);
  return rows[0] || null;
}

async function deleteProject(dataRoot, id) {
  await getDb(dataRoot);
  const project = (queryAll('SELECT * FROM projects WHERE id = ?', [id]))[0];
  if (!project) return;

  db.run('DELETE FROM assignments WHERE project_id = ?', [id]);
  db.run('DELETE FROM downloads WHERE project_id = ?', [id]);
  db.run('DELETE FROM projects WHERE id = ?', [id]);
  saveDb();

  const projectDir = path.join(dataRoot, project.storage_path);
  if (fs.existsSync(projectDir)) {
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
}

async function renameProject(dataRoot, id, newName) {
  await getDb(dataRoot);
  db.run('UPDATE projects SET name = ? WHERE id = ?', [newName, id]);
  saveDb();
}

// Find or create a project (deduplicates by name)
async function findOrCreateProject(dataRoot, name, searchTerms) {
  await getDb(dataRoot);
  const existing = queryAll('SELECT * FROM projects WHERE name = ? LIMIT 1', [name]);
  if (existing.length > 0) {
    return { id: existing[0].id, name: existing[0].name, storagePath: existing[0].storage_path };
  }
  return createProject(dataRoot, name, searchTerms);
}

// Assignment operations
async function saveAssignment(dataRoot, projectId, data) {
  await getDb(dataRoot);
  const result = runStmt(
    `INSERT INTO assignments (project_id, serial_number, registration_number, mark_text,
      assignor, assignee, execution_date, recorded_date, reel_frame, raw_data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
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
    ]
  );

  // Also save as JSON file
  const project = (queryAll('SELECT * FROM projects WHERE id = ?', [projectId]))[0];
  if (project) {
    const filename = `assignment-${data.serialNumber || result.lastInsertRowid}.json`;
    const filePath = path.join(dataRoot, project.storage_path, 'assignments', filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  return { id: result.lastInsertRowid };
}

async function getAssignments(dataRoot, projectId) {
  await getDb(dataRoot);
  return queryAll('SELECT * FROM assignments WHERE project_id = ? ORDER BY recorded_date DESC', [projectId]);
}

async function getAssignmentProjects(dataRoot, serialNumber) {
  if (!serialNumber) return [];
  await getDb(dataRoot);
  return queryAll(
    `SELECT p.id, p.name FROM assignments a JOIN projects p ON p.id = a.project_id WHERE a.serial_number = ?`,
    [serialNumber]
  );
}

// Download tracking
async function trackDownload(dataRoot, projectId, filename, filePath, fileType, fileSize, sourceUrl, contentText) {
  await getDb(dataRoot);
  return runStmt(
    `INSERT INTO downloads (project_id, filename, file_path, file_type, file_size, source_url, content_text)
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [projectId, filename, filePath, fileType, fileSize, sourceUrl, contentText || null]
  );
}

async function getDownloads(dataRoot, projectId) {
  await getDb(dataRoot);
  return queryAll('SELECT * FROM downloads WHERE project_id = ? ORDER BY downloaded_at DESC', [projectId]);
}

async function deleteDownload(dataRoot, id) {
  await getDb(dataRoot);
  const rows = queryAll('SELECT * FROM downloads WHERE id = ?', [id]);
  const download = rows[0];
  if (!download) return;

  db.run('DELETE FROM downloads WHERE id = ?', [id]);
  saveDb();

  if (download.file_path && fs.existsSync(download.file_path)) {
    fs.unlinkSync(download.file_path);
  }
}

// Local search using LIKE (sql.js doesn't reliably support FTS5)
async function localSearch(dataRoot, query) {
  await getDb(dataRoot);
  const results = [];
  const likeQuery = `%${query}%`;

  // Search assignments
  const assignmentResults = queryAll(
    `SELECT a.*, p.name as project_name
    FROM assignments a
    JOIN projects p ON p.id = a.project_id
    WHERE a.mark_text LIKE ? OR a.assignor LIKE ? OR a.assignee LIKE ? OR a.raw_data LIKE ?
    ORDER BY a.fetched_at DESC
    LIMIT 50`,
    [likeQuery, likeQuery, likeQuery, likeQuery]
  );

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
  const downloadResults = queryAll(
    `SELECT d.*, p.name as project_name
    FROM downloads d
    JOIN projects p ON p.id = d.project_id
    WHERE d.filename LIKE ? OR d.content_text LIKE ?
    ORDER BY d.downloaded_at DESC
    LIMIT 50`,
    [likeQuery, likeQuery]
  );

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

// Storage stats
async function getStorageStats(dataRoot) {
  await getDb(dataRoot);
  const projectCount = queryAll('SELECT COUNT(*) as count FROM projects')[0]?.count || 0;
  const fileCount = queryAll('SELECT COUNT(*) as count FROM downloads')[0]?.count || 0;
  const totalSize = queryAll('SELECT COALESCE(SUM(file_size), 0) as total FROM downloads')[0]?.total || 0;

  return { projectCount, fileCount, totalSize };
}

module.exports = {
  getDb,
  closeDb,
  createProject,
  findOrCreateProject,
  listProjects,
  getProject,
  deleteProject,
  renameProject,
  saveAssignment,
  getAssignments,
  getAssignmentProjects,
  trackDownload,
  getDownloads,
  deleteDownload,
  localSearch,
  getStorageStats,
};
