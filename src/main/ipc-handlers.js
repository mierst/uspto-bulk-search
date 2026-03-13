const { ipcMain, dialog, shell } = require('electron');
const path = require('path');
const Store = require('electron-store');
const database = require('./database');
const usptoClient = require('./services/uspto-client');
const assignmentEngine = require('./services/assignment-engine');
const fileManager = require('./services/file-manager');
const searchIndex = require('./services/search-index');
const pdfExtractor = require('./services/pdf-extractor');
const { exportChainOfTitle } = require('./services/exhibit-exporter');

const store = new Store({
  encryptionKey: 'uspto-bulk-search-v1',
  defaults: {
    saveLocation: '',
    apiKey: '',
  },
});

function getDataRoot() {
  const loc = store.get('saveLocation');
  if (!loc) throw new Error('Save location not configured. Go to Settings to set one.');
  return loc;
}

function registerIpcHandlers() {
  // --- USPTO Trademark Search ---
  ipcMain.handle('uspto:search', async (_event, query, options) => {
    const apiKey = store.get('apiKey');
    if (apiKey) usptoClient.setApiKey(apiKey);
    return usptoClient.search(query, options);
  });

  // --- TSDR Case Status ---
  ipcMain.handle('uspto:caseStatus', async (_event, caseId) => {
    const apiKey = store.get('apiKey');
    if (apiKey) usptoClient.setApiKey(apiKey);
    return usptoClient.getCaseStatus(caseId);
  });

  ipcMain.handle('uspto:download', async (_event, url, projectId) => {
    const dataRoot = getDataRoot();
    const project = await database.getProject(dataRoot, projectId);
    if (!project) throw new Error('Project not found');

    const buffer = await usptoClient.downloadFile(url);
    const filename = path.basename(new URL(url).pathname) || `download-${Date.now()}`;
    const projectDir = path.join(dataRoot, project.storage_path);
    const filePath = fileManager.saveDownload(projectDir, filename, buffer);

    // Extract text for PDFs
    let contentText = null;
    if (filename.endsWith('.pdf')) {
      contentText = await pdfExtractor.extractText(filePath);
    }

    const ext = path.extname(filename).slice(1) || 'bin';
    await database.trackDownload(dataRoot, projectId, filename, filePath, ext, buffer.length, url, contentText);

    return { filename, filePath, size: buffer.length };
  });

  // --- Projects ---
  ipcMain.handle('project:create', async (_event, name, searchTerms) => {
    const dataRoot = getDataRoot();
    return await database.createProject(dataRoot, name, searchTerms);
  });

  ipcMain.handle('project:findOrCreate', async (_event, name, searchTerms) => {
    const dataRoot = getDataRoot();
    return await database.findOrCreateProject(dataRoot, name, searchTerms);
  });

  ipcMain.handle('project:list', async () => {
    const dataRoot = getDataRoot();
    return await database.listProjects(dataRoot);
  });

  ipcMain.handle('project:get', async (_event, id) => {
    const dataRoot = getDataRoot();
    return await database.getProject(dataRoot, id);
  });

  ipcMain.handle('project:delete', async (_event, id) => {
    const dataRoot = getDataRoot();
    await database.deleteProject(dataRoot, id);
  });

  ipcMain.handle('project:rename', async (_event, id, newName) => {
    const dataRoot = getDataRoot();
    await database.renameProject(dataRoot, id, newName);
  });

  // --- Assignments ---
  ipcMain.handle('assignment:list', async (_event, projectId) => {
    const dataRoot = getDataRoot();
    return await database.getAssignments(dataRoot, projectId);
  });

  ipcMain.handle('assignment:save', async (_event, projectId, data) => {
    const dataRoot = getDataRoot();
    return await database.saveAssignment(dataRoot, projectId, data);
  });

  ipcMain.handle('assignment:projects', async (_event, serialNumber) => {
    const dataRoot = getDataRoot();
    return await database.getAssignmentProjects(dataRoot, serialNumber);
  });

  // --- Local Search ---
  ipcMain.handle('search:local', async (_event, query) => {
    const dataRoot = getDataRoot();
    return searchIndex.search(dataRoot, query);
  });

  // --- Files ---
  ipcMain.handle('file:list', async (_event, projectId) => {
    const dataRoot = getDataRoot();
    if (projectId) {
      const project = await database.getProject(dataRoot, projectId);
      if (!project) return [];
      return fileManager.listProjectFiles(path.join(dataRoot, project.storage_path));
    }
    return await database.getDownloads(dataRoot, projectId);
  });

  ipcMain.handle('file:delete', async (_event, fileId) => {
    const dataRoot = getDataRoot();
    await database.deleteDownload(dataRoot, fileId);
  });

  ipcMain.handle('file:stats', async () => {
    const dataRoot = getDataRoot();
    return await database.getStorageStats(dataRoot);
  });

  // --- Export ---
  ipcMain.handle('export:exhibit', async (_event, assignmentIds, projectId) => {
    const dataRoot = getDataRoot();
    const project = await database.getProject(dataRoot, projectId);
    if (!project) throw new Error('Project not found');

    const assignments = await database.getAssignments(dataRoot, projectId);
    const chain = assignmentEngine.buildChainOfTitle(assignments);

    // Save chain of title JSON
    const projectDir = path.join(dataRoot, project.storage_path);
    fileManager.saveChainOfTitle(projectDir, chain);

    // Generate PDF exhibit
    const pdfBuffer = await exportChainOfTitle(chain);
    const filename = `${chain.markText || 'exhibit'}-chain-of-title.pdf`.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = fileManager.saveExhibit(projectDir, filename, pdfBuffer);

    return { filePath, filename };
  });

  // --- Settings ---
  ipcMain.handle('settings:get', async () => {
    return {
      saveLocation: store.get('saveLocation', ''),
      apiKey: store.get('apiKey', ''),
    };
  });

  ipcMain.handle('settings:set', async (_event, settings) => {
    if (settings.saveLocation !== undefined) {
      store.set('saveLocation', settings.saveLocation);
    }
    if (settings.apiKey !== undefined) {
      store.set('apiKey', settings.apiKey);
      if (settings.apiKey) usptoClient.setApiKey(settings.apiKey);
    }
  });

  ipcMain.handle('settings:chooseSaveLocation', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Choose Save Location for USPTO Data',
    });
    if (result.canceled) return null;
    const selectedPath = result.filePaths[0];
    store.set('saveLocation', selectedPath);
    return selectedPath;
  });

  // --- External Links ---
  ipcMain.handle('shell:openExternal', async (_event, url) => {
    // Only allow USPTO URLs
    if (url.startsWith('https://tsdr.uspto.gov/') || url.startsWith('https://tmsearch.uspto.gov/')) {
      await shell.openExternal(url);
    }
  });

  // --- Batch Search ---
  ipcMain.handle('batch:search', async (event, marks) => {
    const dataRoot = getDataRoot();
    const apiKey = store.get('apiKey');
    if (apiKey) usptoClient.setApiKey(apiKey);

    const projectName = `Batch-${new Date().toISOString().slice(0, 10)}`;
    const project = await database.createProject(dataRoot, projectName, marks);

    for (let i = 0; i < marks.length; i++) {
      const mark = marks[i];
      try {
        event.sender.send('batch:progress', {
          current: i + 1,
          total: marks.length,
          currentMark: mark,
          complete: false,
        });

        const results = await usptoClient.search(mark);
        for (const item of results.items) {
          await database.saveAssignment(dataRoot, project.id, item);
        }
      } catch (err) {
        console.error(`Batch search failed for "${mark}":`, err.message);
      }
    }

    event.sender.send('batch:progress', {
      current: marks.length,
      total: marks.length,
      complete: true,
    });

    return { projectId: project.id, projectName };
  });
}

module.exports = { registerIpcHandlers };
