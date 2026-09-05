const { app, BrowserWindow } = require("electron");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1920,
    height: 1080,
    kiosk: false, // Set true for strict kiosk lock
    fullscreen: true,
    frame: false, // Removes standard browser window title bar
    autoHideMenuBar: true,
    backgroundColor: "#202225",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      devTools: true, // Keep accessible for testing
    },
  });

  // Remove right click menu to prevent browser artifacts
  win.webContents.on("context-menu", (e) => {
    e.preventDefault();
  });

  const devUrl = "http://localhost:5173";
  const isDev = process.env.NODE_ENV !== "production";

  if (isDev) {
    win.loadURL(devUrl).catch(() => {
      // If dev server not yet up, load built index.html
      win.loadFile(path.join(__dirname, "../dist/index.html"));
    });
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
