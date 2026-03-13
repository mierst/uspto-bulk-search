import React, { useState, useEffect } from 'react';

export default function AssignmentView({ assignment, onBack }) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (assignment) {
      loadAssignmentDetails();
    }
  }, [assignment]);

  async function loadAssignmentDetails() {
    setLoading(true);
    try {
      // If this is a search result, fetch full assignment data
      if (assignment.serialNumber) {
        const result = await window.api.searchUSPTO(assignment.serialNumber);
        setAssignments(result?.assignments || [assignment]);
      } else {
        setAssignments([assignment]);
      }
    } catch {
      setAssignments([assignment]);
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const ids = assignments.map((a) => a.id).filter(Boolean);
      await window.api.exportExhibit(ids, assignment.projectId);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  }

  if (!assignment) {
    return <div className="empty-state">No assignment selected</div>;
  }

  return (
    <div className="assignment-view">
      <span className="back-link" onClick={onBack}>
        &larr; Back to results
      </span>

      <h2>{assignment.markText || 'Assignment Details'}</h2>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button className="btn" onClick={handleExport} disabled={exporting}>
          {exporting ? 'Exporting...' : 'Export as Exhibit'}
        </button>
        <button className="btn btn-secondary" onClick={() => handleSaveAll()}>
          Save All Assignments
        </button>
      </div>

      {loading ? (
        <div className="loading">Loading assignment details...</div>
      ) : (
        <>
          <div style={{ marginBottom: '16px' }}>
            <div className="meta">
              {assignment.serialNumber && <span>Serial: {assignment.serialNumber}</span>}
              {assignment.registrationNumber && <span>Reg: {assignment.registrationNumber}</span>}
              {assignment.status && (
                <span className={`status-badge ${assignment.status.toLowerCase() === 'live' ? 'live' : 'dead'}`}>
                  {assignment.status}
                </span>
              )}
            </div>
          </div>

          <h3 style={{ marginBottom: '12px' }}>Chain of Title ({assignments.length} record{assignments.length !== 1 ? 's' : ''})</h3>
          <div className="chain-of-title">
            {assignments.map((entry, index) => (
              <div key={index} className="chain-entry">
                <div className="entry-header">
                  <div>
                    <div className="entry-label">Assignor (From)</div>
                    <div className="entry-value">{entry.assignor || 'N/A'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="entry-label">Assignee (To)</div>
                    <div className="entry-value">{entry.assignee || 'N/A'}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '24px', marginTop: '8px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                  {entry.executionDate && <span>Executed: {entry.executionDate}</span>}
                  {entry.recordedDate && <span>Recorded: {entry.recordedDate}</span>}
                  {entry.reelFrame && <span>Reel/Frame: {entry.reelFrame}</span>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );

  async function handleSaveAll() {
    try {
      const projectName = `${assignment.markText || 'Assignment'}-${new Date().toISOString().slice(0, 10)}`;
      const project = await window.api.createProject(projectName, [assignment.markText]);
      for (const a of assignments) {
        await window.api.saveAssignment(project.id, a);
      }
    } catch (err) {
      console.error('Save failed:', err);
    }
  }
}
