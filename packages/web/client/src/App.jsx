import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { api } from './api';
import Sidebar from './components/Sidebar';
import SearchPanel from './components/SearchPanel';
import ResultsList from './components/ResultsList';
import AssignmentView from './components/AssignmentView';
import ProjectDetail from './components/ProjectDetail';
import FileManager from './components/FileManager';
import BatchImport from './components/BatchImport';
import Settings from './components/Settings';
import LoginPage from './components/LoginPage';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchResults, setSearchResults] = useState(null);

  useEffect(() => {
    api.getMe()
      .then(u => { setUser(u); setLoading(false); })
      .catch(() => { setUser(null); setLoading(false); });
  }, []);

  if (loading) {
    return <div className="setup-overlay"><div className="loading">Loading...</div></div>;
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="app-container">
      <Sidebar user={user} />
      <main className="main-content">
        <Routes>
          <Route path="/" element={
            <div className="content-area">
              <SearchPanel onResults={setSearchResults} hasResults={!!searchResults} />
              {searchResults && <ResultsList results={searchResults} />}
            </div>
          } />
          <Route path="/batch" element={<BatchImport />} />
          <Route path="/projects" element={<FileManager mode="projects" />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/files" element={<FileManager mode="files" />} />
          <Route path="/settings" element={<Settings user={user} />} />
          <Route path="/assignment/:serial" element={<AssignmentView />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}
