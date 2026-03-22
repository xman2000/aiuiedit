import { app, BrowserWindow, shell } from 'electron'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
// import { updateElectronApp } from 'electron-updater'
import { setupIPC } from './ipc/handlers.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Enable auto-updater (disabled for dev)
// updateElectronApp()

export let mainWindow: BrowserWindow | null = null

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

function createWindow() {
  // Determine preload path based on environment
  const preloadPath = process.env.VITE_DEV_SERVER_URL
    ? join(__dirname, '../preload/index.cjs')  // Dev mode
    : join(__dirname, '../preload/index.cjs')  // Production

  console.log('Loading preload script from:', preloadPath)
  console.log('__dirname:', __dirname)

  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1200,
    minHeight: 800,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    show: false
  })

  // Load the app
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../../dist/index.html'))
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

// App lifecycle
app.whenReady().then(() => {
  console.log('App ready, setting up IPC...')
  setupIPC()
  console.log('IPC setup complete, creating window...')
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Security: Prevent new window creation
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(() => {
    return { action: 'deny' }
  })
})
