import React from 'react';

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
        <div
          key={item.serialNumber || index}
          className="result-card"
          onClick={() => onViewAssignment(item)}
        >
          <div className="mark-name">{item.markText || item.productTitle || 'Untitled'}</div>
          <div className="meta">
            {item.serialNumber && <span>Serial: {item.serialNumber}</span>}
            {item.registrationNumber && <span>Reg: {item.registrationNumber}</span>}
            {item.status && (
              <span className={`status-badge ${item.status.toLowerCase() === 'live' ? 'live' : 'dead'}`}>
                {item.status}
              </span>
            )}
            {item.assignmentCount !== undefined && (
              <span>{item.assignmentCount} assignment(s)</span>
            )}
          </div>
          <div className="actions">
            <button
              className="btn btn-sm"
              onClick={(e) => {
                e.stopPropagation();
                onViewAssignment(item);
              }}
            >
              View Assignments
            </button>
            <button
              className="btn btn-sm btn-secondary"
              onClick={(e) => {
                e.stopPropagation();
                handleSave(item);
              }}
            >
              Save to Project
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

async function handleSave(item) {
  try {
    const projectName = `${item.markText || 'Search'}-${new Date().toISOString().slice(0, 10)}`;
    const project = await window.api.createProject(projectName, [item.markText]);
    await window.api.saveAssignment(project.id, item);
  } catch (err) {
    console.error('Failed to save:', err);
  }
}
