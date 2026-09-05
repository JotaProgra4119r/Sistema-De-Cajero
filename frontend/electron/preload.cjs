const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  minimize: () => ipcRenderer.invoke("window:minimize"),
  maximize: () => ipcRenderer.invoke("window:maximize"),
  toggleFullscreen: () => ipcRenderer.invoke("window:toggleFullscreen"),
  setFullscreen: (flag) => ipcRenderer.invoke("window:setFullscreen", flag),
  setWindowed: () => ipcRenderer.invoke("window:setWindowed"),
  close: () => ipcRenderer.invoke("window:close"),
  isElectron: true,
  onWindowStateChange: (callback) => {
    ipcRenderer.on("window:stateChanged", (_event, state) => callback(state));
  }
});
