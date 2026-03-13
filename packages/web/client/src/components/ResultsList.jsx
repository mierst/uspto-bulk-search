import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';

function SaveToProjectButton({ item, onClick }) {
  return (
    <button
      className="btn btn-sm btn-secondary"
      onClick={onClick}
    >
      Save to Project
    </button>
  );
}

function ProjectPickerModal({ item, onClose }) {
  const [projects, setProjects] = useState([]);
  const [savedTo, setSavedTo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState(`${item.markText || 'Search'}-${new Date().toISOString().slice(0, 10)}`);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const modalRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  async function loadData() {
    try {
      const [list, existing] = await Promise.all([
        api.listProjects(),
        api.getAssignmentProjects(item.serialNumber),
      ]);
      setProjects(list || []);
      setSavedTo(new Set((existing || []).map(p => p.id)));
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  }

  async function saveToProject(projectId) {
    setSaving(true);
    setError(null);
    try {
      await api.saveAssignment(projectId, item);
      setDone(true);
      setTimeout(() => onClose(), 800);
    } catch (err) {
      console.error('Failed to save:', err);
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function createAndSave() {
    if (!newName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const project = await api.createProject(newName.trim(), [item.markText]);
      await api.saveAssignment(project.id, item);
      setDone(true);
      setTimeout(() => onClose(), 800);
    } catch (err) {
      console.error('Failed to create project:', err);
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="project-picker-modal" ref={modalRef} onClick={(e) => e.stopPropagation()}>
        <div className="picker-header">Saved!</div>
      </div>
    );
  }

  return (
    <div className="project-picker-modal" ref={modalRef} onClick={(e) => e.stopPropagation()}>
      <div className="picker-header">Save to Project</div>
      {error && <div style={{ fontSize: 12, color: 'var(--color-danger)', padding: '4px 12px' }}>{error}</div>}

      {loading ? (
        <div style={{ padding: 12, fontSize: 13 }}>Loading projects...</div>
      ) : (
        <>
          {projects.length > 0 && (
            <div className="picker-list">
              {projects.map((p) => {
                const alreadySaved = savedTo.has(p.id);
                return (
                  <button
                    key={p.id}
                    className={`picker-item${alreadySaved ? ' picker-item-saved' : ''}`}
                    onClick={() => !alreadySaved && saveToProject(p.id)}
                    disabled={saving || alreadySaved}
                  >
                    {p.name}
                    {alreadySaved && <span className="picker-saved-badge">Saved</span>}
                  </button>
                );
              })}
            </div>
          )}

          {showNew ? (
            <div className="picker-new" onMouseDown={(e) => e.stopPropagation()}>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Project name"
                className="search-input"
                style={{ fontSize: 13, padding: '4px 8px' }}
                autoFocus
                onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') createAndSave(); }}
              />
              <button className="btn btn-sm" onClick={createAndSave} disabled={saving || !newName.trim()}>
                {saving ? 'Saving...' : 'Create & Save'}
              </button>
            </div>
          ) : (
            <button className="picker-item picker-new-btn" onClick={() => setShowNew(true)}>
              + New Project
            </button>
          )}
        </>
      )}
    </div>
  );
}

function ResultCard({ item, onViewAssignment }) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <div className="result-card" onClick={() => onViewAssignment(item)}>
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
      <div className="actions" style={{ position: 'relative' }}>
        <button
          className="btn btn-sm"
          onClick={(e) => { e.stopPropagation(); onViewAssignment(item); }}
        >
          View Details
        </button>
        <button
          className="btn btn-sm btn-secondary"
          onClick={(e) => { e.stopPropagation(); setShowPicker(true); }}
        >
          Save to Project
        </button>
        {showPicker && (
          <ProjectPickerModal item={item} onClose={() => setShowPicker(false)} />
        )}
      </div>
    </div>
  );
}

export default function ResultsList({ results, onViewAssignment }) {
  if (!results || !results.items || results.items.length === 0) {
    return (
      <div className="results-list">
        <div className="empty-state">
          No results found. Try a different search term.
        </div>
      </div>
    );
  }

  return (
    <div className="results-list">
      <h3>{results.numFound || results.items.length} results found</h3>
      {results.items.map((item, index) => (
        <ResultCard
          key={item.serialNumber || index}
          item={item}
          onViewAssignment={onViewAssignment}
        />
      ))}
    </div>
  );
}
