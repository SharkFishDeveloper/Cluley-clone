import { app, globalShortcut, BrowserWindow, Menu, ipcMain, screen, desktopCapturer } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
process.env.APP_ROOT = path.join(__dirname$1, "..");
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win = null;
let lastOnscreenBounds = null;
let isHiddenOffscreen = false;
function getWorkAreaFor(w) {
  const b = w.getBounds();
  const centerPoint = { x: b.x + Math.floor(b.width / 2), y: b.y + Math.floor(b.height / 2) };
  const disp = screen.getDisplayNearestPoint(centerPoint);
  return disp.workArea;
}
function animateTo(w, targetX, targetY, duration = 220) {
  return new Promise((resolve) => {
    const start = Date.now();
    const startBounds = w.getBounds();
    const sx = startBounds.x, sy = startBounds.y;
    const dx = targetX - sx, dy = targetY - sy;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const e = 1 - Math.pow(1 - t, 3);
      const nx = Math.round(sx + dx * e);
      const ny = Math.round(sy + dy * e);
      w.setBounds({ x: nx, y: ny, width: startBounds.width, height: startBounds.height });
      if (t < 1) setTimeout(tick, 1e3 / 60);
      else resolve();
    };
    tick();
  });
}
async function toggleDock(w) {
  const wa = getWorkAreaFor(w);
  const b = w.getBounds();
  if (!isHiddenOffscreen) {
    lastOnscreenBounds = { ...b };
    const offX = wa.x + wa.width + 20;
    try {
      w.setSkipTaskbar(true);
    } catch {
    }
    try {
      w.setFocusable(false);
    } catch {
    }
    await animateTo(w, offX, b.y);
    isHiddenOffscreen = true;
  } else {
    const targetWidth = (lastOnscreenBounds == null ? void 0 : lastOnscreenBounds.width) ?? b.width;
    const margin = 16;
    const onX = Math.min(
      (lastOnscreenBounds == null ? void 0 : lastOnscreenBounds.x) ?? wa.x + wa.width - targetWidth - margin,
      wa.x + wa.width - targetWidth - margin
    );
    const onY = (lastOnscreenBounds == null ? void 0 : lastOnscreenBounds.y) ?? Math.max(wa.y, Math.min(b.y, wa.y + wa.height - b.height));
    await animateTo(w, onX, onY);
    isHiddenOffscreen = false;
    try {
      w.setSkipTaskbar(true);
    } catch {
    }
    try {
      w.setFocusable(true);
    } catch {
    }
    w.showInactive();
    try {
      w.setSkipTaskbar(true);
    } catch {
    }
  }
}
function createWindow() {
  Menu.setApplicationMenu(null);
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
    // ← never show in taskbar
    focusable: true,
    show: true,
    icon: path.join(process.env.VITE_PUBLIC, "notion.jpg"),
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.setSkipTaskbar(true);
  win.on("show", () => win == null ? void 0 : win.setSkipTaskbar(true));
  win.on("focus", () => win == null ? void 0 : win.setSkipTaskbar(true));
  win.on("blur", () => win == null ? void 0 : win.setSkipTaskbar(true));
  win.on("restore", () => win == null ? void 0 : win.setSkipTaskbar(true));
  win.setContentProtection(true);
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
  ipcMain.handle("dock:toggle", async () => {
    if (win) await toggleDock(win);
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
  ipcMain.handle("resize-window", (_evt, { w, h }) => {
    if (!win) return;
    const minW = 100;
    const minH = 100;
    const W = Math.max(minW, Math.floor(Number(w) || 0));
    const H = Math.max(minH, Math.floor(Number(h) || 0));
    win.setSize(W, H, true);
  });
}
app.whenReady().then(() => {
  createWindow();
  try {
    globalShortcut.register("Control+Shift+Space", () => {
      if (win) toggleDock(win);
    });
  } catch {
  }
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
