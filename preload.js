const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  loadData: () => ipcRenderer.invoke('load-data'),
  saveData: (data) => ipcRenderer.invoke('save-data', data),
  saveDataPartial: (updates) => ipcRenderer.invoke('save-data-partial', updates),
  exportData: (data, format) => ipcRenderer.invoke('export-data', data, format),
  importData: () => ipcRenderer.invoke('import-data'),

  // 确认对话框 API
  showConfirmDialog: (options) => ipcRenderer.invoke('show-confirm-dialog', options),

  // 文件操作API
  selectFile: (fileType) => ipcRenderer.invoke('select-file', fileType),
  saveFile: (sourcePath, projectId, versionId, fileType) =>
      ipcRenderer.invoke('save-file', sourcePath, projectId, versionId, fileType),
  openFile: (relativePath) => ipcRenderer.invoke('open-file', relativePath),
  openFileFolder: (relativePath) => ipcRenderer.invoke('open-file-folder', relativePath),
  deleteVersionFiles: (projectId, versionId) =>
      ipcRenderer.invoke('delete-version-files', projectId, versionId),
  getFileInfo: (relativePath) => ipcRenderer.invoke('get-file-info', relativePath)
});