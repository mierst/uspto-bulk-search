import React, { useState, useEffect } from 'react';

export default function Settings() {
  const [settings, setSettings] = useState({
    saveLocation: '',
    apiKey: '',
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const current = await window.api.getSettings();
      if (current) setSettings(current);
    } catch {
      // API not available yet
    }
  }

  async function handleSave() {
    try {
      await window.api.setSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Save settings failed:', err);
    }
  }

  async function handleChooseLocation() {
    try {
      const path = await window.api.chooseSaveLocation();
      if (path) {
        setSettings((prev) => ({ ...prev, saveLocation: path }));
      }
    } catch (err) {
      console.error('Choose location failed:', err);
    }
  }

  return (
    <div className="settings-panel">
      <h2>Settings</h2>

      <div className="setting-group">
        <label>Save Location</label>
        <div className="path-input">
          <input
            type="text"
            value={settings.saveLocation}
            onChange={(e) => setSettings((prev) => ({ ...prev, saveLocation: e.target.value }))}
            placeholder="Choose where to save downloaded files..."
            readOnly
          />
          <button className="btn btn-secondary" onClick={handleChooseLocation}>
            Browse...
          </button>
        </div>
        <div className="help-text">
          All projects and downloaded files will be stored in this directory.
        </div>
      </div>

      <div className="setting-group">
        <label>USPTO API Key (Optional)</label>
        <input
          type="password"
          value={settings.apiKey}
          onChange={(e) => setSettings((prev) => ({ ...prev, apiKey: e.target.value }))}
          placeholder="Enter your USPTO API key..."
        />
        <div className="help-text">
          Required for some bulk data downloads. Get one at developer.uspto.gov
        </div>
      </div>

      <button className="btn" onClick={handleSave}>
        {saved ? 'Saved!' : 'Save Settings'}
      </button>
    </div>
  );
}
