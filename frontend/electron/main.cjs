const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

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
    frame: false, // Frameless window to avoid duplicate OS title bar; uses Discord-style WindowBar
    autoHideMenuBar: true,
    backgroundColor: "#202225",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.cjs"),
      devTools: process.argv.includes("--dev") || process.env.NODE_ENV === "development"
    }
  });

  // Security Hardening: Prevent unvetted external navigation and child windows
  mainWindow.webContents.on("will-navigate", (event, navigationUrl) => {
    try {
      const parsedUrl = new URL(navigationUrl);
      if (parsedUrl.origin !== "http://localhost:5173" && parsedUrl.protocol !== "file:") {
        console.warn(`[Electron Sandbox] Navegación bloqueada a origen no autorizado: ${navigationUrl}`);
        event.preventDefault();
      }
    } catch {
      event.preventDefault();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(() => {
    console.warn("[Electron Sandbox] Apertura de nueva ventana emergente denegada.");
    return { action: "deny" };
  });

  // Window state notification
  const sendWindowState = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send("window:stateChanged", {
      isFullScreen: mainWindow.isFullScreen(),
      isMaximized: mainWindow.isMaximized(),
      isMinimized: mainWindow.isMinimized()
    });
  };

  mainWindow.on("enter-full-screen", sendWindowState);
  mainWindow.on("leave-full-screen", sendWindowState);
  mainWindow.on("maximize", sendWindowState);
  mainWindow.on("unmaximize", sendWindowState);

  // Prevent context menu to maintain kiosk touch clean UX
  mainWindow.webContents.on("context-menu", (e) => {
    e.preventDefault();
  });

  // Loading strategy: search in candidate paths for built dist/index.html
  const candidatePaths = [
    path.join(__dirname, "../dist/index.html"),
    path.join(__dirname, "dist/index.html"),
    path.join(app.getAppPath(), "dist/index.html"),
    path.join(app.getAppPath(), "frontend/dist/index.html"),
    path.join(process.cwd(), "dist/index.html"),
    path.join(process.cwd(), "frontend/dist/index.html")
  ];
  const distPath = candidatePaths.find(p => fs.existsSync(p));
  const useDevServer = process.argv.includes("--dev") || process.env.USE_DEV_SERVER === "true";

  if (useDevServer) {
    const devUrl = "http://localhost:5173";
    mainWindow.loadURL(devUrl).catch(() => {
      console.log("[Electron] Servidor dev no disponible en 5173, cargando dist/index.html local...");
      if (distPath) {
        mainWindow.loadFile(distPath);
      }
    });
  } else {
    if (distPath) {
      mainWindow.loadFile(distPath);
    } else {
      console.warn("[Electron] dist/index.html no encontrado. Intentando conectar a http://localhost:5173...");
      mainWindow.loadURL("http://localhost:5173").catch((err) => {
        console.error("[Electron] Error conectando a frontend:", err.message);
        mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
          <!DOCTYPE html>
          <html lang="es">
          <head><meta charset="UTF-8"><title>Cajero ATM - Frontend no Compilado</title></head>
          <body style="background:#202225;color:#dcddde;font-family:system-ui,-apple-system,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;padding:24px;box-sizing:border-box;text-align:center;">
            <div style="background:#2f3136;border:1px solid #ed4245;border-radius:12px;padding:32px;max-width:600px;box-shadow:0 8px 24px rgba(0,0,0,0.5);">
              <h2 style="color:#ed4245;margin-top:0;">⚠️ Frontend no Compilado</h2>
              <p style="font-size:15px;line-height:1.6;">No se encontró el paquete de producción <code>frontend/dist/index.html</code> ni un servidor dev activo en <code>http://localhost:5173</code>.</p>
              <p style="font-size:14px;color:#96989d;">Por favor ejecute en la terminal:</p>
              <pre style="background:#202225;color:#57f287;padding:12px 16px;border-radius:6px;font-size:14px;overflow-x:auto;">cd frontend && npm install --include=dev && npm run build</pre>
              <p style="font-size:13px;color:#72767d;margin-bottom:0;">Luego vuelva a ejecutar <code>./instalacion/run_debian.sh</code>.</p>
            </div>
          </body>
          </html>
        `)}`);
      });
    }
  }

  // Keyboard shortcuts: F11 for Fullscreen, Escape to exit fullscreen, F12 for DevTools (only in dev)
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.type === "keyDown") {
      if (input.key === "F11") {
        mainWindow.setFullScreen(!mainWindow.isFullScreen());
        event.preventDefault();
      } else if (input.key === "Escape" && mainWindow.isFullScreen()) {
        mainWindow.setFullScreen(false);
        event.preventDefault();
      } else if (input.key === "F12" || (input.control && input.shift && input.key === "I")) {
        if (useDevServer) {
          mainWindow.webContents.toggleDevTools();
        }
        event.preventDefault();
      } else if (input.key === "F5" || (input.control && input.key.toLowerCase() === "r")) {
        if (useDevServer) {
          mainWindow.reload();
        }
        event.preventDefault();
      } else if (input.alt && input.key === "F4") {
        // Prevent accidental kiosk crash via Alt+F4
        event.preventDefault();
      }
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// IPC Handlers for UI Window Controls
ipcMain.handle("window:minimize", () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle("window:maximize", () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

ipcMain.handle("window:toggleFullscreen", () => {
  if (!mainWindow) return;
  mainWindow.setFullScreen(!mainWindow.isFullScreen());
  return mainWindow.isFullScreen();
});

ipcMain.handle("window:setFullscreen", (_event, flag) => {
  if (!mainWindow) return;
  mainWindow.setFullScreen(Boolean(flag));
  return mainWindow.isFullScreen();
});

ipcMain.handle("window:setWindowed", () => {
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

ipcMain.handle("window:close", () => {
  if (mainWindow) mainWindow.close();
});

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
