import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import SearchPanel from './components/SearchPanel';
import ResultsList from './components/ResultsList';
import AssignmentView from './components/AssignmentView';
import FileManager from './components/FileManager';
import BatchImport from './components/BatchImport';
import Settings from './components/Settings';

const VIEWS = {
  SEARCH: 'search',
  PROJECTS: 'projects',
  FILES: 'files',
  SETTINGS: 'settings',
  ASSIGNMENT: 'assignment',
  BATCH: 'batch',
};

export default function App() {
  const [activeView, setActiveView] = useState(VIEWS.SEARCH);
  const [searchResults, setSearchResults] = useState(null);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [activeProjectId, setActiveProjectId] = useState(null);

  function handleViewAssignment(assignment) {
    setSelectedAssignment(assignment);
    setActiveView(VIEWS.ASSIGNMENT);
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
