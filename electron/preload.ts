import { contextBridge, ipcRenderer } from "electron";

/**
 * Single, consolidated bridge.
 * You call these in the renderer as:
 *   window.electronAPI.getUnderlayCropInfo()
 *   window.electronAPI.resizeWindow(w, h)
 */
contextBridge.exposeInMainWorld("electronAPI", {
  getUnderlayCropInfo: () => ipcRenderer.invoke("get-underlay-crop-info"),
  resizeWindow: (w: number, h: number) =>
    ipcRenderer.invoke("resize-window", { w, h }),
});

/**
 * (Optional) thin IPC helpers if you need them elsewhere.
 * Not required for your current code, but kept tidy and non-duplicated.
 */
contextBridge.exposeInMainWorld("ipc", {
  on: (channel: string, listener: (...args: any[]) => void) =>
    ipcRenderer.on(channel, (_e, ...args) => listener(...args)),
  off: (channel: string, listener: (...args: any[]) => void) =>
    ipcRenderer.off(channel, listener as any),
  send: (channel: string, ...args: any[]) => ipcRenderer.send(channel, ...args),
  invoke: (channel: string, ...args: any[]) =>
    ipcRenderer.invoke(channel, ...args),
});
