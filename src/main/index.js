const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const ipc = require('./ipc');
const store = require('./store');

let mainWindow = null;

// Linux 下部分桌面环境的 GPU 驱动会让窗口白屏，允许通过环境变量降级
if (process.env.EPM_DISABLE_GPU === '1') {
  app.disableHardwareAcceleration();
}

function iconPath() {
  const candidate = path.join(__dirname, '..', '..', 'icons', 'icon.png');
  return require('fs').existsSync(candidate) ? candidate : undefined;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    icon: iconPath(),
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  store.ensureDirs();
  ipc.register();
  Menu.setApplicationMenu(null);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// 单实例：避免两个进程同时写 data.json
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}
