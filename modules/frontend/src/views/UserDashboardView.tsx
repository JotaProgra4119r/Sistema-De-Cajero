import React, { useState, useEffect, useCallback } from "react";
import {
  Wallet, LogOut, CheckCircle2, AlertTriangle, ArrowDownRight,
  ArrowUpRight, RefreshCw, KeyRound, AlertCircle, Banknote, Archive
} from "lucide-react";
import { QuetzalBillCard } from "../components/QuetzalBillCard";
import { userService } from "../services/api";

interface UserDashboardViewProps {
  user: any;
  onLogout: () => void;
}

const DENOMINATIONS = [200, 100, 50, 20, 10, 5, 1];

export const UserDashboardView: React.FC<UserDashboardViewProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<"withdraw" | "deposit" | "pin" | "audit">("withdraw");
  const [userSummary, setUserSummary] = useState<any>(user);
  const [deletedRecords, setDeletedRecords] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState<boolean>(false);
  
  // Custom withdrawal state
  const [requestedAmount, setRequestedAmount] = useState<string>("100");
  const [selectedBills, setSelectedBills] = useState<Record<number, number>>({
    200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0
  });

  // Deposit state
  const [depositBills, setDepositBills] = useState<Record<number, number>>({
    200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0
  });

  // PIN change state
  const [currentPin, setCurrentPin] = useState<string>("");
  const [newPin, setNewPin] = useState<string>("");
  const [pinToken, setPinToken] = useState<string>("");
  const [pinSuccessMsg, setPinSuccessMsg] = useState<string | null>(null);

  // Transactions list
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Inactivity auto-logout timer (60s)
  const [secondsRemaining, setSecondsRemaining] = useState<number>(60);

  const resetInactivity = useCallback(() => {
    setSecondsRemaining(60);
  }, []);

  useEffect(() => {
    const handleActivity = () => resetInactivity();
    window.addEventListener("pointerdown", handleActivity);
    window.addEventListener("keydown", handleActivity);

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      window.removeEventListener("pointerdown", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      clearInterval(timer);
    };
  }, [onLogout, resetInactivity]);

  // Load summary & transactions
  const reloadData = async () => {
    try {
      const summary = await userService.getSummary();
      setUserSummary(summary);
      const txs = await userService.getTransactions();
      setTransactions(txs);
    } catch (err: any) {
      console.error("Error loading user data:", err);
    }
  };

  const loadDeletedRecords = async () => {
    try {
      setLoadingAudit(true);
      const recs = await userService.getDeletedRecords();
      setDeletedRecords(recs);
    } catch (err) {
      console.error("Error loading deleted records:", err);
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    reloadData();
    loadDeletedRecords();
  }, []);

  // Compute withdrawal sum
  const totalSelectedWithdraw = Object.entries(selectedBills).reduce(
    (acc, [denom, count]) => acc + Number(denom) * count,
    0
  );
  const parsedRequestedAmount = parseFloat(requestedAmount) || 0;
  const amountsMatch = totalSelectedWithdraw > 0 && totalSelectedWithdraw === parsedRequestedAmount;

  // Compute deposit sum
  const totalSelectedDeposit = Object.entries(depositBills).reduce(
    (acc, [denom, count]) => acc + Number(denom) * count,
    0
  );

  // Steppers for withdrawal
  const handleWithdrawBillChange = (denom: number, delta: number) => {
    resetInactivity();
    setSelectedBills((prev) => {
      const current = prev[denom] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [denom]: next };
    });
  };

  // Steppers for deposit
  const handleDepositBillChange = (denom: number, delta: number) => {
    resetInactivity();
    setDepositBills((prev) => {
      const current = prev[denom] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [denom]: next };
    });
  };

  // Preset withdrawal amounts
  const setPresetAmount = (amt: number, autoDistribute = false) => {
    resetInactivity();
    setRequestedAmount(amt.toString());
    if (autoDistribute) {
      let rem = amt;
      const newBills: Record<number, number> = { 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0 };
      for (const d of DENOMINATIONS) {
        if (rem >= d) {
          const count = Math.floor(rem / d);
          newBills[d] = count;
          rem -= count * d;
        }
      }
      setSelectedBills(newBills);
    } else {
      setSelectedBills({ 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0 });
    }
    setFeedbackMessage(null);
  };

  // Auto-distribute greedy denomination breakdown for requested amount
  const handleAutoDistribute = () => {
    resetInactivity();
    const amt = parseFloat(requestedAmount) || 0;
    if (amt <= 0) {
      setFeedbackMessage({ type: "error", text: "Ingrese un monto mayor a 0 para desglosar." });
      return;
    }
    let rem = amt;
    const newBills: Record<number, number> = { 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0 };
    for (const d of DENOMINATIONS) {
      const stock = userSummary.stock_boveda ? userSummary.stock_boveda[d] : 99;
      if (rem >= d && stock > 0) {
        const count = Math.min(Math.floor(rem / d), stock);
        newBills[d] = count;
        rem -= count * d;
      }
    }
    setSelectedBills(newBills);
    if (rem > 0) {
      setFeedbackMessage({
        type: "error",
        text: `No hay suficientes billetes en bóveda para desglosar exactamente Q${amt}.00 (remanente: Q${rem.toFixed(2)}).`
      });
    } else {
      setFeedbackMessage({
        type: "success",
        text: `Desglose automático de Q${amt}.00 calculado con éxito.`
      });
    }
  };

  // Execute Withdrawal
  const handleExecuteWithdrawal = async () => {
    resetInactivity();
    if (!amountsMatch) return;
    setLoading(true);
    setFeedbackMessage(null);
    try {
      const billsPayload: Record<string, number> = {};
      for (const [k, v] of Object.entries(selectedBills)) {
        if (v > 0) billsPayload[k] = v;
      }
      const res = await userService.withdraw(parsedRequestedAmount, billsPayload);
      setFeedbackMessage({ type: "success", text: res.mensaje || "Dispensación exitosa de efectivo." });
      setSelectedBills({ 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0 });
      await reloadData();
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Error al procesar el retiro.";
      setFeedbackMessage({ type: "error", text: msg });
    } finally {
      setLoading(false);
    }
  };

  // Execute Deposit
  const handleExecuteDeposit = async () => {
    resetInactivity();
    if (totalSelectedDeposit <= 0) return;
    setLoading(true);
    setFeedbackMessage(null);
    try {
      const billsPayload: Record<string, number> = {};
      for (const [k, v] of Object.entries(depositBills)) {
        if (v > 0) billsPayload[k] = v;
      }
      const res = await userService.deposit(billsPayload);
      setFeedbackMessage({ type: "success", text: res.mensaje || "Depósito completado con éxito." });
      setDepositBills({ 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0 });
      await reloadData();
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Error al procesar el depósito.";
      setFeedbackMessage({ type: "error", text: msg });
    } finally {
      setLoading(false);
    }
  };

  // Execute PIN Change
  const handleExecuteChangePin = async () => {
    resetInactivity();
    setPinSuccessMsg(null);
    setFeedbackMessage(null);
    if (newPin.length !== 4) {
      setFeedbackMessage({ type: "error", text: "El nuevo PIN debe tener exactamente 4 dígitos." });
      return;
    }
    setLoading(true);
    try {
      const res = await userService.changePin(userSummary.tarjeta, currentPin, pinToken, newPin);
      setPinSuccessMsg(res.mensaje);
      setCurrentPin("");
      setNewPin("");
      setPinToken("");
      await reloadData();
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Error al actualizar el PIN.";
      setFeedbackMessage({ type: "error", text: msg });
    } finally {
      setLoading(false);
    }
  };

  // Circular progress math
  const maxDaily = userSummary.monto_max_diario || 2000;
  const withdrawnToday = userSummary.total_retirado_hoy || 0;
  const usedRatio = Math.min(1, withdrawnToday / maxDaily);
  const strokeDashoffset = 251.2 * (1 - usedRatio);

  return (
    <div className="w-full h-full flex flex-col justify-between bg-discord-base p-3 lg:p-5 text-discord-textNormal select-none overflow-y-auto lg:overflow-hidden">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-discord-surface flex-shrink-0">
        <div className="flex items-center gap-3 lg:gap-4">
          <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-discord-blurple flex items-center justify-center shadow-glow flex-shrink-0">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base lg:text-lg font-black text-discord-textPure tracking-wide">
              Área de Autoservicio Bancario
            </h1>
            <p className="text-[11px] lg:text-xs text-discord-textMuted">
              Usuario: <span className="text-white font-bold">{userSummary.nombre_completo}</span> | Tarjeta: <span className="font-mono text-discord-green">{userSummary.tarjeta}</span>
            </p>
          </div>
        </div>

        {/* Inactivity & Logout */}
        <div className="flex items-center gap-2 lg:gap-3">
          <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-discord-surface border border-discord-hover text-xs font-mono">
            <span className="text-discord-textMuted">Inactividad:</span>
            <span className={`font-bold ${secondsRemaining <= 15 ? "text-discord-red animate-pulse" : "text-discord-amber"}`}>
              {secondsRemaining}s
            </span>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-discord-red/20 hover:bg-discord-red text-discord-red hover:text-white border border-discord-red font-bold text-xs transition-all shadow-sm active:scale-95"
          >
            <LogOut className="w-4 h-4" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </div>

      {/* Main 3-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0 items-stretch overflow-y-auto lg:overflow-hidden my-2">
        {/* COLUMN 1 (Left, 3 cols) */}
        <div className="col-span-1 lg:col-span-3 flex flex-col justify-between p-4 bg-discord-surface rounded-2xl border border-discord-hover shadow-kiosk overflow-y-auto">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-discord-textMuted mb-2">
              Saldo Contable Disponible
            </div>
            <div className="p-3 rounded-xl bg-discord-sidebar border border-discord-hover shadow-inner">
              <div className="text-xs font-semibold text-discord-textMuted">Fondos en Cuenta (Q.):</div>
              <div className="text-2xl font-black text-discord-green tracking-tight font-mono mt-1">
                Q{userSummary.saldo_actual?.toFixed(2) || "0.00"}
              </div>
            </div>

            {/* Circular Progress Gauge */}
            <div className="mt-4 p-3 rounded-xl bg-discord-sidebar/60 border border-discord-hover text-center">
              <div className="text-xs font-bold uppercase tracking-wider text-discord-textMuted mb-2">
                Cupo Diario de Retiro
              </div>
              <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" stroke="#2F3136" strokeWidth="10" fill="transparent" />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke={usedRatio > 0.8 ? "#ED4245" : usedRatio > 0.5 ? "#FEE75C" : "#57F287"}
                    strokeWidth="10"
                    fill="transparent"
                    strokeDasharray="251.2"
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    className="transition-all duration-700 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-black text-white font-mono">
                    {Math.round(usedRatio * 100)}%
                  </span>
                  <span className="text-[9px] text-discord-textMuted uppercase font-bold">Consumido</span>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-left pt-2 border-t border-discord-hover">
                <div>
                  <div className="text-[10px] text-discord-textMuted">Retirado hoy:</div>
                  <div className="text-xs font-bold font-mono text-discord-amber">
                    Q{userSummary.total_retirado_hoy?.toFixed(2) || "0.00"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-discord-textMuted">Cupo restante:</div>
                  <div className="text-xs font-bold font-mono text-discord-green">
                    Q{userSummary.cupo_disponible?.toFixed(2) || "0.00"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tab Selector */}
          <div className="space-y-2 mt-3">
            <button
              type="button"
              onClick={() => { setActiveTab("withdraw"); setFeedbackMessage(null); resetInactivity(); }}
              className={`w-full py-2.5 px-3 rounded-xl text-left font-bold text-xs flex items-center gap-2.5 transition-all ${
                activeTab === "withdraw"
                  ? "bg-discord-blurple text-white shadow-md"
                  : "bg-discord-sidebar hover:bg-discord-hover text-discord-textMuted"
              }`}
            >
              <ArrowDownRight className="w-4 h-4" />
              <span>Retiro Personalizado</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab("deposit"); setFeedbackMessage(null); resetInactivity(); }}
              className={`w-full py-2.5 px-3 rounded-xl text-left font-bold text-xs flex items-center gap-2.5 transition-all ${
                activeTab === "deposit"
                  ? "bg-discord-green text-black font-extrabold shadow-md"
                  : "bg-discord-sidebar hover:bg-discord-hover text-discord-textMuted"
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>Depósito Desglosado</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab("pin"); setFeedbackMessage(null); resetInactivity(); }}
              className={`w-full py-2.5 px-3 rounded-xl text-left font-bold text-xs flex items-center gap-2.5 transition-all ${
                activeTab === "pin"
                  ? "bg-discord-amber text-black font-extrabold shadow-md"
                  : "bg-discord-sidebar hover:bg-discord-hover text-discord-textMuted"
              }`}
            >
              <KeyRound className="w-4 h-4" />
              <span>Actualizar PIN</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab("audit"); setFeedbackMessage(null); resetInactivity(); loadDeletedRecords(); }}
              className={`w-full py-2.5 px-3 rounded-xl text-left font-bold text-xs flex items-center gap-2.5 transition-all ${
                activeTab === "audit"
                  ? "bg-purple-600 text-white font-extrabold shadow-md"
                  : "bg-discord-sidebar hover:bg-discord-hover text-discord-textMuted"
              }`}
            >
              <Archive className="w-4 h-4" />
              <span>Mis Registros y Bajas</span>
            </button>
          </div>
        </div>

        {/* COLUMN 2 (Center, 6 cols) */}
        <div className="col-span-1 lg:col-span-6 flex flex-col justify-between p-4 bg-discord-surface rounded-2xl border border-discord-hover shadow-kiosk overflow-y-auto">
          {feedbackMessage && (
            <div
              className={`p-2.5 mb-2.5 rounded-xl border flex items-center gap-2 text-xs font-medium animate-shake flex-shrink-0 ${
                feedbackMessage.type === "success"
                  ? "bg-discord-green/20 border-discord-green text-discord-green"
                  : "bg-discord-red/20 border-discord-red text-discord-red"
              }`}
            >
              {feedbackMessage.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span>{feedbackMessage.text}</span>
            </div>
          )}

          {activeTab === "withdraw" && (
            <div className="flex flex-col justify-between h-full overflow-hidden">
              <div className="flex flex-col flex-1 min-h-0">
                <div className="flex items-center justify-between mb-2 flex-shrink-0">
                  <h2 className="text-base font-black text-white flex items-center gap-2">
                    <Banknote className="w-5 h-5 text-discord-blurple" />
                    <span>Monto de Retiro Arbitrario No Estandarizado</span>
                  </h2>
                </div>

                <div className="grid grid-cols-12 gap-2 mb-2 flex-shrink-0">
                  <div className="col-span-12 sm:col-span-5 flex items-center bg-discord-sidebar px-3 py-2 rounded-xl border border-discord-hover">
                    <span className="text-xl font-black text-discord-green mr-1.5">Q.</span>
                    <input
                      type="number"
                      value={requestedAmount}
                      onChange={(e) => {
                        setRequestedAmount(e.target.value);
                        resetInactivity();
                      }}
                      className="w-full bg-transparent font-mono text-xl font-black text-white focus:outline-none"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="col-span-12 sm:col-span-7 grid grid-cols-5 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPresetAmount(50, true)}
                      className="px-1 py-2 rounded-lg bg-discord-sidebar hover:bg-discord-hover text-xs font-bold text-emerald-400 border border-emerald-800/60 transition-all text-center hover:scale-105 active:scale-95 shadow-sm"
                    >
                      Q50
                    </button>
                    <button
                      type="button"
                      onClick={() => setPresetAmount(100, true)}
                      className="px-1 py-2 rounded-lg bg-discord-sidebar hover:bg-discord-hover text-xs font-bold text-cyan-400 border border-cyan-800/60 transition-all text-center hover:scale-105 active:scale-95 shadow-sm"
                    >
                      Q100
                    </button>
                    <button
                      type="button"
                      onClick={() => setPresetAmount(200, true)}
                      className="px-1 py-2 rounded-lg bg-discord-sidebar hover:bg-discord-hover text-xs font-bold text-amber-400 border border-amber-800/60 transition-all text-center hover:scale-105 active:scale-95 shadow-sm"
                    >
                      Q200
                    </button>
                    <button
                      type="button"
                      onClick={() => setPresetAmount(500, true)}
                      className="px-1 py-2 rounded-lg bg-discord-sidebar hover:bg-discord-hover text-xs font-bold text-purple-400 border border-purple-800/60 transition-all text-center hover:scale-105 active:scale-95 shadow-sm"
                    >
                      Q500
                    </button>
                    <button
                      type="button"
                      onClick={() => setPresetAmount(1000, true)}
                      className="px-1 py-2 rounded-lg bg-discord-sidebar hover:bg-discord-hover text-xs font-bold text-discord-blurple border border-discord-blurple/60 transition-all text-center hover:scale-105 active:scale-95 shadow-sm"
                    >
                      Q1000
                    </button>
                  </div>
                </div>

                {/* Intelligent Auto-Breakdown & Status bar */}
                <div className="flex items-center justify-between gap-2 p-2 mb-2 rounded-xl bg-discord-sidebar/80 border border-discord-hover text-xs flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAutoDistribute}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-discord-blurple hover:bg-discord-blurpleHover text-white font-bold transition-all shadow-sm active:scale-95"
                    >
                      <span>⚡ Desglose Automático</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBills({ 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0 });
                        setFeedbackMessage(null);
                        resetInactivity();
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-discord-surface hover:bg-discord-hover text-gray-300 font-semibold border border-discord-hover transition-all"
                    >
                      Limpiar
                    </button>
                  </div>
                  <div className="text-right">
                    <span className="text-discord-textMuted mr-1">Seleccionado:</span>
                    <span className={`font-mono font-bold ${amountsMatch ? "text-discord-green" : "text-discord-amber"}`}>
                      Q{totalSelectedWithdraw.toFixed(2)}
                    </span>
                    <span className="text-discord-textMuted mx-1">/</span>
                    <span className="font-mono text-white font-bold">
                      Q{parsedRequestedAmount.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="text-[10px] font-bold text-discord-textMuted uppercase tracking-wider mb-1.5 flex-shrink-0">
                  Selector Táctil de Billetes Oficiales (7 Denominaciones):
                </div>

                {/* 7 Bills Grid without awkward cutoff */}
                <div className="grid grid-cols-2 gap-2 flex-1 min-h-0 overflow-y-auto pr-1 pb-1">
                  {DENOMINATIONS.map((d) => (
                    <QuetzalBillCard
                      key={d}
                      denom={d}
                      count={selectedBills[d] || 0}
                      stock={userSummary.stock_boveda ? userSummary.stock_boveda[d] : 99}
                      onIncrement={() => handleWithdrawBillChange(d, 1)}
                      onDecrement={() => handleWithdrawBillChange(d, -1)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "deposit" && (
            <div className="flex flex-col justify-between h-full">
              <div>
                <h2 className="text-lg font-black text-white mb-1 flex items-center gap-2">
                  <ArrowUpRight className="w-5 h-5 text-discord-green" />
                  <span>Depósito de Efectivo Desglosado por Denominación</span>
                </h2>
                <p className="text-xs text-discord-textMuted mb-4">
                  Incremente la cantidad de piezas introducidas en el alimentador por denominación
                </p>

                <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-1">
                  {DENOMINATIONS.map((d) => (
                    <QuetzalBillCard
                      key={d}
                      denom={d}
                      count={depositBills[d] || 0}
                      stock={999}
                      onIncrement={() => handleDepositBillChange(d, 1)}
                      onDecrement={() => handleDepositBillChange(d, -1)}
                    />
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-discord-sidebar border border-discord-hover mt-4 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-discord-textMuted">Total a Acreditar:</div>
                  <div className="text-2xl font-black font-mono text-discord-green">
                    Q{totalSelectedDeposit.toFixed(2)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleExecuteDeposit}
                  disabled={totalSelectedDeposit <= 0 || loading}
                  className={`px-6 py-3 rounded-xl font-extrabold text-sm transition-all shadow-md ${
                    totalSelectedDeposit > 0 && !loading
                      ? "bg-discord-green hover:bg-emerald-400 text-black shadow-glow"
                      : "bg-gray-700 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  {loading ? "Procesando..." : "Confirmar Depósito"}
                </button>
              </div>
            </div>
          )}

          {activeTab === "pin" && (
            <div className="max-w-[400px] mx-auto w-full my-auto p-6 bg-discord-sidebar rounded-2xl border border-discord-hover shadow-kiosk">
              <h2 className="text-xl font-black text-white mb-2 flex items-center gap-2">
                <KeyRound className="w-6 h-6 text-discord-amber" />
                <span>Actualización de PIN Confidencial</span>
              </h2>
              <p className="text-xs text-discord-textMuted mb-6">
                Tarjeta: <span className="font-mono text-white font-bold">{userSummary.tarjeta}</span>
              </p>

              {pinSuccessMsg && (
                <div className="p-3 mb-4 bg-discord-green/20 border border-discord-green rounded-xl text-discord-green text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>{pinSuccessMsg}</span>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-discord-textMuted block mb-1">
                    PIN Confidencial Actual (4 dígitos)
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    value={currentPin}
                    onChange={(e) => setCurrentPin(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-discord-surface border border-discord-hover font-mono text-xl tracking-widest text-white focus:outline-none focus:border-discord-blurple"
                    placeholder="••••"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-discord-textMuted block mb-1">
                    Token Dinámico de Seguridad (6 dígitos)
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={pinToken}
                    onChange={(e) => setPinToken(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-discord-surface border border-discord-hover font-mono text-xl tracking-widest text-discord-green focus:outline-none focus:border-discord-blurple"
                    placeholder="000000"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-discord-textMuted block mb-1">
                    Nuevo PIN Confidencial (4 dígitos)
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-discord-surface border border-discord-hover font-mono text-xl tracking-widest text-white focus:outline-none focus:border-discord-blurple"
                    placeholder="••••"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleExecuteChangePin}
                  disabled={loading || newPin.length !== 4}
                  className={`w-full py-3.5 rounded-xl font-extrabold text-sm transition-all shadow-md mt-4 ${
                    newPin.length === 4 && !loading
                      ? "bg-discord-amber hover:bg-amber-400 text-black shadow-glow"
                      : "bg-gray-700 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  {loading ? "Actualizando..." : "Confirmar Nuevo PIN"}
                </button>
              </div>
            </div>
          )}

          {activeTab === "audit" && (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="flex items-center justify-between mb-2.5 flex-shrink-0">
                <h2 className="text-base font-black text-white flex items-center gap-2">
                  <Archive className="w-5 h-5 text-purple-400" />
                  <span>Historial de Bajas y Desactivaciones</span>
                </h2>
                <button
                  type="button"
                  onClick={loadDeletedRecords}
                  className="px-2.5 py-1 rounded-lg bg-discord-sidebar hover:bg-discord-hover text-discord-textMuted hover:text-white text-xs font-bold border border-discord-hover flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingAudit ? "animate-spin" : ""}`} />
                  <span>Actualizar</span>
                </button>
              </div>

              <div className="text-[11px] text-discord-textMuted mb-2.5 bg-discord-sidebar/60 p-2.5 rounded-xl border border-discord-hover">
                Por política de transparencia bancaria, ninguna operación se elimina destructivamente. Aquí puede consultar el historial de plásticos sustituidos, bloqueos o registros desactivados de su cuenta.
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {deletedRecords.length === 0 ? (
                  <div className="p-8 text-center text-discord-textMuted bg-discord-sidebar rounded-xl border border-discord-hover">
                    <CheckCircle2 className="w-8 h-8 text-discord-green mx-auto mb-2 opacity-80" />
                    <div className="font-bold text-sm text-white">Sin Registros Dados de Baja</div>
                    <div className="text-xs mt-1">Su cuenta y tarjetas se encuentran en estado activo sin incidencias.</div>
                  </div>
                ) : (
                  deletedRecords.map((r) => (
                    <div
                      key={r.id_eliminacion}
                      className="p-3 rounded-xl bg-discord-sidebar border border-purple-900/40 hover:border-purple-600/60 transition-all space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-purple-950 text-purple-300 border border-purple-800">
                          {r.tabla_origen === "tarjetas" ? "Tarjeta Desactivada" : "Usuario / Cuenta"}
                        </span>
                        <span className="text-[11px] font-mono text-discord-textMuted">
                          {r.fecha_eliminacion}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-white">
                        Motivo: <span className="text-purple-200 font-normal">{r.motivo || "Baja o sustitución administrativa"}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-discord-textMuted pt-1 border-t border-discord-hover">
                        <span>Autorizado por: <strong className="text-white">{r.eliminado_por}</strong></span>
                        <span className="font-mono text-purple-400">ID #{r.id_registro_origen}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* COLUMN 3 (Right, 3 cols) */}
        <div className="col-span-1 lg:col-span-3 flex flex-col justify-between p-4 lg:p-5 bg-discord-surface rounded-2xl border border-discord-hover shadow-kiosk overflow-y-auto">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-discord-textMuted mb-2">
              Validación Reactiva de Retiro
            </div>
            <div className="p-4 rounded-xl bg-discord-sidebar border border-discord-hover space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-discord-textMuted">Monto Solicitado:</span>
                <span className="font-mono font-bold text-white text-base">
                  Q{parsedRequestedAmount.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-discord-textMuted">Total Seleccionado:</span>
                <span
                  className={`font-mono font-bold text-base ${
                    amountsMatch
                      ? "text-discord-green"
                      : totalSelectedWithdraw > parsedRequestedAmount
                      ? "text-discord-red"
                      : "text-discord-amber"
                  }`}
                >
                  Q{totalSelectedWithdraw.toFixed(2)}
                </span>
              </div>

              <div
                className={`p-2.5 rounded-lg border text-center text-xs font-bold flex items-center justify-center gap-1.5 ${
                  amountsMatch
                    ? "bg-discord-green/20 border-discord-green text-discord-green"
                    : "bg-discord-red/10 border-discord-red/40 text-discord-red"
                }`}
              >
                {amountsMatch ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Suma Exacta: Válido</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4" />
                    <span>
                      Diferencia: Q{Math.abs(totalSelectedWithdraw - parsedRequestedAmount).toFixed(2)}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={handleExecuteWithdrawal}
                disabled={!amountsMatch || loading}
                className={`w-full py-4 rounded-xl font-black text-sm uppercase tracking-wider transition-all shadow-md ${
                  amountsMatch && !loading
                    ? "bg-discord-green hover:bg-emerald-400 text-black shadow-glow active:scale-95"
                    : "bg-discord-sidebar text-gray-500 border border-discord-hover cursor-not-allowed"
                }`}
              >
                {loading ? "Dispensando..." : "Dispensar Efectivo"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedBills({ 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0 });
                  setFeedbackMessage(null);
                  resetInactivity();
                }}
                className="w-full py-2.5 rounded-xl bg-discord-sidebar hover:bg-discord-hover text-discord-textMuted hover:text-white font-bold text-xs border border-discord-hover transition-all"
              >
                Cancelar Operación
              </button>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-discord-hover">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-discord-textMuted uppercase tracking-wider">
                Últimas 5 Transacciones
              </span>
              <button
                type="button"
                onClick={reloadData}
                className="p-1 rounded hover:bg-discord-sidebar text-discord-textMuted hover:text-white"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1.5 max-h-[170px] overflow-y-auto">
              {transactions.length === 0 ? (
                <div className="text-xs text-gray-500 italic text-center py-4">
                  Sin transacciones registradas.
                </div>
              ) : (
                transactions.slice(0, 5).map((tx) => (
                  <div
                    key={tx.id_transaccion}
                    className="p-2 rounded-lg bg-discord-sidebar/60 border border-discord-hover flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-white flex items-center gap-1">
                        {tx.tipo === "RETIRO" ? (
                          <ArrowDownRight className="w-3.5 h-3.5 text-discord-amber" />
                        ) : (
                          <ArrowUpRight className="w-3.5 h-3.5 text-discord-green" />
                        )}
                        <span>{tx.tipo}</span>
                      </div>
                      <div className="text-[10px] text-discord-textMuted">{tx.fecha_hora}</div>
                    </div>
                    <div className="font-mono font-bold text-white">
                      Q{tx.monto?.toFixed(2)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-discord-surface text-xs text-discord-textMuted">
        <div>Sesión activa: {userSummary.nombre_completo} | Retiros validados con Arduino Mega y Sensores IR</div>
        <div className="text-discord-green font-semibold">● Terminal Segura Bancaria</div>
      </div>
    </div>
  );
};