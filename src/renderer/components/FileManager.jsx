import React, { useState, useEffect } from 'react';

export default function FileManager({ mode, onSelectProject }) {
  const [projects, setProjects] = useState([]);
  const [files, setFiles] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [mode]);

  async function loadData() {
    setLoading(true);
    try {
      const projectList = await window.api.listProjects();
      setProjects(projectList || []);
      const storageStats = await window.api.getStorageStats();
      setStats(storageStats);
    } catch {
      // API not available yet
    } finally {
      setLoading(false);
    }
  }

  async function handleLocalSearch(e) {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    try {
      const results = await window.api.localSearch(searchQuery.trim());
      setSearchResults(results);
    } catch (err) {
      console.error('Local search failed:', err);
    }
  }

  async function handleDeleteProject(id) {
    if (!confirm('Delete this project and all its files? This cannot be undone.')) return;
    try {
      await window.api.deleteProject(id);
      loadData();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  }

  async function handleDeleteFile(fileId) {
    if (!confirm('Delete this file? This cannot be undone.')) return;
    try {
      await window.api.deleteFile(fileId);
      loadData();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  }

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="file-manager">
      <h2>{mode === 'projects' ? 'Projects' : 'Local Files'}</h2>

      {stats && (
        <div className="storage-stats">
          <div className="stat">
            <div className="stat-value">{stats.projectCount || 0}</div>
            <div className="stat-label">Projects</div>
          </div>
          <div className="stat">
            <div className="stat-value">{stats.fileCount || 0}</div>
            <div className="stat-label">Files</div>
          </div>
          <div className="stat">
            <div className="stat-value">{formatBytes(stats.totalSize || 0)}</div>
            <div className="stat-label">Storage Used</div>
          </div>
        </div>
      )}

      {mode === 'files' && (
        <form onSubmit={handleLocalSearch} className="local-search">
          <div className="search-bar">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search local files (mark names, assignors, content)..."
            />
            <button type="submit">Search Local</button>
          </div>
        </form>
      )}

      {searchResults ? (
        <div className="results-list">
          <h3>{searchResults.length} local result{searchResults.length !== 1 ? 's' : ''}</h3>
          {searchResults.map((result, i) => (
            <div key={i} className="result-card">
              <div className="mark-name">{result.markText || result.filename}</div>
              <div className="meta">
                <span>Project: {result.projectName}</span>
                <span>Type: {result.type}</span>
                {result.snippet && <span>{result.snippet}</span>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="file-grid">
          {projects.map((project) => (
            <div key={project.id} className="file-card">
              <div className="file-name">{project.name}</div>
              <div className="file-meta">
                <div>Created: {new Date(project.created_at).toLocaleDateString()}</div>
                <div>Search terms: {JSON.parse(project.search_terms || '[]').join(', ')}</div>
              </div>
              <div className="actions" style={{ marginTop: '12px' }}>
                {onSelectProject && (
                  <button className="btn btn-sm" onClick={() => onSelectProject(project.id)}>
                    Open
                  </button>
                )}
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => handleDeleteProject(project.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {projects.length === 0 && (
            <div className="empty-state">
              No projects yet. Search for trademarks to create your first project.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
