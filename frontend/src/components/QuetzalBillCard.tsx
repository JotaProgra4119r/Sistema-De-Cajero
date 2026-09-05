import React from "react";
import { Plus, Minus, Banknote } from "lucide-react";

export interface BillConfig {
  denom: number;
  label: string;
  sublabel: string;
  badgeColor: string;
  bgGradient: string;
  borderColor: string;
}

export const BILL_CONFIGS: Record<number, BillConfig> = {
  200: {
    denom: 200,
    label: "Q200",
    sublabel: "Bicentenario / Tikal",
    badgeColor: "text-cyan-400 bg-cyan-950/60 border-cyan-800",
    bgGradient: "from-cyan-950/30 to-slate-900",
    borderColor: "border-cyan-500/30 hover:border-cyan-400",
  },
  100: {
    denom: 100,
    label: "Q100",
    sublabel: "Obispo Marroquín",
    badgeColor: "text-amber-400 bg-amber-950/60 border-amber-800",
    bgGradient: "from-amber-950/30 to-slate-900",
    borderColor: "border-amber-500/30 hover:border-amber-400",
  },
  50: {
    denom: 50,
    label: "Q50",
    sublabel: "Carlos Zachrisson",
    badgeColor: "text-orange-400 bg-orange-950/60 border-orange-800",
    bgGradient: "from-orange-950/30 to-slate-900",
    borderColor: "border-orange-500/30 hover:border-orange-400",
  },
  20: {
    denom: 20,
    label: "Q20",
    sublabel: "Mariano Gálvez",
    badgeColor: "text-blue-400 bg-blue-950/60 border-blue-800",
    bgGradient: "from-blue-950/30 to-slate-900",
    borderColor: "border-blue-500/30 hover:border-blue-400",
  },
  10: {
    denom: 10,
    label: "Q10",
    sublabel: "Miguel García Granados",
    badgeColor: "text-purple-400 bg-purple-950/60 border-purple-800",
    bgGradient: "from-purple-950/30 to-slate-900",
    borderColor: "border-purple-500/30 hover:border-purple-400",
  },
  5: {
    denom: 5,
    label: "Q5",
    sublabel: "Justo Rufino Barrios",
    badgeColor: "text-violet-400 bg-violet-950/60 border-violet-800",
    bgGradient: "from-violet-950/30 to-slate-900",
    borderColor: "border-violet-500/30 hover:border-violet-400",
  },
  1: {
    denom: 1,
    label: "Q1",
    sublabel: "José María Orellana",
    badgeColor: "text-emerald-400 bg-emerald-950/60 border-emerald-800",
    bgGradient: "from-emerald-950/30 to-slate-900",
    borderColor: "border-emerald-500/30 hover:border-emerald-400",
  },
};

interface QuetzalBillCardProps {
  denom: number;
  count: number;
  stock?: number;
  onIncrement: () => void;
  onDecrement: () => void;
  disabled?: boolean;
}

export const QuetzalBillCard: React.FC<QuetzalBillCardProps> = ({
  denom,
  count,
  stock = 99,
  onIncrement,
  onDecrement,
  disabled = false,
}) => {
  const cfg = BILL_CONFIGS[denom] || {
    denom,
    label: `Q${denom}`,
    sublabel: "Billete Oficial",
    badgeColor: "text-gray-300 bg-gray-800 border-gray-700",
    bgGradient: "from-gray-900 to-slate-900",
    borderColor: "border-gray-700",
  };

  const isStockEmpty = stock <= 0;
  const canIncrement = count < stock && !disabled;

  return (
    <div
      className={`relative flex flex-col justify-between p-3.5 rounded-xl border bg-gradient-to-b ${cfg.bgGradient} ${cfg.borderColor} transition-all shadow-md ${
        count > 0 ? "ring-2 ring-discord-blurple shadow-glow" : ""
      }`}
    >
      {/* Top row: Denomination preview & Available stock */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-discord-surface/80 border border-discord-hover">
            <Banknote className="w-5 h-5 text-discord-textPure" />
          </div>
          <div>
            <div className="font-extrabold text-xl text-discord-textPure tracking-wide">
              {cfg.label}
            </div>
            <div className="text-[11px] text-discord-textMuted truncate max-w-[110px]">
              {cfg.sublabel}
            </div>
          </div>
        </div>

        {/* Available stock pill */}
        <div className="text-right">
          <span
            className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded-md border ${
              isStockEmpty
                ? "bg-red-950/60 text-red-400 border-red-800"
                : cfg.badgeColor
            }`}
          >
            Disp: {stock}
          </span>
          {count > 0 && (
            <div className="text-xs font-bold text-discord-green mt-0.5">
              Q{(denom * count).toFixed(2)}
            </div>
          )}
        </div>
      </div>

      {/* Stepper controls */}
      <div className="flex items-center justify-between mt-3.5 pt-2 border-t border-discord-surface/80">
        <button
          type="button"
          onClick={onDecrement}
          disabled={count <= 0 || disabled}
          className={`w-12 h-12 flex items-center justify-center rounded-xl font-bold text-xl transition-all active:scale-95 border ${
            count > 0
              ? "bg-discord-surface hover:bg-discord-hover text-white border-discord-hover"
              : "bg-discord-surface/40 text-gray-600 border-transparent cursor-not-allowed"
          }`}
        >
          <Minus className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center">
          <span className="text-2xl font-black text-white">{count}</span>
          <span className="text-[10px] text-discord-textMuted uppercase tracking-wider">piezas</span>
        </div>

        <button
          type="button"
          onClick={onIncrement}
          disabled={!canIncrement}
          className={`w-12 h-12 flex items-center justify-center rounded-xl font-bold text-xl transition-all active:scale-95 border ${
            canIncrement
              ? "bg-discord-blurple hover:bg-discord-blurpleHover text-white shadow-sm"
              : "bg-discord-surface/40 text-gray-600 border-transparent cursor-not-allowed"
          }`}
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};