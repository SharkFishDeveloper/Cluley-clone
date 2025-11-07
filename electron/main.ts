import { app, BrowserWindow } from 'electron'
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
    thickFrame: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,                        // keep overlay above other windows
    skipTaskbar: true,                        // optional: hide from taskbar
    focusable: true,                          // keep focusable; set false if you want clicks to pass through
    icon: path.join(process.env.VITE_PUBLIC!, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  // ✨ Make the window invisible to screen recording/sharing
  // NOTE: do this after creation; don't put `contentProtection` in the constructor.
  win.setContentProtection(true)

  // Optional helpers (uncomment if you like this behavior):
  // win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }) // show over full-screen apps
  // win.setAlwaysOnTop(true, 'screen-saver') // stronger on-top level on some systems

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
