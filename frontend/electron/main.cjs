const { app, BrowserWindow, ipcMain, globalShortcut } = require(electron);
const path = require(path);
const fs = require(fs);

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    center: true,
    fullscreen: false,
    kiosk: false,
    frame: true, // Show standard window frame so user can resize, minimize and maximize easily
    autoHideMenuBar: true,
    backgroundColor: #202225,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, preload.cjs),
      devTools: true
    }
  });

  // Window state notification
  const sendWindowState = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send(window:stateChanged, {
      isFullScreen: mainWindow.isFullScreen(),
      isMaximized: mainWindow.isMaximized(),
      isMinimized: mainWindow.isMinimized()
    });
  };

  mainWindow.on(enter-full-screen, sendWindowState);
  mainWindow.on(leave-full-screen, sendWindowState);
  mainWindow.on(maximize, sendWindowState);
  mainWindow.on(unmaximize, sendWindowState);

  // Prevent context menu to maintain kiosk touch clean UX
  mainWindow.webContents.on(context-menu, (e) => {
    e.preventDefault();
  });

  // Loading strategy: prefer built dist/index.html if exists, unless VITE_DEV_SERVER_URL is explicitly set
  const distPath = path.join(__dirname, ../dist/index.html);
  const useDevServer = process.argv.includes(--dev) || process.env.USE_DEV_SERVER === true;

  if (useDevServer) {
    const devUrl = http://localhost:5173;
    mainWindow.loadURL(devUrl).catch(() => {
      console.log([Electron] Servidor dev no disponible en 5173, cargando dist/index.html local...);
      if (fs.existsSync(distPath)) {
        mainWindow.loadFile(distPath);
      }
    });
  } else {
    if (fs.existsSync(distPath)) {
      mainWindow.loadFile(distPath);
    } else {
      mainWindow.loadURL(http://localhost:5173);
    }
  }

  // Keyboard shortcuts: F11 for Fullscreen, Escape to exit fullscreen, F12 for DevTools
  mainWindow.webContents.on(before-input-event, (event, input) => {
    if (input.type === keyDown) {
      if (input.key === F11) {
        mainWindow.setFullScreen(!mainWindow.isFullScreen());
        event.preventDefault();
      } else if (input.key === Escape && mainWindow.isFullScreen()) {
        mainWindow.setFullScreen(false);
        event.preventDefault();
      } else if (input.key === F12 || (input.control && input.shift && input.key === I)) {
        mainWindow.webContents.toggleDevTools();
        event.preventDefault();
      } else if (input.key === F5 || (input.control && input.key === r)) {
        mainWindow.reload();
        event.preventDefault();
      }
    }
  });

  mainWindow.on(closed, () => {
    mainWindow = null;
  });
}

// IPC Handlers for UI Window Controls
ipcMain.handle(window:minimize, () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle(window:maximize, () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

ipcMain.handle(window:toggleFullscreen, () => {
  if (!mainWindow) return;
  mainWindow.setFullScreen(!mainWindow.isFullScreen());
  return mainWindow.isFullScreen();
});

ipcMain.handle(window:setFullscreen, (_event, flag) => {
  if (!mainWindow) return;
  mainWindow.setFullScreen(Boolean(flag));
  return mainWindow.isFullScreen();
});

ipcMain.handle(window:setWindowed, () => {
  if (!mainWindow) return;
  if (mainWindow.isFullScreen()) {
    mainWindow.setFullScreen(false);
  }
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  }
  mainWindow.setSize(1400, 900);
  mainWindow.center();
  return false;
});

ipcMain.handle(window:close, () => {
  if (mainWindow) mainWindow.close();
});

app.whenReady().then(() => {
  createWindow();

  app.on(activate, () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on(window-all-closed, () => {
  if (process.platform !== darwin) {
    app.quit();
  }
});
