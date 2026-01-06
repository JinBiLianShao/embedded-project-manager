const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

let mainWindow;
const dataPath = path.join(app.getPath('userData'), 'data.json');
const filesPath = path.join(app.getPath('userData'), 'files');

// 确保文件目录存在
function ensureFilesDirectory() {
  if (!fs.existsSync(filesPath)) {
    fs.mkdirSync(filesPath, { recursive: true });
  }
}

// 初始化数据
const initData = () => ({
  projects: [],
  users: {
    admin: { username: 'admin', passwordHash: 'admin123', role: 'admin' }
  },
  settings: {
    currentUser: null
  }
});

// 确保数据文件存在
function ensureDataFile() {
  try {
    if (!fs.existsSync(dataPath)) {
      fs.writeFileSync(dataPath, JSON.stringify(initData(), null, 2));
    }
  } catch (error) {
    console.error('Error creating data file:', error);
  }
}

// 创建主窗口
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: path.join(__dirname, 'icon.png')
  });

  mainWindow.loadFile('renderer.html');

  // 开发时打开开发者工具
  // mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  ensureDataFile();
  ensureFilesDirectory();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC 处理程序
ipcMain.handle('load-data', async () => {
  try {
    const data = fs.readFileSync(dataPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading data:', error);
    return initData();
  }
});

ipcMain.handle('save-data', async (event, data) => {
  try {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    return { success: true };
  } catch (error) {
    console.error('Error saving data:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('export-data', async (event, data, format) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '导出数据',
      defaultPath: `backup_${new Date().toISOString().split('T')[0]}.${format}`,
      filters: [
        { name: format.toUpperCase(), extensions: [format] }
      ]
    });

    if (!result.canceled && result.filePath) {
      let content = '';
      if (format === 'json') {
        content = JSON.stringify(data, null, 2);
      } else if (format === 'csv') {
        content = data;
      }
      fs.writeFileSync(result.filePath, content);
      return { success: true };
    }
    return { success: false, canceled: true };
  } catch (error) {
    console.error('Error exporting data:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('import-data', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '导入数据',
      filters: [
        { name: 'JSON', extensions: ['json'] }
      ],
      properties: ['openFile']
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const data = fs.readFileSync(result.filePaths[0], 'utf8');
      return { success: true, data: JSON.parse(data) };
    }
    return { success: false, canceled: true };
  } catch (error) {
    console.error('Error importing data:', error);
    return { success: false, error: error.message };
  }
});

// 选择文件
ipcMain.handle('select-file', async (event, fileType) => {
  try {
    let filters = [];
    if (fileType === 'binary') {
      filters = [
        { name: 'Binary Files', extensions: ['bin', 'hex', 'elf', '*'] },
        { name: 'All Files', extensions: ['*'] }
      ];
    } else if (fileType === 'config') {
      filters = [
        { name: 'Config Files', extensions: ['json', 'xml', 'ini', 'conf', 'cfg', 'txt'] },
        { name: 'All Files', extensions: ['*'] }
      ];
    }

    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择文件',
      filters: filters,
      properties: ['openFile']
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      const fileName = path.basename(filePath);
      const fileBuffer = fs.readFileSync(filePath);

      // 计算MD5
      const md5 = crypto.createHash('md5').update(fileBuffer).digest('hex');

      return {
        success: true,
        fileName,
        fileSize: fileBuffer.length,
        md5,
        tempPath: filePath
      };
    }
    return { success: false, canceled: true };
  } catch (error) {
    console.error('Error selecting file:', error);
    return { success: false, error: error.message };
  }
});

// 保存文件
ipcMain.handle('save-file', async (event, sourcePath, projectId, versionId, fileType) => {
  try {
    const projectDir = path.join(filesPath, projectId.toString());
    const versionDir = path.join(projectDir, versionId.toString());

    if (!fs.existsSync(versionDir)) {
      fs.mkdirSync(versionDir, { recursive: true });
    }

    const fileName = path.basename(sourcePath);
    const destPath = path.join(versionDir, `${fileType}_${fileName}`);

    fs.copyFileSync(sourcePath, destPath);

    return {
      success: true,
      relativePath: path.relative(filesPath, destPath),
      fileName
    };
  } catch (error) {
    console.error('Error saving file:', error);
    return { success: false, error: error.message };
  }
});

// 打开文件
ipcMain.handle('open-file', async (event, relativePath) => {
  try {
    const fullPath = path.join(filesPath, relativePath);

    if (!fs.existsSync(fullPath)) {
      return { success: false, error: '文件不存在' };
    }

    const { shell } = require('electron');
    await shell.openPath(fullPath);

    return { success: true };
  } catch (error) {
    console.error('Error opening file:', error);
    return { success: false, error: error.message };
  }
});

// 删除版本文件
ipcMain.handle('delete-version-files', async (event, projectId, versionId) => {
  try {
    const versionDir = path.join(filesPath, projectId.toString(), versionId.toString());

    if (fs.existsSync(versionDir)) {
      fs.rmSync(versionDir, { recursive: true, force: true });
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting version files:', error);
    return { success: false, error: error.message };
  }
});

// 获取文件信息
ipcMain.handle('get-file-info', async (event, relativePath) => {
  try {
    const fullPath = path.join(filesPath, relativePath);

    if (!fs.existsSync(fullPath)) {
      return { success: false, error: '文件不存在' };
    }

    const stats = fs.statSync(fullPath);
    const fileName = path.basename(fullPath);

    return {
      success: true,
      fileName,
      fileSize: stats.size,
      exists: true
    };
  } catch (error) {
    console.error('Error getting file info:', error);
    return { success: false, error: error.message };
  }
});