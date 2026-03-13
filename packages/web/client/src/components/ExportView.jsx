import React from 'react';
import { api } from '../api';

export default function ExportView({ assignments, projectId, onExportComplete }) {
  async function handleExport(type) {
    try {
      const ids = assignments.map((a) => a.id).filter(Boolean);
      await api.exportExhibit(ids, projectId);
      onExportComplete?.();
    } catch (err) {
      console.error('Export failed:', err);
    }
  }

  return (
    <div>
      <h3>Export Options</h3>
      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        <button className="btn" onClick={() => handleExport('chain')}>
          Export Chain of Title
        </button>
        <button className="btn btn-secondary" onClick={() => handleExport('individual')}>
          Export Individual Assignments
        </button>
      </div>
    </div>
  );
}
