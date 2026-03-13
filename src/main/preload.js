const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('appVersion', ipcRenderer.sendSync('app:version'));

contextBridge.exposeInMainWorld('api', {
  // Search
  searchUSPTO: (query, options) => ipcRenderer.invoke('uspto:search', query, options),
  getCaseStatus: (caseId) => ipcRenderer.invoke('uspto:caseStatus', caseId),
  downloadFile: (url, projectId) => ipcRenderer.invoke('uspto:download', url, projectId),

  // Projects
  createProject: (name, searchTerms) => ipcRenderer.invoke('project:create', name, searchTerms),
  findOrCreateProject: (name, searchTerms) => ipcRenderer.invoke('project:findOrCreate', name, searchTerms),
  listProjects: () => ipcRenderer.invoke('project:list'),
  getProject: (id) => ipcRenderer.invoke('project:get', id),
  deleteProject: (id) => ipcRenderer.invoke('project:delete', id),
  renameProject: (id, newName) => ipcRenderer.invoke('project:rename', id, newName),

  // Assignments
  getAssignments: (projectId) => ipcRenderer.invoke('assignment:list', projectId),
  saveAssignment: (projectId, data) => ipcRenderer.invoke('assignment:save', projectId, data),
  getAssignmentProjects: (serialNumber) => ipcRenderer.invoke('assignment:projects', serialNumber),

  // Local search
  localSearch: (query) => ipcRenderer.invoke('search:local', query),

  // Files
  listFiles: (projectId) => ipcRenderer.invoke('file:list', projectId),
  deleteFile: (fileId) => ipcRenderer.invoke('file:delete', fileId),
  getStorageStats: () => ipcRenderer.invoke('file:stats'),

  // Export
  exportExhibit: (assignmentIds, projectId) => ipcRenderer.invoke('export:exhibit', assignmentIds, projectId),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (settings) => ipcRenderer.invoke('settings:set', settings),
  chooseSaveLocation: () => ipcRenderer.invoke('settings:chooseSaveLocation'),

  // External links
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

  // Batch
  batchSearch: (marks) => ipcRenderer.invoke('batch:search', marks),
  onBatchProgress: (callback) => {
    const handler = (_event, progress) => callback(progress);
    ipcRenderer.on('batch:progress', handler);
    return () => ipcRenderer.removeListener('batch:progress', handler);
  },

  // Auto-update
  onUpdateAvailable: (callback) => {
    const handler = (_event, version) => callback(version);
    ipcRenderer.on('update:available', handler);
    return () => ipcRenderer.removeListener('update:available', handler);
  },
  onUpdateProgress: (callback) => {
    const handler = (_event, percent) => callback(percent);
    ipcRenderer.on('update:progress', handler);
    return () => ipcRenderer.removeListener('update:progress', handler);
  },
  onUpdateDownloaded: (callback) => {
    const handler = (_event, version) => callback(version);
    ipcRenderer.on('update:downloaded', handler);
    return () => ipcRenderer.removeListener('update:downloaded', handler);
  },
  installUpdate: () => ipcRenderer.invoke('update:install'),
});
