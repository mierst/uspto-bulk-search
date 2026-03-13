import React, { useState, useEffect } from 'react';

export default function ProjectDetail({ projectId, onViewAssignment, onBack }) {
  const [project, setProject] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    if (projectId) loadProject();
  }, [projectId]);

  async function loadProject() {
    setLoading(true);
    try {
      const proj = await window.api.getProject(projectId);
      setProject(proj);
      const rows = await window.api.getAssignments(projectId);
      const items = (rows || []).map(row => {
        let raw = {};
        try { raw = JSON.parse(row.raw_data || '{}'); } catch {}
        return {
          serialNumber: row.serial_number,
          registrationNumber: row.registration_number,
          markText: row.mark_text,
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
        };
      });
      setAssignments(items);
    } catch (err) {
      console.error('Failed to load project:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="loading">Loading project...</div>;
  }

  if (!project) {
    return <div className="empty-state">Project not found.</div>;
  }

  const searchTerms = (() => {
    try { return JSON.parse(project.search_terms || '[]'); } catch { return []; }
  })();

  return (
    <div className="content-area">
      <span className="back-link" onClick={onBack}>
        &larr; Back to projects
      </span>

      {editing ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, marginBottom: 12 }}>
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="search-input"
            style={{ fontSize: 18, padding: '4px 10px', fontWeight: 600, flex: 1, maxWidth: 400 }}
            autoFocus
            onKeyDown={async (e) => {
              if (e.key === 'Enter' && editName.trim()) {
                await window.api.renameProject(projectId, editName.trim());
                setEditing(false);
                loadProject();
              }
              if (e.key === 'Escape') setEditing(false);
            }}
          />
          <button className="btn btn-sm" onClick={async () => {
            if (!editName.trim()) return;
            await window.api.renameProject(projectId, editName.trim());
            setEditing(false);
            loadProject();
          }}>Save</button>
          <button className="btn btn-sm btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
        </div>
      ) : (
        <h2 style={{ marginTop: 8, cursor: 'pointer' }} onClick={() => { setEditName(project.name); setEditing(true); }}>
          {project.name} <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontWeight: 400 }}>&#9998;</span>
        </h2>
      )}
      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
        Created {new Date(project.created_at).toLocaleDateString()}
        {searchTerms.length > 0 && <> &middot; Search terms: {searchTerms.join(', ')}</>}
        &middot; {assignments.length} saved record{assignments.length !== 1 ? 's' : ''}
      </div>

      {assignments.length === 0 ? (
        <div className="empty-state">No saved records in this project.</div>
      ) : (
        <div className="results-list">
          {assignments.map((item, index) => (
            <div
              key={item.serialNumber || index}
              className="result-card"
              onClick={() => onViewAssignment(item)}
            >
              <div className="mark-name">{item.markText || 'Untitled'}</div>
              <div className="meta">
                {item.serialNumber && <span>Serial: {item.serialNumber}</span>}
                {item.registrationNumber && <span>Reg: {item.registrationNumber}</span>}
                {item.ownerName && <span>Owner: {item.ownerName}</span>}
                {item.status && (
                  <span className={`status-badge ${item.alive ? 'live' : 'dead'}`}>
                    {item.status}
                  </span>
                )}
              </div>
              <div className="meta">
                {item.filedDate && <span>Filed: {item.filedDate}</span>}
                {item.registrationDate && <span>Registered: {item.registrationDate}</span>}
                {item.markType && <span>Type: {item.markType}</span>}
              </div>
              <div className="actions">
                <button
                  className="btn btn-sm"
                  onClick={(e) => { e.stopPropagation(); onViewAssignment(item); }}
                >
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
