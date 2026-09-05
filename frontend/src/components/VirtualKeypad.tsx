import React from "react";
import { Delete, Check } from "lucide-react";

interface VirtualKeypadProps {
  onNumberClick: (num: string) => void;
  onClear: () => void;
  onEnter: () => void;
  enterDisabled?: boolean;
}

export const VirtualKeypad: React.FC<VirtualKeypadProps> = ({
  onNumberClick,
  onClear,
  onEnter,
  enterDisabled = false,
}) => {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "E"];

  return (
    <div className="grid grid-cols-3 gap-3 w-full max-w-[360px] mx-auto p-4 bg-discord-surface rounded-2xl shadow-kiosk border border-discord-hover">
      {keys.map((k) => {
        if (k === "C") {
          return (
            <button
              key="clear"
              type="button"
              onClick={onClear}
              className="h-16 min-h-[64px] flex items-center justify-center gap-2 bg-discord-red hover:bg-red-600 active:scale-95 text-white font-semibold text-lg rounded-xl transition-all shadow-md"
            >
              <Delete className="w-6 h-6" />
              <span>Limpiar</span>
            </button>
          );
        }
        if (k === "E") {
          return (
            <button
              key="enter"
              type="button"
              onClick={onEnter}
              disabled={enterDisabled}
              className={`h-16 min-h-[64px] flex items-center justify-center gap-2 font-bold text-lg rounded-xl transition-all shadow-md active:scale-95 ${
                enterDisabled
                  ? "bg-gray-600 text-gray-400 cursor-not-allowed opacity-50"
                  : "bg-discord-green hover:bg-emerald-400 text-black shadow-glow"
              }`}
            >
              <Check className="w-6 h-6" />
              <span>Entrar</span>
            </button>
          );
        }
        return (
          <button
            key={k}
            type="button"
            onClick={() => onNumberClick(k)}
            className="h-16 min-h-[64px] flex items-center justify-center bg-discord-sidebar hover:bg-discord-hover active:scale-95 text-discord-textPure font-bold text-2xl rounded-xl transition-all border border-discord-hover shadow-sm"
          >
            {k}
          </button>
        );
      })}
    </div>
  );
};