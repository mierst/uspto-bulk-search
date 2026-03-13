const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const { registerIpcHandlers } = require('./ipc-handlers');
const usptoClient = require('./services/uspto-client');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'USPTO Bulk Search',
  });

  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
  }
}

ipcMain.on('app:version', (event) => {
  event.returnValue = app.getVersion();
});

app.whenReady().then(async () => {
  registerIpcHandlers();
  createWindow();

  // Auto-updater (production only)
  if (app.isPackaged) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('update-available', (info) => {
      mainWindow?.webContents.send('update:available', info.version);
    });

    autoUpdater.on('download-progress', (progress) => {
      mainWindow?.webContents.send('update:progress', Math.round(progress.percent));
    });

    autoUpdater.on('update-downloaded', (info) => {
      mainWindow?.webContents.send('update:downloaded', info.version);
    });

    autoUpdater.on('error', (err) => {
      console.warn('Auto-updater error:', err.message);
    });

    autoUpdater.checkForUpdates().catch(err => {
      console.warn('Update check deferred:', err.message);
    });
  }

  ipcMain.handle('update:install', () => {
    autoUpdater.quitAndInstall(false, true);
  });

  ipcMain.handle('update:check', async () => {
    const result = await autoUpdater.checkForUpdates();
    return result?.updateInfo?.version || null;
  });

  // Initialize USPTO search session in background (solves WAF challenge)
  usptoClient.initSession().catch(err => {
    console.warn('USPTO session init deferred:', err.message);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  usptoClient.destroy();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Force exit if quit hangs (e.g. hidden windows blocking close)
app.on('will-quit', () => {
  setTimeout(() => process.exit(0), 3000);
});
