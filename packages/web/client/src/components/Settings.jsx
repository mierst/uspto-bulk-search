import React, { useState, useEffect } from 'react';
import { api } from '../api';

export default function Settings({ user }) {
  const [settings, setSettings] = useState({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const current = await api.getSettings();
      if (current) setSettings(current);
    } catch {
      // API not available yet
    }
  }

  async function handleSave() {
    try {
      await api.setSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Save settings failed:', err);
    }
  }

  async function handleLogout() {
    try {
      await api.logout();
      window.location.href = '/login';
    } catch (err) {
      console.error('Logout failed:', err);
    }
  }

  return (
    <div className="settings-panel">
      <h2>Settings</h2>

      {user && (
        <div className="setting-group">
          <label>Account</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
            {user.avatar && (
              <img
                src={user.avatar}
                alt=""
                style={{ width: 36, height: 36, borderRadius: '50%' }}
              />
            )}
            <div>
              <div style={{ fontWeight: 500 }}>{user.name || user.email}</div>
              {user.name && user.email && (
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{user.email}</div>
              )}
            </div>
          </div>
          <button className="btn btn-secondary" onClick={handleLogout} style={{ marginTop: 8 }}>
            Sign Out
          </button>
        </div>
      )}

      <button className="btn" onClick={handleSave}>
        {saved ? 'Saved!' : 'Save Settings'}
      </button>
    </div>
  );
}
