import { app, BrowserWindow, ipcMain, desktopCapturer, screen } from "electron";
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
process.env.APP_ROOT = path.join(__dirname, '..')
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null = null

function createWindow() {
  win = new BrowserWindow({
    width: 500,
    height: 300,
    transparent: true,
    frame: false,
    resizable: true,
    titleBarStyle: "hidden",
    thickFrame: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,                        // keep overlay above other windows
    skipTaskbar: true,                        // optional: hide from taskbar
    focusable: true,                          // keep focusable; set false if you 
    icon: path.join(process.env.VITE_PUBLIC!, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  win.setContentProtection(true)

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
// ---------------------------------------------------------------------

// ——— Utils ———
// 2
// function pickScreenSourceForDisplayId(
//   sources: Electron.DesktopCapturerSource[],
//   displayId: number
// ) {
//   // Electron varies: sometimes display_id is "123456789", sometimes id like "screen:123456789"
//   const strId = String(displayId);
//   return (
//     sources.find((s) => s.display_id === strId) ||
//     sources.find((s) => s.id.endsWith(`:${strId}`)) ||
//     sources[0]
//   );
// }

// // ——— IPC: Capture the part of the screen to the LEFT of the overlay window ———
// ipcMain.handle("capture-left-of-overlay", async () => {
//   if (!win) return { ok: false, error: "no-window" };

//   const overlay = win.getBounds(); // overlay window bounds in DIP (logical pixels)
//   const display = screen.getDisplayMatching(overlay); // display containing overlay

//   const scale = display.scaleFactor;
//   const dispBounds = display.bounds; // {x,y,width,height} in DIP

//   // Ask desktopCapturer for a full-resolution thumbnail of this display
//   const sources = await desktopCapturer.getSources({
//     types: ["screen"],
//     thumbnailSize: {
//       width: Math.floor(display.size.width * scale),
//       height: Math.floor(display.size.height * scale),
//     },
//   });

//   const source = pickScreenSourceForDisplayId(sources, display.id);
//   if (!source?.thumbnail) return { ok: false, error: "no-thumbnail" };

//   const nativeImg = source.thumbnail; // NativeImage at device pixels

//   // Convert overlay bounds to device pixels relative to the display’s origin
//   const overlayLeftPx = Math.max(0, Math.round((overlay.x - dispBounds.x) * scale));
//   const fullH = Math.round(display.size.height * scale);

//   // Crop: from x=0 to x=overlayLeftPx (the area to the LEFT of the overlay)
//   const leftWidth = Math.max(0, Math.min(overlayLeftPx, nativeImg.getSize().width));
//   const cropRect = { x: 0, y: 0, width: leftWidth, height: fullH };

//   const leftImage =
//     leftWidth > 0 ? nativeImg.crop(cropRect) : nativeImg.crop({ x: 0, y: 0, width: 1, height: 1 });

//   const dataUrl = leftImage.toDataURL(); // PNG data URL
//   return { ok: true, dataUrl, width: leftWidth, height: fullH, scale };
// });

// // (Optional) expose overlay bounds if you want them in the renderer
// ipcMain.handle("get-overlay-bounds", () => win?.getBounds() ?? null);

// IPC: return current window bounds in screen coordinates (CSS pixels)
ipcMain.handle("get-underlay-crop-info", async (event) => {
  const overlayBounds = win.getBounds(); // DIP (logical) coords
  const display = screen.getDisplayMatching(overlayBounds);
  const scale = display.scaleFactor || 1;

  // Find the screen source that matches this display
  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    // tiny thumbnail is enough to populate display_id
    thumbnailSize: { width: 1, height: 1 }
  });

  // In modern Electron: source.display_id matches display.id
  const match = sources.find(s => s.display_id === String(display.id)) || sources[0];

  const crop = {
    x: Math.round(overlayBounds.x * scale),
    y: Math.round(overlayBounds.y * scale),
    width: Math.round(overlayBounds.width * scale),
    height: Math.round(overlayBounds.height * scale),
  };

  return { sourceId: match.id, crop };
});