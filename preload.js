const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Expose safe APIs to the renderer here
  getVersion: () => process.versions.electron,
});
