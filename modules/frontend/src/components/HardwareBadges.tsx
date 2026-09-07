import React from "react";
import { ShieldCheck, Eye, Video, Radio } from "lucide-react";

interface HardwareBadgesProps {
  arduinoConnected?: boolean;
  cameraStreaming?: boolean;
  opticalReady?: boolean;
  vaultActive?: boolean;
}

export const HardwareBadges: React.FC<HardwareBadgesProps> = ({
  arduinoConnected = true,
  cameraStreaming = true,
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
        <Video className={`w-4 h-4 ${cameraStreaming ? "text-discord-blurple animate-pulse" : "text-discord-red"}`} />
        <span className="text-discord-textMuted">OV2640:</span>
        <span className={cameraStreaming ? "text-discord-blurple font-semibold" : "text-discord-red font-semibold"}>
          {cameraStreaming ? "En Vivo" : "Desconectada"}
        </span>
      </div>

      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-discord-surface/90 border border-discord-hover rounded-full text-xs font-medium">
        <Radio className={`w-4 h-4 ${arduinoConnected ? "text-discord-green" : "text-discord-amber"}`} />
        <span className="text-discord-textMuted">Arduino Mega:</span>
        <span className={arduinoConnected ? "text-discord-green font-semibold" : "text-discord-amber font-semibold"}>
          {arduinoConnected ? "COM3 115200" : "Simulado"}
        </span>
      </div>
    </div>
  );
};