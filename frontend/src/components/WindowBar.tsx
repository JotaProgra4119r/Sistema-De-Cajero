import React, { useState, useEffect } from "react";
import { Maximize2, Minimize2, Monitor, Square, Minus, X, Tv } from "lucide-react";

declare global {
  interface Window {
    electronAPI?: {
      minimize: () => Promise<void>;
      maximize: () => Promise<void>;
      toggleFullscreen: () => Promise<boolean>;
      setFullscreen: (flag: boolean) => Promise<boolean>;
      setWindowed: () => Promise<boolean>;
      close: () => Promise<void>;
      isElectron: boolean;
      onWindowStateChange: (cb: (state: any) => void) => void;
    };
  }
}

export const WindowBar: React.FC = () => {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  useEffect(() => {
    // Listen to Electron state changes
    if (window.electronAPI?.onWindowStateChange) {
      window.electronAPI.onWindowStateChange((state: any) => {
        setIsFullscreen(Boolean(state.isFullScreen));
      });
    }

    // Also listen to browser fullscreen changes
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
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

  const handleSetWindowed = async () => {
    if (window.electronAPI) {
      await window.electronAPI.setWindowed();
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
      className="w-full bg-[#1e1f22] border-b border-[#2b2d31] px-4 py-2 flex items-center justify-between text-xs select-none z-50 h-9"
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
              <Tv className="w-3.5 h-3.5 text-discord-yellow" />
              <span className="text-discord-yellow font-medium">Pantalla Completa (F11 / Esc)</span>
            </>
          ) : (
            <>
              <Monitor className="w-3.5 h-3.5 text-discord-blurple" />
              <span className="text-gray-300 font-medium">Modo Ventana (1400x900)</span>
            </>
          )}
        </span>
      </div>

      {/* Mode Switchers and Window Controls (no-drag) */}
      <div style={{ WebkitAppRegion: "no-drag" } as any} className="flex items-center gap-2">
        {/* Switch to Windowed Mode */}
        <button
          type="button"
          onClick={handleSetWindowed}
          title="Cambiar a Modo Ventana"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-all ${
            !isFullscreen
              ? "bg-discord-blurple text-white"
              : "bg-[#2b2d31] text-gray-300 hover:bg-[#35373c] hover:text-white"
          }`}
        >
          <Monitor className="w-3 h-3" />
          <span>Modo Ventana</span>
        </button>

        {/* Switch to Fullscreen Mode */}
        <button
          type="button"
          onClick={handleToggleFullscreen}
          title="Cambiar a Pantalla Completa (F11)"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-all ${
            isFullscreen
              ? "bg-discord-blurple text-white"
              : "bg-[#2b2d31] text-gray-300 hover:bg-[#35373c] hover:text-white"
          }`}
        >
          {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          <span>{isFullscreen ? "Salir Completa" : "Pantalla Completa"}</span>
        </button>

        {/* Window Actions */}
        <div className="flex items-center ml-2 border-l border-[#35373c] pl-2 gap-1">
          <button
            type="button"
            onClick={handleMinimize}
            title="Minimizar"
            className="p-1.5 rounded hover:bg-[#35373c] text-gray-400 hover:text-white transition-colors"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleMaximize}
            title="Maximizar / Restaurar"
            className="p-1.5 rounded hover:bg-[#35373c] text-gray-400 hover:text-white transition-colors"
          >
            <Square className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={handleClose}
            title="Cerrar Aplicación"
            className="p-1.5 rounded hover:bg-discord-red text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
