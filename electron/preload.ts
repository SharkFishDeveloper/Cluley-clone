import { contextBridge, ipcRenderer } from "electron";

/**
 * Consolidated bridge for renderer.
 * Usage:
 *   window.electronAPI.getUnderlayCropInfo()
 *   window.electronAPI.resizeWindow(w, h)
 *   window.electronAPI.toggleDock()
 */
contextBridge.exposeInMainWorld("electronAPI", {
  getUnderlayCropInfo: () => ipcRenderer.invoke("get-underlay-crop-info"),
  resizeWindow: (w, h) => ipcRenderer.invoke("resize-window", { w, h }),
  toggleDock: () => ipcRenderer.invoke("dock:toggle"),
});

/**
 * Optional thin IPC helpers.
 */
contextBridge.exposeInMainWorld("ipc", {
  on: (channel, listener) => ipcRenderer.on(channel, (_e, ...args) => listener(...args)),
  off: (channel, listener) => ipcRenderer.off(channel, listener),
  send: (channel, ...args) => ipcRenderer.send(channel, ...args),
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
});
