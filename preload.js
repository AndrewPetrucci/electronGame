const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getVersion: () => process.versions.electron,
  loadStrudelFile: () => ipcRenderer.invoke('load-strudel-file'),
});
