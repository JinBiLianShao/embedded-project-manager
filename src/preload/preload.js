const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadData: () => ipcRenderer.invoke('data:load'),
  saveData: (patch) => ipcRenderer.invoke('data:save', patch),

  login: (username, password) => ipcRenderer.invoke('auth:login', username, password),
  logout: () => ipcRenderer.invoke('auth:logout'),
  currentUser: () => ipcRenderer.invoke('auth:current'),
  changePassword: (oldPassword, newPassword) =>
    ipcRenderer.invoke('auth:change-password', oldPassword, newPassword),

  listUsers: () => ipcRenderer.invoke('users:list'),
  createUser: (payload) => ipcRenderer.invoke('users:create', payload),
  updateUser: (payload) => ipcRenderer.invoke('users:update', payload),
  deleteUser: (username) => ipcRenderer.invoke('users:delete', username),

  selectFile: (fileType) => ipcRenderer.invoke('files:select', fileType),
  saveFile: (sourcePath, projectId, versionId, fileType) =>
    ipcRenderer.invoke('files:save', sourcePath, projectId, versionId, fileType),
  openFile: (relativePath) => ipcRenderer.invoke('files:open', relativePath),
  revealFile: (relativePath) => ipcRenderer.invoke('files:reveal', relativePath),
  deleteVersionFiles: (projectId, versionId) =>
    ipcRenderer.invoke('files:delete-version', projectId, versionId),
  deleteProjectFiles: (projectId) => ipcRenderer.invoke('files:delete-project', projectId),
  fileInfo: (relativePath) => ipcRenderer.invoke('files:info', relativePath),

  exportData: (format) => ipcRenderer.invoke('data:export', format),
  importData: () => ipcRenderer.invoke('data:import'),
  applyImport: (data) => ipcRenderer.invoke('data:import-apply', data),

  listBackups: () => ipcRenderer.invoke('backups:list'),
  restoreBackup: (name) => ipcRenderer.invoke('backups:restore', name),
});
