import React, { useState, useEffect } from "react";
import { Maximize2, Minimize2, Monitor, Square, Minus, X, Tv, Sun, Moon } from "lucide-react";

declare global {
  interface Window {
    electronAPI?: {
      minimize: () => Promise<void>;
      maximize: () => Promise<void>;
      toggleFullscreen: () => Promise<boolean>;
      setFullscreen: (flag: boolean) => Promise<boolean>;
      setWindowed: (width?: number, height?: number) => Promise<boolean>;
      setResolution?: (width: number, height: number) => Promise<any>;
      close: () => Promise<void>;
      isElectron: boolean;
      onWindowStateChange: (cb: (state: any) => void) => void;
    };
  }
}

export const WindowBar: React.FC = () => {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [windowDimensions, setWindowDimensions] = useState<{ w: number; h: number }>({
    w: typeof window !== "undefined" ? window.innerWidth : 1280,
    h: typeof window !== "undefined" ? window.innerHeight : 720,
  });
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("atm_theme");
    return saved === "light" ? "light" : "dark";
  });

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    }
  }, [theme]);

  const handleToggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("atm_theme", next);
  };

  useEffect(() => {
    // Listen to Electron state changes
    if (window.electronAPI?.onWindowStateChange) {
      window.electronAPI.onWindowStateChange((state: any) => {
        setIsFullscreen(Boolean(state.isFullScreen));
      });
    }

    // Also listen to browser fullscreen changes and resize
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    const onResize = () => {
      setWindowDimensions({ w: window.innerWidth, h: window.innerHeight });
    };

    document.addEventListener("fullscreenchange", onFsChange);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const handleToggleFullscreen = async () => {
    if (window.electronAPI) {
      const fs = await window.electronAPI.toggleFullscreen();
      setIsFullscreen(fs);
    } else {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen().catch(() => {});
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  const handleSetWindowed = async (width: number = 1280, height: number = 720) => {
    if (window.electronAPI) {
      await window.electronAPI.setWindowed(width, height);
      setIsFullscreen(false);
    } else {
      if (document.fullscreenElement) {
        await document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  const handleMinimize = async () => {
    if (window.electronAPI) {
      await window.electronAPI.minimize();
    }
  };

  const handleMaximize = async () => {
    if (window.electronAPI) {
      await window.electronAPI.maximize();
    }
  };

  const handleClose = async () => {
    if (window.electronAPI) {
      await window.electronAPI.close();
    } else {
      window.close();
    }
  };

  return (
    <header
      style={{ WebkitAppRegion: "drag" } as any}
      className="w-full bg-[var(--atm-header-bg)] border-b border-discord-hover px-4 py-2 flex items-center justify-between text-xs select-none z-50 h-9 transition-colors"
    >
      {/* Brand / Mode info */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-discord-green" />
          <span className="font-black text-discord-blurple uppercase tracking-wider">
            ATM KIOSK G&amp;T
          </span>
        </div>
        <span className="text-discord-muted">|</span>
        <span className="text-discord-muted flex items-center gap-1.5">
          {isFullscreen ? (
            <>
              <Tv className="w-3.5 h-3.5 text-discord-amber" />
              <span className="text-discord-amber font-medium">
                Pantalla Completa ({windowDimensions.w}x{windowDimensions.h})
              </span>
            </>
          ) : (
            <>
              <Monitor className="w-3.5 h-3.5 text-discord-blurple" />
              <span className="text-discord-textNormal font-medium">
                Modo Ventana ({windowDimensions.w}x{windowDimensions.h})
              </span>
            </>
          )}
        </span>
      </div>

      {/* Mode Switchers and Window Controls (no-drag) */}
      <div style={{ WebkitAppRegion: "no-drag" } as any} className="flex items-center gap-2">
        {/* Toggle Modo Claro / Modo Oscuro */}
        <button
          type="button"
          onClick={handleToggleTheme}
          title={theme === "dark" ? "Cambiar a Modo Claro" : "Cambiar a Modo Oscuro"}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-discord-sidebar hover:bg-discord-hover text-discord-textNormal border border-discord-hover transition-all"
        >
          {theme === "dark" ? (
            <>
              <Sun className="w-3.5 h-3.5 text-discord-amber" />
              <span className="hidden sm:inline">Modo Claro</span>
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5 text-discord-blurple" />
              <span className="hidden sm:inline">Modo Oscuro</span>
            </>
          )}
        </button>

        {/* Switch to Windowed Mode (720p) */}
        <button
          type="button"
          onClick={() => handleSetWindowed(1280, 720)}
          title="Cambiar a Modo Ventana 720p (1280x720)"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-all ${
            !isFullscreen
              ? "bg-discord-blurple text-white"
              : "bg-discord-sidebar text-discord-textNormal hover:bg-discord-hover border border-discord-hover"
          }`}
        >
          <Monitor className="w-3 h-3" />
          <span>720p / Ventana</span>
        </button>

        {/* Switch to Fullscreen Mode */}
        <button
          type="button"
          onClick={handleToggleFullscreen}
          title="Cambiar a Pantalla Completa (F11)"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-all ${
            isFullscreen
              ? "bg-discord-blurple text-white"
              : "bg-discord-sidebar text-discord-textNormal hover:bg-discord-hover border border-discord-hover"
          }`}
        >
          {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          <span>{isFullscreen ? "Salir Completa" : "Pantalla Completa"}</span>
        </button>

        {/* Window Actions */}
        <div className="flex items-center ml-2 border-l border-discord-hover pl-2 gap-1">
          <button
            type="button"
            onClick={handleMinimize}
            title="Minimizar"
            className="p-1.5 rounded hover:bg-discord-hover text-discord-textMuted hover:text-discord-textPure transition-colors"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleMaximize}
            title="Maximizar / Restaurar"
            className="p-1.5 rounded hover:bg-discord-hover text-discord-textMuted hover:text-discord-textPure transition-colors"
          >
            <Square className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={handleClose}
            title="Cerrar Aplicación"
            className="p-1.5 rounded hover:bg-discord-red text-discord-textMuted hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
