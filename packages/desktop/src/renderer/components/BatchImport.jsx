import React, { useState, useEffect, useRef } from 'react';

export default function BatchImport() {
  const [markList, setMarkList] = useState('');
  const [projectName, setProjectName] = useState('');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!processing) return;
    const unsubscribe = window.api.onBatchProgress((prog) => {
      setProgress(prog);
      if (prog.complete) {
        setProcessing(false);
      }
    });
    return unsubscribe;
  }, [processing]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!markList.trim()) return;

    const marks = markList
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (marks.length === 0) return;

    setProcessing(true);
    setError(null);
    setProgress({ current: 0, total: marks.length, complete: false });

    try {
      await window.api.batchSearch(marks);
    } catch (err) {
      setError(err.message || 'Batch search failed');
      setProcessing(false);
    }
  }

  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      // Handle CSV: extract first column
      const lines = text.split('\n');
      const marks = lines
        .map((line) => {
          const firstCol = line.split(',')[0].replace(/"/g, '').trim();
          return firstCol;
        })
        .filter((mark) => mark && mark.toLowerCase() !== 'mark' && mark.toLowerCase() !== 'trademark');
      setMarkList(marks.join('\n'));
    };
    reader.readAsText(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      const input = fileInputRef.current;
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      input.files = dataTransfer.files;
      handleFileUpload({ target: input });
    }
  }

  return (
    <div className="batch-import">
      <h2>Batch Import</h2>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
        Enter one trademark per line, or upload a CSV file with mark names in the first column.
      </p>

      <div
        className="drop-zone"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
      >
        Drop a CSV file here, or click to browse
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt"
          style={{ display: 'none' }}
          onChange={handleFileUpload}
        />
      </div>

      <form onSubmit={handleSubmit}>
        <div className="setting-group">
          <label>Project Name</label>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="e.g., ACME Brand Clearance"
          />
        </div>

        <textarea
          value={markList}
          onChange={(e) => setMarkList(e.target.value)}
          placeholder={'ACME CORP\nWIDGET PRO\nBRAND X\n...'}
          disabled={processing}
        />

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button className="btn" type="submit" disabled={processing || !markList.trim()}>
            {processing ? 'Processing...' : 'Start Batch Search'}
          </button>
          {markList.trim() && (
            <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              {markList.split('\n').filter((l) => l.trim()).length} marks to search
            </span>
          )}
        </div>
      </form>

      {error && <div className="error-message">{error}</div>}

      {progress && (
        <div style={{ marginTop: '16px' }}>
          <div style={{ fontSize: '14px', marginBottom: '8px' }}>
            {progress.complete
              ? `Complete! ${progress.total} marks processed.`
              : `Processing ${progress.current} of ${progress.total}...`}
            {progress.currentMark && !progress.complete && (
              <span style={{ color: 'var(--color-text-secondary)' }}> — {progress.currentMark}</span>
            )}
          </div>
          <div className="progress-bar">
            <div
              className="fill"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
