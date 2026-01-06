const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  loadData: () => ipcRenderer.invoke('load-data'),
  saveData: (data) => ipcRenderer.invoke('save-data', data),
  exportData: (data, format) => ipcRenderer.invoke('export-data', data, format),
  importData: () => ipcRenderer.invoke('import-data')
});
