import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api';

const NAV_ITEMS = [
  { id: '/', label: 'Search', icon: '\u{1F50D}' },
  { id: '/batch', label: 'Batch Import', icon: '\u{1F4CB}' },
  { id: '/projects', label: 'Projects', icon: '\u{1F4C1}' },
  { id: '/files', label: 'Offline Mode', icon: '\u{1F4BE}' },
  { id: '/settings', label: 'Settings', icon: '\u{2699}' },
];

export default function Sidebar({ user }) {
  const [projects, setProjects] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    try {
      const result = await api.listProjects();
      setProjects(result || []);
    } catch {
      // API not available yet during dev
    }
  }

  function isActive(path) {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1>USPTO Search</h1>
        <div className="subtitle">Trademark Clearance</div>
      </div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={isActive(item.id) ? 'active' : ''}
            onClick={() => navigate(item.id)}
          >
            <span className="icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
      {projects.length > 0 && (
        <>
          <div className="sidebar-section-label">Recent Projects</div>
          <div className="sidebar-projects">
            {projects.slice(0, 5).map((project) => (
              <button
                key={project.id}
                onClick={() => navigate(`/projects/${project.id}`)}
              >
                {project.name}
              </button>
            ))}
          </div>
        </>
      )}
      <div className="sidebar-version">
        {user && (
          <span>{user.name || user.email}</span>
        )}
      </div>
    </aside>
  );
}
