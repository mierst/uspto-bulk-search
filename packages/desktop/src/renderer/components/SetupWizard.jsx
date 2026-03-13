import React, { useState } from 'react';

export default function SetupWizard({ onComplete }) {
  const [step, setStep] = useState(1);
  const [saveLocation, setSaveLocation] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState(null);

  async function handleChooseLocation() {
    try {
      const path = await window.api.chooseSaveLocation();
      if (path) {
        setSaveLocation(path);
        setError(null);
      }
    } catch (err) {
      setError('Failed to select folder. Please try again.');
    }
  }

  async function handleFinish() {
    if (!saveLocation) {
      setError('Please choose a save location before continuing.');
      return;
    }
    try {
      await window.api.setSettings({ saveLocation, apiKey });
      onComplete();
    } catch (err) {
      setError('Failed to save settings. Please try again.');
    }
  }

  return (
    <div className="setup-overlay">
      <div className="setup-card">
        <div className="setup-header">
          <h1>USPTO Bulk Search</h1>
          <p>Trademark Clearance Tool</p>
        </div>

        <div className="setup-steps">
          <div className={`setup-step-indicator ${step >= 1 ? 'active' : ''}`}>1</div>
          <div className={`setup-step-line ${step >= 2 ? 'active' : ''}`} />
          <div className={`setup-step-indicator ${step >= 2 ? 'active' : ''}`}>2</div>
        </div>

        {step === 1 && (
          <div className="setup-body">
            <h2>Choose Save Location</h2>
            <p className="setup-description">
              Select a folder where your trademark search projects, assignment data,
              and exported exhibits will be stored. You can change this later in Settings.
            </p>

            <div className="setup-field">
              <div className="path-input">
                <input
                  type="text"
                  value={saveLocation}
                  placeholder="No folder selected..."
                  readOnly
                />
                <button className="btn" onClick={handleChooseLocation}>
                  Browse...
                </button>
              </div>
              {saveLocation && (
                <div className="setup-path-preview">
                  Data will be saved to: <strong>{saveLocation}</strong>
                </div>
              )}
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="setup-actions">
              <button
                className="btn"
                onClick={() => {
                  if (!saveLocation) {
                    setError('Please choose a save location to continue.');
                    return;
                  }
                  setError(null);
                  setStep(2);
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="setup-body">
            <h2>USPTO API Key (Optional)</h2>
            <p className="setup-description">
              Some bulk data downloads require an API key. You can skip this step
              and add one later in Settings if needed.
            </p>

            <div className="setup-field">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your USPTO API key..."
              />
              <div className="help-text" style={{ marginTop: '6px' }}>
                Get a key at developer.uspto.gov if you need one for bulk downloads.
              </div>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="setup-actions">
              <button className="btn btn-secondary" onClick={() => setStep(1)}>
                Back
              </button>
              <button className="btn" onClick={handleFinish}>
                {apiKey ? 'Finish Setup' : 'Skip & Finish'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
