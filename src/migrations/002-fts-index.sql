-- Additional indexes for faster LIKE queries on commonly searched columns
CREATE INDEX IF NOT EXISTS idx_assignments_assignor ON assignments(assignor);
CREATE INDEX IF NOT EXISTS idx_assignments_assignee ON assignments(assignee);
CREATE INDEX IF NOT EXISTS idx_downloads_filename ON downloads(filename)
