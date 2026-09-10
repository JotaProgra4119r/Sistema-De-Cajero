import React from "react";
import { Plus, Minus, Banknote } from "lucide-react";

export interface BillConfig {
  denom: number;
  label: string;
  sublabel: string;
  badgeColor: string;
  cardBg: string;
  borderColor: string;
  accentText: string;
  iconStyle: string;
}

export const BILL_CONFIGS: Record<number, BillConfig> = {
  200: {
    denom: 200,
    label: "Q200",
    sublabel: "Bicentenario / Tikal",
    badgeColor: "text-teal-900 bg-teal-100 border-teal-300 dark:text-cyan-300 dark:bg-cyan-950/80 dark:border-cyan-800",
    cardBg: "bg-gradient-to-b from-teal-50 via-cyan-50/70 to-teal-100/50 dark:from-cyan-950/50 dark:to-slate-900",
    borderColor: "border-teal-300 hover:border-teal-400 dark:border-cyan-500/40 dark:hover:border-cyan-400",
    accentText: "text-teal-900 dark:text-cyan-300",
    iconStyle: "bg-teal-100 text-teal-800 border-teal-200 dark:bg-cyan-950 dark:text-cyan-400 dark:border-cyan-800",
  },
  100: {
    denom: 100,
    label: "Q100",
    sublabel: "Obispo Marroquín",
    badgeColor: "text-amber-900 bg-amber-100 border-amber-300 dark:text-amber-300 dark:bg-amber-950/80 dark:border-amber-800",
    cardBg: "bg-gradient-to-b from-amber-50 via-yellow-50/70 to-amber-100/50 dark:from-amber-950/50 dark:to-slate-900",
    borderColor: "border-amber-300 hover:border-amber-400 dark:border-amber-500/40 dark:hover:border-amber-400",
    accentText: "text-amber-900 dark:text-amber-300",
    iconStyle: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800",
  },
  50: {
    denom: 50,
    label: "Q50",
    sublabel: "Carlos Zachrisson",
    badgeColor: "text-orange-900 bg-orange-100 border-orange-300 dark:text-orange-300 dark:bg-orange-950/80 dark:border-orange-800",
    cardBg: "bg-gradient-to-b from-orange-50 via-amber-50/70 to-orange-100/50 dark:from-orange-950/50 dark:to-slate-900",
    borderColor: "border-orange-300 hover:border-orange-400 dark:border-orange-500/40 dark:hover:border-orange-400",
    accentText: "text-orange-900 dark:text-orange-300",
    iconStyle: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800",
  },
  20: {
    denom: 20,
    label: "Q20",
    sublabel: "Mariano Gálvez",
    badgeColor: "text-blue-900 bg-blue-100 border-blue-300 dark:text-blue-300 dark:bg-blue-950/80 dark:border-blue-800",
    cardBg: "bg-gradient-to-b from-blue-50 via-sky-50/70 to-blue-100/50 dark:from-blue-950/50 dark:to-slate-900",
    borderColor: "border-blue-300 hover:border-blue-400 dark:border-blue-500/40 dark:hover:border-blue-400",
    accentText: "text-blue-900 dark:text-blue-300",
    iconStyle: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800",
  },
  10: {
    denom: 10,
    label: "Q10",
    sublabel: "Miguel García Granados",
    badgeColor: "text-purple-900 bg-purple-100 border-purple-300 dark:text-purple-300 dark:bg-purple-950/80 dark:border-purple-800",
    cardBg: "bg-gradient-to-b from-purple-50 via-fuchsia-50/70 to-purple-100/50 dark:from-purple-950/50 dark:to-slate-900",
    borderColor: "border-purple-300 hover:border-purple-400 dark:border-purple-500/40 dark:hover:border-purple-400",
    accentText: "text-purple-900 dark:text-purple-300",
    iconStyle: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950 dark:text-purple-400 dark:border-purple-800",
  },
  5: {
    denom: 5,
    label: "Q5",
    sublabel: "Justo Rufino Barrios",
    badgeColor: "text-violet-900 bg-violet-100 border-violet-300 dark:text-violet-300 dark:bg-violet-950/80 dark:border-violet-800",
    cardBg: "bg-gradient-to-b from-violet-50 via-indigo-50/70 to-violet-100/50 dark:from-violet-950/50 dark:to-slate-900",
    borderColor: "border-violet-300 hover:border-violet-400 dark:border-violet-500/40 dark:hover:border-violet-400",
    accentText: "text-violet-900 dark:text-violet-300",
    iconStyle: "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950 dark:text-violet-400 dark:border-violet-800",
  },
  1: {
    denom: 1,
    label: "Q1",
    sublabel: "José María Orellana",
    badgeColor: "text-emerald-900 bg-emerald-100 border-emerald-300 dark:text-emerald-300 dark:bg-emerald-950/80 dark:border-emerald-800",
    cardBg: "bg-gradient-to-b from-emerald-50 via-green-50/70 to-emerald-100/50 dark:from-emerald-950/50 dark:to-slate-900",
    borderColor: "border-emerald-300 hover:border-emerald-400 dark:border-emerald-500/40 dark:hover:border-emerald-400",
    accentText: "text-emerald-900 dark:text-emerald-300",
    iconStyle: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800",
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
    badgeColor: "text-slate-800 bg-slate-100 border-slate-300 dark:text-gray-300 dark:bg-gray-800 dark:border-gray-700",
    cardBg: "bg-slate-50 dark:bg-slate-900",
    borderColor: "border-slate-300 dark:border-gray-700",
    accentText: "text-slate-900 dark:text-white",
    iconStyle: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
  };

  const isStockEmpty = stock <= 0;
  const canIncrement = count < stock && !disabled;

  return (
    <div
      className={`relative flex flex-col justify-between p-2.5 rounded-xl border transition-all shadow-xs dark:shadow-md ${cfg.cardBg} ${cfg.borderColor} ${
        count > 0 ? "ring-2 ring-discord-blurple shadow-glow" : ""
      }`}
    >
      {/* Top row: Denomination preview & Available stock */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg border shadow-2xs ${cfg.iconStyle}`}>
            <Banknote className="w-4 h-4" />
          </div>
          <div>
            <div className={`font-black text-lg tracking-wide leading-tight ${cfg.accentText}`}>
              {cfg.label}
            </div>
            <div className="text-[10px] font-semibold text-slate-500 dark:text-discord-textMuted truncate max-w-[100px]">
              {cfg.sublabel}
            </div>
          </div>
        </div>

        {/* Available stock pill */}
        <div className="text-right">
          <span
            className={`inline-block px-1.5 py-0.5 text-[10px] font-bold rounded border ${
              isStockEmpty
                ? "bg-red-100 text-red-700 border-red-300 dark:bg-red-950/60 dark:text-red-400 dark:border-red-800"
                : cfg.badgeColor
            }`}
          >
            Disp: {stock}
          </span>
          {count > 0 && (
            <div className="text-xs font-black text-emerald-700 dark:text-discord-green">
              Q{(denom * count).toFixed(2)}
            </div>
          )}
        </div>
      </div>

      {/* Stepper controls */}
      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-200/80 dark:border-discord-surface/80">
        <button
          type="button"
          onClick={onDecrement}
          disabled={count <= 0 || disabled}
          className={`w-9 h-9 flex items-center justify-center rounded-lg font-bold text-base transition-all active:scale-95 border ${
            count > 0
              ? "bg-white dark:bg-discord-surface hover:bg-slate-100 dark:hover:bg-discord-hover text-slate-900 dark:text-white border-slate-300 dark:border-discord-hover shadow-xs"
              : "bg-slate-200/70 dark:bg-discord-surface/40 text-slate-400 dark:text-gray-600 border-transparent cursor-not-allowed"
          }`}
        >
          <Minus className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center">
          <span className="text-xl font-black text-slate-900 dark:text-discord-textPure leading-none">{count}</span>
          <span className="text-[9px] font-bold text-slate-500 dark:text-discord-textMuted uppercase tracking-wider">piezas</span>
        </div>

        <button
          type="button"
          onClick={onIncrement}
          disabled={!canIncrement}
          className={`w-9 h-9 flex items-center justify-center rounded-lg font-bold text-base transition-all active:scale-95 border ${
            canIncrement
              ? "bg-discord-blurple hover:bg-discord-blurpleHover text-white shadow-sm font-extrabold"
              : "bg-slate-200/70 dark:bg-discord-surface/40 text-slate-400 dark:text-gray-600 border-transparent cursor-not-allowed"
          }`}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};