import React, { useState, useEffect } from "react";
import { Square, Minus, X, Sun, Moon, Cloud, HardDrive, Building2 } from "lucide-react";
import { getServerMode, switchServerMode } from "../services/api";

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

  const [serverMode, setServerMode] = useState<"cloud" | "local">(() => getServerMode());
  const [activeAtm, setActiveAtm] = useState<string>(() => {
    return localStorage.getItem("active_atm_id") || "ATM-001";
  });

  const handleAtmChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextAtm = e.target.value;
    setActiveAtm(nextAtm);
    localStorage.setItem("active_atm_id", nextAtm);
    window.dispatchEvent(new CustomEvent("atm_changed", { detail: nextAtm }));
  };

  const handleToggleServer = () => {
    const next = serverMode === "cloud" ? "local" : "cloud";
    setServerMode(next);
    switchServerMode(next);
  };

  useEffect(() => {
    const onResize = () => {
      setWindowDimensions({ w: window.innerWidth, h: window.innerHeight });
    };

    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, []);

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

  const isElectron = typeof window !== "undefined" && Boolean(window.electronAPI);

  return (
    <header
      style={{ WebkitAppRegion: "drag" } as any}
      className="w-full bg-[var(--atm-header-bg)] border-b border-discord-hover px-3 sm:px-4 py-1.5 flex items-center justify-between text-xs select-none z-50 h-9 transition-colors"
    >
      {/* Brand & Resolution info */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-discord-green flex-shrink-0" />
          <span className="font-black text-discord-blurple uppercase tracking-wider text-xs whitespace-nowrap">
            ATM KIOSK G&amp;T
          </span>
        </div>
        <span className="hidden sm:inline text-discord-textMuted font-mono text-[11px]">
          ({windowDimensions.w}x{windowDimensions.h})
        </span>
      </div>

      {/* Mode Switchers and Window Controls (no-drag) */}
      <div style={{ WebkitAppRegion: "no-drag" } as any} className="flex items-center gap-2 flex-shrink-0">
        {/* Selector de Cajero Activo */}
        <div className="flex items-center gap-1.5 bg-discord-sidebar px-2 py-1 rounded text-xs border border-discord-hover">
          <Building2 className="w-3.5 h-3.5 text-discord-blurple flex-shrink-0" />
          <select
            value={activeAtm}
            onChange={handleAtmChange}
            className="bg-transparent text-discord-textPure font-bold text-[11px] outline-none cursor-pointer"
            title="Seleccionar terminal ATM activa"
          >
            <option value="ATM-001" className="bg-discord-surface text-discord-textPure">ATM-001 (Sede Central)</option>
            <option value="ATM-002" className="bg-discord-surface text-discord-textPure">ATM-002 (Sucursal Zona 1)</option>
            <option value="ATM-003" className="bg-discord-surface text-discord-textPure">ATM-003 (Miraflores Express)</option>
          </select>
        </div>

        {/* Toggle Servidor: SOLO en Electron de escritorio */}
        {isElectron && (
          <button
            type="button"
            onClick={handleToggleServer}
            title={
              serverMode === "cloud"
                ? "Conectado a la Nube (Render). Clic para cambiar a Modo Local (Offline)"
                : "Modo Local (Offline). Clic para sincronizar con la Nube (Render)"
            }
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold transition-all shadow-xs ${
              serverMode === "cloud"
                ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30"
                : "bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/30"
            }`}
          >
            {serverMode === "cloud" ? <Cloud className="w-3.5 h-3.5" /> : <HardDrive className="w-3.5 h-3.5" />}
            <span>{serverMode === "cloud" ? "Nube (Render)" : "Local (Offline)"}</span>
          </button>
        )}

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

        {/* Window Actions (Solo en Kiosco Electron nativo) */}
        {isElectron && (
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
        )}
      </div>
    </header>
  );
};
