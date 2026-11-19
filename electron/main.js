const { app, BrowserWindow, shell } = require('electron')
const path = require('path')

const APP_URL = process.env.ELECTRON_START_URL || 'http://localhost:3000'

function crearVentana() {
  const win = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  win.loadURL(APP_URL)

  win.once('ready-to-show', () => {
    win.show()
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })
}

app.whenReady().then(() => {
  crearVentana()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      crearVentana()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})