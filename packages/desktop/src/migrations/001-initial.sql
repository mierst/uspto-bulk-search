CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  search_terms TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  serial_number TEXT,
  registration_number TEXT,
  mark_text TEXT,
  assignor TEXT,
  assignee TEXT,
  execution_date TEXT,
  recorded_date TEXT,
  reel_frame TEXT,
  raw_data TEXT NOT NULL,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS downloads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  source_url TEXT,
  downloaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  content_text TEXT
);

CREATE INDEX IF NOT EXISTS idx_assignments_project ON assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_assignments_serial ON assignments(serial_number);
CREATE INDEX IF NOT EXISTS idx_assignments_mark ON assignments(mark_text);
CREATE INDEX IF NOT EXISTS idx_downloads_project ON downloads(project_id);
