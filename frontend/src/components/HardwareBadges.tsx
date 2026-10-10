import React from "react";
import { ShieldCheck, Eye, Cpu, Radio } from "lucide-react";

interface HardwareBadgesProps {
  esp32Connected?: boolean;
  rfidReady?: boolean;
  opticalReady?: boolean;
  vaultActive?: boolean;
}

export const HardwareBadges: React.FC<HardwareBadgesProps> = ({
  esp32Connected = true,
  rfidReady = true,
  opticalReady = true,
  vaultActive = true,
}) => {
  return (
    <div className="flex flex-wrap gap-2.5 items-center">
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 dark:bg-discord-surface/90 border border-emerald-500 dark:border-discord-hover rounded-full text-xs font-bold text-slate-800 dark:text-discord-textNormal">
        <ShieldCheck className={`w-4 h-4 ${vaultActive ? "text-emerald-700 dark:text-discord-green" : "text-red-700 dark:text-discord-red"}`} />
        <span className="text-slate-700 dark:text-discord-textMuted">Bóveda:</span>
        <span className={vaultActive ? "text-emerald-800 dark:text-discord-green font-extrabold" : "text-red-800 dark:text-discord-red font-extrabold"}>
          {vaultActive ? "Activa" : "Inactiva"}
        </span>
      </div>

      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 dark:bg-discord-surface/90 border border-emerald-500 dark:border-discord-hover rounded-full text-xs font-bold text-slate-800 dark:text-discord-textNormal">
        <Eye className={`w-4 h-4 ${opticalReady ? "text-emerald-700 dark:text-discord-green" : "text-red-700 dark:text-discord-red"}`} />
        <span className="text-slate-700 dark:text-discord-textMuted">Sensores IR:</span>
        <span className={opticalReady ? "text-emerald-800 dark:text-discord-green font-extrabold" : "text-red-800 dark:text-discord-red font-extrabold"}>
          {opticalReady ? "Calibrados" : "Error"}
        </span>
      </div>

      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 dark:bg-discord-surface/90 border border-emerald-500 dark:border-discord-hover rounded-full text-xs font-bold text-slate-800 dark:text-discord-textNormal">
        <Cpu className={`w-4 h-4 ${esp32Connected ? "text-emerald-700 dark:text-discord-green" : "text-amber-700 dark:text-discord-amber"}`} />
        <span className="text-slate-700 dark:text-discord-textMuted">ESP32:</span>
        <span className={esp32Connected ? "text-emerald-800 dark:text-discord-green font-extrabold" : "text-amber-800 dark:text-discord-amber font-extrabold"}>
          {esp32Connected ? "COM3 115200" : "Simulado"}
        </span>
      </div>

      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 dark:bg-discord-surface/90 border border-blue-500 dark:border-discord-hover rounded-full text-xs font-bold text-slate-800 dark:text-discord-textNormal">
        <Radio className={`w-4 h-4 ${rfidReady ? "text-blue-700 dark:text-discord-blurple animate-pulse" : "text-red-700 dark:text-discord-red"}`} />
        <span className="text-slate-700 dark:text-discord-textMuted">RFID RC522:</span>
        <span className={rfidReady ? "text-blue-800 dark:text-discord-blurple font-extrabold" : "text-red-800 dark:text-discord-red font-extrabold"}>
          {rfidReady ? "Listo / SPI" : "Inactivo"}
        </span>
      </div>
    </div>
  );
};