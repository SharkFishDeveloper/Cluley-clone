import { app, BrowserWindow, ipcMain, desktopCapturer, screen, globalShortcut, Menu } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
process.env.APP_ROOT = path.join(__dirname, "..");
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let win: BrowserWindow | null = null;

// --- Dock/Hide state ---
let lastOnscreenBounds: Electron.Rectangle | null = null;
let isHiddenOffscreen = false;

// --- Helpers ---
function getWorkAreaFor(w: BrowserWindow) {
  const b = w.getBounds();
  const centerPoint = { x: b.x + Math.floor(b.width / 2), y: b.y + Math.floor(b.height / 2) };
  const disp = screen.getDisplayNearestPoint(centerPoint);
  return disp.workArea; // { x, y, width, height }
}

function animateTo(w: BrowserWindow, targetX: number, targetY: number, duration = 220) {
  return new Promise<void>((resolve) => {
    const start = Date.now();
    const startBounds = w.getBounds();
    const sx = startBounds.x, sy = startBounds.y;
    const dx = targetX - sx, dy = targetY - sy;

    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const e = 1 - Math.pow(1 - t, 3); // easeOutCubic
      const nx = Math.round(sx + dx * e);
      const ny = Math.round(sy + dy * e);
      w.setBounds({ x: nx, y: ny, width: startBounds.width, height: startBounds.height });
      if (t < 1) setTimeout(tick, 1000 / 60);
      else resolve();
    };
    tick();
  });
}

async function toggleDock(w: BrowserWindow) {
  const wa = getWorkAreaFor(w);
  const b = w.getBounds();

  if (!isHiddenOffscreen) {
    // Move just beyond right edge
    lastOnscreenBounds = { ...b };
    const offX = wa.x + wa.width + 20;

    try { w.setSkipTaskbar(true); } catch{
//
}
    try { w.setFocusable(false); } catch{
//
}
    await animateTo(w, offX, b.y);
    isHiddenOffscreen = true;
  } else {
    // Return to remembered spot (clamped)
    const targetWidth = (lastOnscreenBounds?.width ?? b.width);
    const margin = 16;
    const onX = Math.min(
      (lastOnscreenBounds?.x ?? (wa.x + wa.width - targetWidth - margin)),
      wa.x + wa.width - targetWidth - margin
    );
    const onY = lastOnscreenBounds?.y ?? Math.max(wa.y, Math.min(b.y, wa.y + wa.height - b.height));

    await animateTo(w, onX, onY);
    isHiddenOffscreen = false;

    // Never appear in taskbar
    try { w.setSkipTaskbar(true); } catch{
//
}
    try { w.setFocusable(true); } catch{
//
}

    // Show without claiming taskbar; reassert skipTaskbar defensively
    w.showInactive();
    try { w.setSkipTaskbar(true); } catch{
//
}
  }
}

function createWindow() {
  // Hide any default app menu (prevents accidental reveals)
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
    skipTaskbar: true,       // ← never show in taskbar
    focusable: true,
    show: true,
    icon: path.join(process.env.VITE_PUBLIC!, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Extra defenses so it *never* lands in taskbar
  win.setSkipTaskbar(true);
  win.on("show",  () => win?.setSkipTaskbar(true));
  win.on("focus", () => win?.setSkipTaskbar(true));
  win.on("blur",  () => win?.setSkipTaskbar(true));
  win.on("restore", () => win?.setSkipTaskbar(true));

  // Hide in screen recordings & screenshots (OS-level protection)
  win.setContentProtection(true);

  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }

  // IPC
  ipcMain.handle("dock:toggle", async () => { if (win) await toggleDock(win); });

  ipcMain.handle("get-underlay-crop-info", async () => {
    if (!win) throw new Error("No window");
    const overlayBounds = win.getBounds();
    const display = screen.getDisplayMatching(overlayBounds);
    const scale = display.scaleFactor || 1;

    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width: 1, height: 1 },
    });

    const match =
      sources.find((s) => s.display_id === String(display.id)) || sources[0];

    const crop = {
      x: Math.round(overlayBounds.x * scale),
      y: Math.round(overlayBounds.y * scale),
      width: Math.round(overlayBounds.width * scale),
      height: Math.round(overlayBounds.height * scale),
    };

    return { sourceId: match.id, crop };
  });

  ipcMain.handle("resize-window", (_evt, { w, h }: { w: number; h: number }) => {
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

  // Optional: global hotkey to toggle (Ctrl+Shift+Space)
  try {
    globalShortcut.register("Control+Shift+Space", () => { if (win) toggleDock(win); });
  } catch{
//
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
