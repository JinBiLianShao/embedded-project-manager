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

  // 设备 / 批次 / 问题单：增量操作，只回传受影响的项目
  upsertDevices: (projectId, devices) => ipcRenderer.invoke('devices:upsert', projectId, devices),
  removeDevices: (projectId, deviceIds) => ipcRenderer.invoke('devices:remove', projectId, deviceIds),
  addDeviceTestRecord: (projectId, deviceId, record) =>
    ipcRenderer.invoke('devices:add-test-record', projectId, deviceId, record),
  bulkAddDeviceTestRecords: (projectId, rows) =>
    ipcRenderer.invoke('devices:bulk-add-test-records', projectId, rows),
  upsertBatches: (projectId, batches) => ipcRenderer.invoke('batches:upsert', projectId, batches),
  upsertIssues: (projectId, issues) => ipcRenderer.invoke('issues:upsert', projectId, issues),
  removeIssue: (projectId, issueId) => ipcRenderer.invoke('issues:remove', projectId, issueId),

  exportData: (format) => ipcRenderer.invoke('data:export', format),
  importData: () => ipcRenderer.invoke('data:import'),
  applyImport: (data, mode) => ipcRenderer.invoke('data:import-apply', data, mode),

  listBackups: () => ipcRenderer.invoke('backups:list'),
  restoreBackup: (name) => ipcRenderer.invoke('backups:restore', name),
});
