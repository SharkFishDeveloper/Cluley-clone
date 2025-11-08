import { app, BrowserWindow, ipcMain, screen, desktopCapturer } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
createRequire(import.meta.url);
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
process.env.APP_ROOT = path.join(__dirname$1, "..");
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win = null;
function createWindow() {
  win = new BrowserWindow({
    width: 410,
    height: 300,
    transparent: true,
    frame: false,
    resizable: true,
    titleBarStyle: "hidden",
    thickFrame: true,
    backgroundColor: "#00000000",
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: true,
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs")
    }
  });
  win.setContentProtection(true);
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
ipcMain.handle("get-underlay-crop-info", async () => {
  if (!win) throw new Error("No window");
  const overlayBounds = win.getBounds();
  const display = screen.getDisplayMatching(overlayBounds);
  const scale = display.scaleFactor || 1;
  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: { width: 1, height: 1 }
  });
  const match = sources.find((s) => s.display_id === String(display.id)) || sources[0];
  const crop = {
    x: Math.round(overlayBounds.x * scale),
    y: Math.round(overlayBounds.y * scale),
    width: Math.round(overlayBounds.width * scale),
    height: Math.round(overlayBounds.height * scale)
  };
  return { sourceId: match.id, crop };
});
ipcMain.handle(
  "resize-window",
  (_evt, { w, h }) => {
    if (!win) return;
    const minW = 100;
    const minH = 100;
    const W = Math.max(minW, Math.floor(Number(w) || 0));
    const H = Math.max(minH, Math.floor(Number(h) || 0));
    win.setSize(W, H, true);
  }
);
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
