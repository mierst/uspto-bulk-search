import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import SearchPanel from './components/SearchPanel';
import ResultsList from './components/ResultsList';
import AssignmentView from './components/AssignmentView';
import FileManager from './components/FileManager';
import BatchImport from './components/BatchImport';
import Settings from './components/Settings';
import SetupWizard from './components/SetupWizard';

const VIEWS = {
  SEARCH: 'search',
  PROJECTS: 'projects',
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

  useEffect(() => {
    checkSetup();
  }, []);

  async function checkSetup() {
    try {
      const settings = await window.api.getSettings();
      setNeedsSetup(!settings.saveLocation);
    } catch {
      setNeedsSetup(true);
    }
  }

  function handleViewAssignment(assignment) {
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
            <SearchPanel onResults={setSearchResults} />
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
            onBack={() => setActiveView(VIEWS.SEARCH)}
          />
        );
      case VIEWS.PROJECTS:
        return (
          <FileManager
            mode="projects"
            onSelectProject={(id) => {
              setActiveProjectId(id);
              setActiveView(VIEWS.SEARCH);
            }}
          />
        );
      case VIEWS.FILES:
        return <FileManager mode="files" />;
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
        {renderContent()}
      </main>
    </div>
  );
}
