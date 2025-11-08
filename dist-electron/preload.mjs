"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  getUnderlayCropInfo: () => electron.ipcRenderer.invoke("get-underlay-crop-info"),
  resizeWindow: (w, h) => electron.ipcRenderer.invoke("resize-window", { w, h })
});
electron.contextBridge.exposeInMainWorld("ipc", {
  on: (channel, listener) => electron.ipcRenderer.on(channel, (_e, ...args) => listener(...args)),
  off: (channel, listener) => electron.ipcRenderer.off(channel, listener),
  send: (channel, ...args) => electron.ipcRenderer.send(channel, ...args),
  invoke: (channel, ...args) => electron.ipcRenderer.invoke(channel, ...args)
});
