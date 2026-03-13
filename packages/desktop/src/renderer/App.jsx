import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import SearchPanel from './components/SearchPanel';
import ResultsList from './components/ResultsList';
import AssignmentView from './components/AssignmentView';
import ProjectDetail from './components/ProjectDetail';
import FileManager from './components/FileManager';
import BatchImport from './components/BatchImport';
import Settings from './components/Settings';
import SetupWizard from './components/SetupWizard';

const VIEWS = {
  SEARCH: 'search',
  PROJECTS: 'projects',
  PROJECT_DETAIL: 'project_detail',
  FILES: 'files',
  SETTINGS: 'settings',
  ASSIGNMENT: 'assignment',
  BATCH: 'batch',
};

export default function App() {
  const [needsSetup, setNeedsSetup] = useState(null); // null = loading, true/false
  const [activeView, setActiveView] = useState(VIEWS.SEARCH);
  const [searchResults, setSearchResults] = useState(null);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [previousView, setPreviousView] = useState(VIEWS.SEARCH);
  const [updateStatus, setUpdateStatus] = useState(null); // null | {state, version, percent}

  useEffect(() => {
    checkSetup();
  }, []);

  useEffect(() => {
    const cleanups = [];
    if (window.api?.onUpdateAvailable) {
      cleanups.push(window.api.onUpdateAvailable((version) => {
        setUpdateStatus({ state: 'downloading', version, percent: 0 });
      }));
      cleanups.push(window.api.onUpdateProgress((percent) => {
        setUpdateStatus(prev => prev ? { ...prev, percent } : null);
      }));
      cleanups.push(window.api.onUpdateDownloaded((version) => {
        setUpdateStatus({ state: 'ready', version, percent: 100 });
      }));
    }
    return () => cleanups.forEach(fn => fn());
  }, []);

  async function checkSetup() {
    try {
      const settings = await window.api.getSettings();
      setNeedsSetup(!settings.saveLocation);
    } catch {
      setNeedsSetup(true);
    }
  }

  function handleViewAssignment(assignment, fromView) {
    setPreviousView(fromView || activeView);
    setSelectedAssignment(assignment);
    setActiveView(VIEWS.ASSIGNMENT);
  }

  // Show nothing while checking settings
  if (needsSetup === null) {
    return (
      <div className="setup-overlay">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  // Show setup wizard if save location not configured
  if (needsSetup) {
    return <SetupWizard onComplete={() => setNeedsSetup(false)} />;
  }

  function renderContent() {
    switch (activeView) {
      case VIEWS.SEARCH:
        return (
          <div className="content-area">
            <SearchPanel onResults={setSearchResults} hasResults={!!searchResults} />
            {searchResults && (
              <ResultsList
                results={searchResults}
                onViewAssignment={handleViewAssignment}
              />
            )}
          </div>
        );
      case VIEWS.ASSIGNMENT:
        return (
          <AssignmentView
            assignment={selectedAssignment}
            onBack={() => setActiveView(previousView)}
          />
        );
      case VIEWS.PROJECT_DETAIL:
        return (
          <ProjectDetail
            projectId={activeProjectId}
            onViewAssignment={(a) => handleViewAssignment(a, VIEWS.PROJECT_DETAIL)}
            onBack={() => setActiveView(VIEWS.PROJECTS)}
          />
        );
      case VIEWS.PROJECTS:
        return (
          <FileManager
            mode="projects"
            onSelectProject={(id) => {
              setActiveProjectId(id);
              setActiveView(VIEWS.PROJECT_DETAIL);
            }}
          />
        );
      case VIEWS.FILES:
        return (
          <FileManager
            mode="files"
            onViewAssignment={(a) => handleViewAssignment(a, VIEWS.FILES)}
          />
        );
      case VIEWS.BATCH:
        return <BatchImport />;
      case VIEWS.SETTINGS:
        return <Settings />;
      default:
        return null;
    }
  }

  return (
    <div className="app-container">
      <Sidebar
        activeView={activeView}
        onNavigate={setActiveView}
      />
      <main className="main-content">
        {updateStatus && (
          <div className="update-banner">
            {updateStatus.state === 'downloading' ? (
              <span>Downloading update v{updateStatus.version}... {updateStatus.percent}%</span>
            ) : (
              <>
                <span>Update v{updateStatus.version} ready</span>
                <button onClick={() => window.api.installUpdate()}>Restart Now</button>
              </>
            )}
            <button className="dismiss-btn" onClick={() => setUpdateStatus(null)}>&times;</button>
          </div>
        )}
        {renderContent()}
      </main>
    </div>
  );
}
