import React, { useState, useEffect, useRef } from 'react';

function SaveProjectPicker({ item, onClose }) {
  const [projects, setProjects] = useState([]);
  const [savedTo, setSavedTo] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState(`${item.markText || 'Search'}-${new Date().toISOString().slice(0, 10)}`);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const modalRef = useRef(null);

  useEffect(() => {
    Promise.all([
      window.api.listProjects(),
      window.api.getAssignmentProjects(item.serialNumber),
    ]).then(([list, existing]) => {
      setProjects(list || []);
      setSavedTo(new Set((existing || []).map(p => p.id)));
      setLoading(false);
    }).catch(() => setLoading(false));
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

  async function saveToProject(projectId) {
    setSaving(true);
    setError(null);
    try {
      await window.api.saveAssignment(projectId, item);
      setDone(true);
      setTimeout(() => onClose(), 800);
    } catch (err) {
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
      const project = await window.api.createProject(newName.trim(), [item.markText]);
      await window.api.saveAssignment(project.id, item);
      setDone(true);
      setTimeout(() => onClose(), 800);
    } catch (err) {
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
        <div style={{ padding: 12, fontSize: 13 }}>Loading...</div>
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
                type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                placeholder="Project name" className="search-input"
                style={{ fontSize: 13, padding: '4px 8px' }} autoFocus
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

export default function AssignmentView({ assignment, onBack }) {
  const [showPicker, setShowPicker] = useState(false);
  const [savedProjects, setSavedProjects] = useState([]);

  useEffect(() => {
    if (assignment?.serialNumber) {
      window.api.getAssignmentProjects(assignment.serialNumber).then(projects => {
        setSavedProjects(projects || []);
      }).catch(() => {});
    }
  }, [assignment?.serialNumber, showPicker]);

  if (!assignment) {
    return <div className="empty-state">No trademark selected</div>;
  }

  const raw = assignment.raw || {};

  function formatDate(dateStr) {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  const goods = assignment.goodsAndServices || raw.goodsAndServices || [];
  const classes = assignment.internationalClass || raw.internationalClass || [];
  const description = assignment.markDescription || raw.markDescription || [];

  return (
    <div className="assignment-view">
      <span className="back-link" onClick={onBack}>
        &larr; Back to results
      </span>

      <h2>{assignment.markText || 'Trademark Details'}</h2>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap', position: 'relative' }}>
        <button className="btn btn-secondary" onClick={() => setShowPicker(true)}>
          Save to Project
        </button>
        {showPicker && (
          <SaveProjectPicker item={assignment} onClose={() => setShowPicker(false)} />
        )}
        {assignment.serialNumber && (
          <button className="btn btn-secondary" onClick={() => {
            window.api.openExternal(`https://tsdr.uspto.gov/#caseNumber=${assignment.serialNumber}&caseSearchType=US_APPLICATION&caseType=DEFAULT&searchType=statusSearch`);
          }}>
            View on TSDR
          </button>
        )}
        {assignment.serialNumber && (
          <button className="btn btn-secondary" onClick={() => {
            window.api.openTMSearch(`https://tmsearch.uspto.gov/search/search-detail/${assignment.serialNumber}`);
          }}>
            View on TMSearch
          </button>
        )}
      </div>

      {savedProjects.length > 0 && (
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
          Saved to: {savedProjects.map((p, i) => (
            <span key={p.id}>
              {i > 0 && ', '}
              <strong>{p.name}</strong>
            </span>
          ))}
        </div>
      )}

      <div className="detail-grid">
        <div className="detail-section">
          <h3>Registration Info</h3>
          <dl>
            {assignment.serialNumber && <><dt>Serial Number</dt><dd>{assignment.serialNumber}</dd></>}
            {assignment.registrationNumber && <><dt>Registration Number</dt><dd>{assignment.registrationNumber}</dd></>}
            <dt>Status</dt>
            <dd>
              <span className={`status-badge ${assignment.alive ? 'live' : 'dead'}`}>
                {assignment.status}
              </span>
            </dd>
            {assignment.markType && <><dt>Mark Type</dt><dd>{assignment.markType}</dd></>}
            {(raw.drawingCode || assignment.drawingCode) && <><dt>Drawing Code</dt><dd>{raw.drawingCode || assignment.drawingCode}</dd></>}
            {(raw.registrationType || assignment.registrationType) && <><dt>Registration Type</dt><dd>{(raw.registrationType || assignment.registrationType)}</dd></>}
          </dl>
        </div>

        <div className="detail-section">
          <h3>Dates</h3>
          <dl>
            {assignment.filedDate && <><dt>Filed</dt><dd>{formatDate(assignment.filedDate)}</dd></>}
            {assignment.registrationDate && <><dt>Registered</dt><dd>{formatDate(assignment.registrationDate)}</dd></>}
            {assignment.abandonDate && <><dt>Abandoned</dt><dd>{formatDate(assignment.abandonDate)}</dd></>}
            {assignment.cancelDate && <><dt>Cancelled</dt><dd>{formatDate(assignment.cancelDate)}</dd></>}
          </dl>
        </div>

        <div className="detail-section">
          <h3>Owner</h3>
          <dl>
            {assignment.ownerName && <><dt>Name</dt><dd>{assignment.ownerName}</dd></>}
            {assignment.ownerType && <><dt>Type</dt><dd>{assignment.ownerType}</dd></>}
            {assignment.attorney && <><dt>Attorney</dt><dd>{assignment.attorney}</dd></>}
          </dl>
        </div>
      </div>

      {classes.length > 0 && (
        <div className="detail-section" style={{ marginTop: 16 }}>
          <h3>International Classes</h3>
          <div className="class-tags">
            {classes.map((cls, i) => (
              <span key={i} className="class-tag">{cls}</span>
            ))}
          </div>
        </div>
      )}

      {goods.length > 0 && (
        <div className="detail-section" style={{ marginTop: 16 }}>
          <h3>Goods & Services</h3>
          <ul className="goods-list">
            {goods.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </div>
      )}

      {description.length > 0 && (
        <div className="detail-section" style={{ marginTop: 16 }}>
          <h3>Mark Description</h3>
          <p>{description.join(' ')}</p>
        </div>
      )}

      {assignment.disclaimer && (
        <div className="detail-section" style={{ marginTop: 16 }}>
          <h3>Disclaimer</h3>
          <p>{assignment.disclaimer}</p>
        </div>
      )}
    </div>
  );
}
