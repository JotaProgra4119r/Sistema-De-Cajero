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
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-discord-surface/90 border border-discord-hover rounded-full text-xs font-medium">
        <ShieldCheck className={`w-4 h-4 ${vaultActive ? "text-discord-green" : "text-discord-red"}`} />
        <span className="text-discord-textMuted">Bóveda:</span>
        <span className={vaultActive ? "text-discord-green font-semibold" : "text-discord-red font-semibold"}>
          {vaultActive ? "Activa" : "Inactiva"}
        </span>
      </div>

      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-discord-surface/90 border border-discord-hover rounded-full text-xs font-medium">
        <Eye className={`w-4 h-4 ${opticalReady ? "text-discord-green" : "text-discord-red"}`} />
        <span className="text-discord-textMuted">Sensores IR:</span>
        <span className={opticalReady ? "text-discord-green font-semibold" : "text-discord-red font-semibold"}>
          {opticalReady ? "Calibrados" : "Error"}
        </span>
      </div>

      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-discord-surface/90 border border-discord-hover rounded-full text-xs font-medium">
        <Cpu className={`w-4 h-4 ${esp32Connected ? "text-discord-green" : "text-discord-amber"}`} />
        <span className="text-discord-textMuted">ESP32:</span>
        <span className={esp32Connected ? "text-discord-green font-semibold" : "text-discord-amber font-semibold"}>
          {esp32Connected ? "COM3 115200" : "Simulado"}
        </span>
      </div>

      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-discord-surface/90 border border-discord-hover rounded-full text-xs font-medium">
        <Radio className={`w-4 h-4 ${rfidReady ? "text-discord-blurple animate-pulse" : "text-discord-red"}`} />
        <span className="text-discord-textMuted">RFID RC522:</span>
        <span className={rfidReady ? "text-discord-blurple font-semibold" : "text-discord-red font-semibold"}>
          {rfidReady ? "Listo / SPI" : "Inactivo"}
        </span>
      </div>
    </div>
  );
};