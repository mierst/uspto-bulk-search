import React, { useState, useEffect } from 'react';
import { api } from '../api';

export default function FileManager({ mode, onSelectProject, onViewAssignment }) {
  const [projects, setProjects] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    alive: '',
    markType: '',
    projectId: '',
  });

  useEffect(() => {
    loadData();
  }, [mode]);

  async function loadData() {
    setLoading(true);
    try {
      const projectList = await api.listProjects();
      setProjects(projectList || []);
      const storageStats = await api.getStorageStats();
      setStats(storageStats);
    } catch {
      // API not available yet
    } finally {
      setLoading(false);
    }
  }

  function updateFilter(key, value) {
    setFilters(prev => ({ ...prev, [key]: value }));
  }

  async function handleLocalSearch(e) {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      const results = await api.localSearch(searchQuery.trim());
      let filtered = results;
      if (filters.projectId) {
        filtered = filtered.filter(r => String(r.project_id) === filters.projectId);
      }
      if (filters.alive === 'true') {
        filtered = filtered.filter(r => {
          try { const raw = JSON.parse(r.raw_data || '{}'); return raw.alive === true; } catch { return false; }
        });
      } else if (filters.alive === 'false') {
        filtered = filtered.filter(r => {
          try { const raw = JSON.parse(r.raw_data || '{}'); return raw.alive === false; } catch { return true; }
        });
      }
      if (filters.markType) {
        filtered = filtered.filter(r => {
          try {
            const raw = JSON.parse(r.raw_data || '{}');
            const types = raw.markType || [];
            return types.some(t => t.toUpperCase().includes(filters.markType.toUpperCase()));
          } catch { return false; }
        });
      }
      setSearchResults(filtered);
    } catch (err) {
      console.error('Local search failed:', err);
    } finally {
      setSearching(false);
    }
  }

  async function handleRenameProject(id) {
    if (!editName.trim()) return;
    try {
      await api.renameProject(id, editName.trim());
      setEditingId(null);
      loadData();
    } catch (err) {
      console.error('Rename failed:', err);
    }
  }

  async function handleDeleteProject(id) {
    if (!confirm('Delete this project and all its files? This cannot be undone.')) return;
    try {
      await api.deleteProject(id);
      loadData();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  }

  function handleViewResult(result) {
    if (!onViewAssignment) return;
    try {
      const raw = JSON.parse(result.raw_data || '{}');
      onViewAssignment({
        serialNumber: result.serial_number,
        registrationNumber: result.registration_number,
        markText: result.mark_text,
        status: raw.alive ? 'LIVE' : 'DEAD',
        alive: raw.alive || false,
        ownerName: raw.ownerName || null,
        ownerType: raw.ownerType || null,
        attorney: raw.attorney || null,
        filedDate: raw.filedDate || null,
        registrationDate: raw.registrationDate || null,
        abandonDate: raw.abandonDate || null,
        cancelDate: raw.cancelDate || null,
        markType: (raw.markType || [])[0] || null,
        markDescription: raw.markDescription || [],
        goodsAndServices: raw.goodsAndServices || [],
        internationalClass: raw.internationalClass || [],
        drawingCode: raw.drawingCode || null,
        disclaimer: raw.disclaimer || null,
        raw,
      });
    } catch {
      onViewAssignment({ markText: result.mark_text, serialNumber: result.serial_number });
    }
  }

  function clearFilters() {
    setFilters({ alive: '', markType: '', projectId: '' });
  }

  const activeFilterCount = Object.values(filters).filter(v => v !== '').length;

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  // Projects view
  if (mode === 'projects') {
    return (
      <div className="file-manager">
        <h2>Projects</h2>

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

        <div className="file-grid">
          {projects.map((project) => (
            <div key={project.id} className="file-card">
              {editingId === project.id ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="search-input"
                    style={{ fontSize: 14, padding: '4px 8px', flex: 1 }}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameProject(project.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                  />
                  <button className="btn btn-sm" onClick={() => handleRenameProject(project.id)}>Save</button>
                  <button className="btn btn-sm btn-secondary" onClick={() => setEditingId(null)}>Cancel</button>
                </div>
              ) : (
                <div className="file-name">{project.name}</div>
              )}
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
                  className="btn btn-sm btn-secondary"
                  onClick={() => { setEditingId(project.id); setEditName(project.name); }}
                >
                  Rename
                </button>
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
      </div>
    );
  }

  // Offline Mode view
  return (
    <div className="file-manager">
      <h2>Offline Mode</h2>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginBottom: 16 }}>
        Search your locally saved trademark data — no internet required.
      </p>

      {stats && (
        <div className="storage-stats">
          <div className="stat">
            <div className="stat-value">{stats.projectCount || 0}</div>
            <div className="stat-label">Projects</div>
          </div>
          <div className="stat">
            <div className="stat-value">{stats.fileCount || 0}</div>
            <div className="stat-label">Saved Records</div>
          </div>
          <div className="stat">
            <div className="stat-value">{formatBytes(stats.totalSize || 0)}</div>
            <div className="stat-label">Storage Used</div>
          </div>
        </div>
      )}

      <form onSubmit={handleLocalSearch}>
        <div className="search-bar">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search saved trademarks (mark names, owners, goods & services)..."
            disabled={searching}
          />
          <button type="submit" disabled={searching || !searchQuery.trim()}>
            {searching ? 'Searching...' : 'Search'}
          </button>
        </div>

        <div className="filter-toggle">
          <button
            type="button"
            className="btn-link"
            onClick={() => setShowFilters(!showFilters)}
          >
            Filters {activeFilterCount > 0 && `(${activeFilterCount})`} {showFilters ? '\u25B2' : '\u25BC'}
          </button>
          {activeFilterCount > 0 && (
            <button type="button" className="btn-link" onClick={clearFilters} style={{ marginLeft: 12 }}>
              Clear all
            </button>
          )}
        </div>

        {showFilters && (
          <div className="filter-panel">
            <div className="filter-row">
              <label>
                Status
                <select value={filters.alive} onChange={e => updateFilter('alive', e.target.value)}>
                  <option value="">All</option>
                  <option value="true">Live</option>
                  <option value="false">Dead</option>
                </select>
              </label>

              <label>
                Mark Type
                <select value={filters.markType} onChange={e => updateFilter('markType', e.target.value)}>
                  <option value="">All</option>
                  <option value="TRADEMARK">Trademark</option>
                  <option value="SERVICE MARK">Service Mark</option>
                  <option value="COLLECTIVE MARK">Collective Mark</option>
                  <option value="CERTIFICATION MARK">Certification Mark</option>
                </select>
              </label>

              <label>
                Project
                <select value={filters.projectId} onChange={e => updateFilter('projectId', e.target.value)}>
                  <option value="">All Projects</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        )}
      </form>

      {searchResults ? (
        <div className="results-list">
          <h3>{searchResults.length} local result{searchResults.length !== 1 ? 's' : ''}</h3>
          {searchResults.length === 0 && (
            <div className="empty-state">
              No matching records in your local data.
            </div>
          )}
          {searchResults.map((result, i) => {
            let raw = {};
            try { raw = JSON.parse(result.raw_data || '{}'); } catch {}
            const markText = result.mark_text || result.filename || 'Untitled';
            const alive = raw.alive;
            const ownerName = raw.ownerName;
            const markType = (raw.markType || [])[0];

            return (
              <div
                key={result.id || i}
                className="result-card"
                onClick={() => result.type === 'assignment' && handleViewResult(result)}
              >
                <div className="mark-name">{markText}</div>
                <div className="meta">
                  {result.serial_number && <span>Serial: {result.serial_number}</span>}
                  {result.registration_number && <span>Reg: {result.registration_number}</span>}
                  {ownerName && <span>Owner: {ownerName}</span>}
                  {alive !== undefined && (
                    <span className={`status-badge ${alive ? 'live' : 'dead'}`}>
                      {alive ? 'LIVE' : 'DEAD'}
                    </span>
                  )}
                </div>
                <div className="meta">
                  <span>Project: {result.project_name}</span>
                  {markType && <span>Type: {markType}</span>}
                  {result.type === 'download' && <span>File: {result.filename}</span>}
                </div>
                {result.type === 'assignment' && onViewAssignment && (
                  <div className="actions">
                    <button
                      className="btn btn-sm"
                      onClick={(e) => { e.stopPropagation(); handleViewResult(result); }}
                    >
                      View Details
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state" style={{ marginTop: 32 }}>
          Search your saved trademarks to browse offline.
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
