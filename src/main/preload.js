const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Search
  searchUSPTO: (query) => ipcRenderer.invoke('uspto:search', query),
  getProduct: (productId) => ipcRenderer.invoke('uspto:product', productId),
  downloadFile: (url, projectId) => ipcRenderer.invoke('uspto:download', url, projectId),

  // Projects
  createProject: (name, searchTerms) => ipcRenderer.invoke('project:create', name, searchTerms),
  listProjects: () => ipcRenderer.invoke('project:list'),
  getProject: (id) => ipcRenderer.invoke('project:get', id),
  deleteProject: (id) => ipcRenderer.invoke('project:delete', id),

  // Assignments
  getAssignments: (projectId) => ipcRenderer.invoke('assignment:list', projectId),
  saveAssignment: (projectId, data) => ipcRenderer.invoke('assignment:save', projectId, data),

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

  // Batch
  batchSearch: (marks) => ipcRenderer.invoke('batch:search', marks),
  onBatchProgress: (callback) => {
    const handler = (_event, progress) => callback(progress);
    ipcRenderer.on('batch:progress', handler);
    return () => ipcRenderer.removeListener('batch:progress', handler);
  },
});
