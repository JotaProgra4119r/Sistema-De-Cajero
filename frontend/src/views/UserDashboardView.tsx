import React, { useState, useEffect, useCallback } from "react";
import {
  Wallet, LogOut, CheckCircle2, AlertTriangle, ArrowDownRight,
  ArrowUpRight, RefreshCw, KeyRound, AlertCircle, Banknote, Archive,
  HelpCircle, X, Printer
} from "lucide-react";
import { QuetzalBillCard } from "../components/QuetzalBillCard";
import { userService } from "../services/api";
import { VoucherModal, type VoucherData } from "../components/VoucherModal";

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
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [activeVoucher, setActiveVoucher] = useState<VoucherData | null>(null);

  // Custom withdrawal state
  const [requestedAmount, setRequestedAmount] = useState<string>("0");
  const [selectedBills, setSelectedBills] = useState<Record<number, number>>({
    200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0
  });

  // Deposit state & Transfer to Other Account
  const [depositMode, setDepositMode] = useState<"own" | "third_party">("own");
  const [targetAccountId, setTargetAccountId] = useState<string>("");
  const [targetUserData, setTargetUserData] = useState<{ id_cuenta: string; nombre_completo: string } | null>(null);
  const [targetLookupLoading, setTargetLookupLoading] = useState<boolean>(false);
  const [targetLookupError, setTargetLookupError] = useState<string | null>(null);

  const [depositBills, setDepositBills] = useState<Record<number, number>>({
    200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0
  });

  const handleVerifyTargetAccount = async () => {
    resetInactivity();
    setTargetLookupError(null);
    setTargetUserData(null);
    const clean = targetAccountId.trim();
    if (clean.length < 8) {
      setTargetLookupError("El ID de cuenta debe tener al menos 8 dígitos.");
      return;
    }
    setTargetLookupLoading(true);
    try {
      const res = await userService.lookupAccount(clean);
      setTargetUserData(res);
      setTargetLookupError(null);
    } catch (err: any) {
      setTargetLookupError(err?.response?.data?.detail || "Cuenta no encontrada en la red bancaria.");
    } finally {
      setTargetLookupLoading(false);
    }
  };

  // PIN change state (Sin token dinámico redundante)
  const [currentPin, setCurrentPin] = useState<string>("");
  const [newPin, setNewPin] = useState<string>("");
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
    (acc, [denom, count]) => acc + Number(denom) * Number(count),
    0
  );

  // Compute deposit sum & total pieces
  const totalSelectedDeposit = Object.entries(depositBills).reduce(
    (acc, [denom, count]) => acc + Number(denom) * Number(count),
    0
  );
  const totalDepositPieces = Object.values(depositBills).reduce((acc: number, c: number) => acc + Number(c), 0);

  // Quick preset deposit helper
  const addPresetDeposit = (amt: number) => {
    resetInactivity();
    let rem = amt;
    setDepositBills((prev) => {
      const next = { ...prev };
      for (const d of DENOMINATIONS) {
        if (rem >= d) {
          const count = Math.floor(rem / d);
          next[d] = (next[d] || 0) + count;
          rem -= count * d;
        }
      }
      return next;
    });
  };

  const clearDeposit = () => {
    resetInactivity();
    setDepositBills({ 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0 });
    setFeedbackMessage(null);
  };

  // Steppers for withdrawal (sincroniza en tiempo real el monto solicitado)
  const handleWithdrawBillChange = (denom: number, delta: number) => {
    resetInactivity();
    setSelectedBills((prev) => {
      const current = prev[denom] || 0;
      const next = Math.max(0, current + delta);
      const updated = { ...prev, [denom]: next };
      const sum = Object.entries(updated).reduce((acc, [d, c]) => acc + Number(d) * Number(c), 0);
      setRequestedAmount(sum.toString());
      return updated;
    });
    setFeedbackMessage(null);
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

  // Preset withdrawal amounts (acumula o auto-distribuye)
  const setPresetAmount = (amt: number, autoDistribute = false) => {
    resetInactivity();
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
      setRequestedAmount(amt.toString());
    } else {
      setSelectedBills((prev) => {
        let rem = amt;
        const next = { ...prev };
        for (const d of DENOMINATIONS) {
          if (rem >= d) {
            const count = Math.floor(rem / d);
            next[d] = (next[d] || 0) + count;
            rem -= count * d;
          }
        }
        const sum = Object.entries(next).reduce((acc, [d, c]) => acc + Number(d) * Number(c), 0);
        setRequestedAmount(sum.toString());
        return next;
      });
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

  // Condiciones de retiro reactivo fluido
  const userBalance = Number(userSummary.saldo_actual) || 0;
  const userDailyQuota = userSummary.cupo_disponible !== undefined ? Number(userSummary.cupo_disponible) : 2000;
  const canWithdraw = totalSelectedWithdraw > 0 &&
    totalSelectedWithdraw <= userBalance &&
    totalSelectedWithdraw <= userDailyQuota;

  // Execute Withdrawal con Voucher
  const handleExecuteWithdrawal = async () => {
    resetInactivity();
    if (!canWithdraw) return;
    setLoading(true);
    setFeedbackMessage(null);
    try {
      const billsPayload: Record<string, number> = {};
      for (const [k, v] of Object.entries(selectedBills)) {
        if (Number(v) > 0) billsPayload[k] = Number(v);
      }
      const prevBal = userSummary.saldo_actual || 0;
      const res = await userService.withdraw(totalSelectedWithdraw, billsPayload);
      setFeedbackMessage({ type: "success", text: res.mensaje || "Dispensación exitosa de efectivo." });

      const newBal = res.nuevo_saldo !== undefined ? res.nuevo_saldo : prevBal - totalSelectedWithdraw;
      setActiveVoucher({
        id: res.id_transaccion || Date.now(),
        tipo: "RETIRO",
        titulo: "COMPROBANTE DE RETIRO DE EFECTIVO",
        cliente: userSummary.nombre_completo,
        tarjeta: userSummary.tarjeta,
        monto: totalSelectedWithdraw,
        saldo_anterior: prevBal,
        nuevo_saldo: newBal,
        desglose: billsPayload,
        fecha_hora: res.fecha_hora || new Date().toLocaleString()
      });

      setSelectedBills({ 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0 });
      setRequestedAmount("0");
      await reloadData();
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Error al procesar el retiro.";
      setFeedbackMessage({ type: "error", text: msg });
    } finally {
      setLoading(false);
    }
  };

  // Execute Deposit con Voucher
  const handleExecuteDeposit = async () => {
    resetInactivity();
    if (totalSelectedDeposit <= 0) return;
    setLoading(true);
    setFeedbackMessage(null);
    try {
      const billsPayload: Record<string, number> = {};
      for (const [k, v] of Object.entries(depositBills)) {
        if (Number(v) > 0) billsPayload[k] = Number(v);
      }
      const prevBal = userSummary.saldo_actual || 0;
      let res;
      if (depositMode === "third_party") {
        if (!targetUserData) {
          setFeedbackMessage({ type: "error", text: "Debe verificar la cuenta destinataria de 8 dígitos antes de continuar." });
          setLoading(false);
          return;
        }
        res = await userService.depositToAccount(targetUserData.id_cuenta, billsPayload);
        setFeedbackMessage({ type: "success", text: res.mensaje || "Depósito interbancario acreditado con éxito." });
        setActiveVoucher({
          id: res.id_transaccion || Date.now(),
          tipo: "DEPOSITO",
          titulo: "COMPROBANTE DE DEPÓSITO INTERBANCARIO",
          cliente: `Remitente: ${userSummary.nombre_completo} -> Destinatario: ${res.destinatario_nombre} (ID: ${res.destinatario_cuenta})`,
          tarjeta: userSummary.tarjeta,
          monto: totalSelectedDeposit,
          saldo_anterior: prevBal,
          nuevo_saldo: prevBal,
          desglose: billsPayload,
          fecha_hora: res.fecha_hora || new Date().toLocaleString()
        });
      } else {
        res = await userService.deposit(billsPayload);
        setFeedbackMessage({ type: "success", text: res.mensaje || "Depósito completado con éxito." });
        const newBal = res.nuevo_saldo !== undefined ? res.nuevo_saldo : prevBal + totalSelectedDeposit;
        setActiveVoucher({
          id: res.id_transaccion || Date.now(),
          tipo: "DEPOSITO",
          titulo: "COMPROBANTE DE DEPÓSITO EN EFECTIVO",
          cliente: userSummary.nombre_completo,
          tarjeta: userSummary.tarjeta,
          monto: totalSelectedDeposit,
          saldo_anterior: prevBal,
          nuevo_saldo: newBal,
          desglose: billsPayload,
          fecha_hora: res.fecha_hora || new Date().toLocaleString()
        });
      }

      setDepositBills({ 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0 });
      await reloadData();
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Error al procesar el depósito.";
      setFeedbackMessage({ type: "error", text: msg });
    } finally {
      setLoading(false);
    }
  };

  // Execute PIN Change sin token dinámico
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
      const res = await userService.changePin(userSummary.tarjeta, currentPin, newPin);
      setPinSuccessMsg(res.mensaje);
      setCurrentPin("");
      setNewPin("");
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
    <div className="w-full min-h-full flex-1 flex flex-col bg-discord-base p-2 sm:p-3 lg:p-5 text-discord-textNormal select-none overflow-y-auto">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 sm:pb-3 border-b border-discord-surface flex-shrink-0">
        <div className="flex items-center gap-2.5 lg:gap-4">
          <div className="w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10 rounded-xl bg-discord-blurple flex items-center justify-center shadow-glow flex-shrink-0">
            <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base lg:text-lg font-black text-discord-textPure tracking-wide">
              Área de Autoservicio Bancario
            </h1>
            <p className="text-[10px] sm:text-[11px] lg:text-xs text-discord-textMuted flex flex-wrap items-center gap-1.5">
              <span>Usuario: <strong className="text-white">{userSummary.nombre_completo}</strong></span>
              <span>|</span>
              <span>ID Cuenta: <strong className="font-mono text-purple-300 bg-purple-950/80 px-2 py-0.5 rounded border border-purple-800">{userSummary.id_cuenta_bancaria || "N/A"}</strong></span>
              <span>|</span>
              <span>Tarjeta: <strong className="font-mono text-discord-green">{userSummary.tarjeta}</strong></span>
              <span>|</span>
              <span>Cajero: <strong className="text-amber-300">{userSummary.id_cajero || "ATM-001"}</strong></span>
            </p>
          </div>
        </div>

        {/* Inactivity, Help & Logout */}
        <div className="flex items-center gap-2 lg:gap-3">
          <button
            type="button"
            onClick={() => setShowHelpModal(true)}
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl bg-discord-surface hover:bg-discord-hover text-discord-textMuted hover:text-white border border-discord-hover text-xs font-semibold transition-all active:scale-95"
            title="Guía rápida de autoservicio"
          >
            <HelpCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-discord-blurple" />
            <span className="hidden sm:inline">Ayuda</span>
          </button>

          <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-xl bg-discord-surface border border-discord-hover text-xs font-mono">
            <span className="text-discord-textMuted text-[10px] sm:text-xs">Inactividad:</span>
            <span className={`font-bold ${secondsRemaining <= 15 ? "text-discord-red animate-pulse" : "text-discord-amber"}`}>
              {secondsRemaining}s
            </span>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-discord-red/20 hover:bg-discord-red text-discord-red hover:text-white border border-discord-red font-bold text-xs transition-all shadow-sm active:scale-95"
          >
            <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Salir</span>
          </button>
        </div>
      </div>

      {/* Main Responsive Grid con Scroll Vertical Dinámico */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4 flex-1 min-h-0 items-start lg:items-stretch overflow-y-auto my-2 pb-6">
        {/* COLUMN 1 (Left, 3 cols) */}
        <div className="col-span-1 lg:col-span-3 flex flex-col justify-between p-3.5 lg:p-4 bg-discord-surface rounded-2xl border border-discord-hover shadow-kiosk overflow-y-auto flex-shrink-0">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-discord-textMuted mb-2">
              Saldo Contable Disponible
            </div>
            {/* Card con Fondos en Cuenta Personal (Bóveda oculta para usuario final) */}
            <div className="p-3.5 rounded-xl bg-discord-sidebar border border-discord-hover shadow-inner">
              <div className="text-[11px] font-bold text-discord-textMuted flex items-center justify-between">
                <span>Fondos en Cuenta (Q.):</span>
                <span className="text-[10px] uppercase tracking-wider text-discord-green bg-discord-green/15 px-1.5 py-0.5 rounded font-bold">Personal</span>
              </div>
              <div className="text-2xl font-black text-discord-green tracking-tight font-mono mt-1">
                Q{userSummary.saldo_actual?.toFixed(2) || "0.00"}
              </div>
            </div>

            {/* Circular Progress Gauge */}
            <div className="mt-2.5 sm:mt-4 p-2.5 sm:p-3 rounded-xl bg-discord-sidebar/60 border border-discord-hover text-center">
              <div className="text-xs font-bold uppercase tracking-wider text-discord-textMuted mb-2">
                Cupo Diario de Retiro
              </div>
              <div className="relative w-24 h-24 sm:w-28 sm:h-28 mx-auto flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" stroke="var(--atm-gauge-track)" strokeWidth="10" fill="transparent" />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke={usedRatio > 0.8 ? "var(--atm-color-red)" : usedRatio > 0.5 ? "var(--atm-color-amber)" : "var(--atm-color-green)"}
                    strokeWidth="10"
                    fill="transparent"
                    strokeDasharray="251.2"
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    className="transition-all duration-700 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-black text-discord-textPure font-mono">
                    {Math.round(usedRatio * 100)}%
                  </span>
                  <span className="text-[9px] text-discord-textMuted uppercase font-bold">Consumido</span>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-left pt-2 border-t border-discord-hover">
                <div>
                  <div className="text-[10px] text-discord-textMuted font-medium">Retirado hoy:</div>
                  <div className="text-xs font-bold font-mono text-discord-amber">
                    Q{userSummary.total_retirado_hoy?.toFixed(2) || "0.00"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-discord-textMuted font-medium">Cupo restante:</div>
                  <div className="text-xs font-bold font-mono text-discord-green">
                    Q{userSummary.cupo_disponible?.toFixed(2) || "0.00"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tab Selector (Horizontal scrollable en móviles, vertical en desktop) */}
          <div className="flex lg:flex-col gap-1.5 lg:space-y-2 mt-3 overflow-x-auto lg:overflow-x-visible pb-1 lg:pb-0 scrollbar-none">
            <button
              type="button"
              onClick={() => { setActiveTab("withdraw"); setFeedbackMessage(null); resetInactivity(); }}
              className={`flex-shrink-0 w-auto lg:w-full py-2 lg:py-2.5 px-3 rounded-xl text-left font-bold text-xs flex items-center gap-2 lg:gap-2.5 transition-all whitespace-nowrap ${
                activeTab === "withdraw"
                  ? "bg-discord-blurple text-white shadow-md"
                  : "bg-discord-sidebar hover:bg-discord-hover text-discord-textMuted"
              }`}
            >
              <ArrowDownRight className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
              <span>Retiro Personalizado</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab("deposit"); setFeedbackMessage(null); resetInactivity(); }}
              className={`flex-shrink-0 w-auto lg:w-full py-2 lg:py-2.5 px-3 rounded-xl text-left font-bold text-xs flex items-center gap-2 lg:gap-2.5 transition-all whitespace-nowrap ${
                activeTab === "deposit"
                  ? "bg-discord-green text-black font-extrabold shadow-md"
                  : "bg-discord-sidebar hover:bg-discord-hover text-discord-textMuted"
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
              <span>Depósito Desglosado</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab("pin"); setFeedbackMessage(null); resetInactivity(); }}
              className={`flex-shrink-0 w-auto lg:w-full py-2 lg:py-2.5 px-3 rounded-xl text-left font-bold text-xs flex items-center gap-2 lg:gap-2.5 transition-all whitespace-nowrap ${
                activeTab === "pin"
                  ? "bg-discord-amber text-black font-extrabold shadow-md"
                  : "bg-discord-sidebar hover:bg-discord-hover text-discord-textMuted"
              }`}
            >
              <KeyRound className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
              <span>Actualizar PIN</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab("audit"); setFeedbackMessage(null); resetInactivity(); loadDeletedRecords(); }}
              className={`flex-shrink-0 w-auto lg:w-full py-2 lg:py-2.5 px-3 rounded-xl text-left font-bold text-xs flex items-center gap-2 lg:gap-2.5 transition-all whitespace-nowrap ${
                activeTab === "audit"
                  ? "bg-purple-600 text-white font-extrabold shadow-md"
                  : "bg-discord-sidebar hover:bg-discord-hover text-discord-textMuted"
              }`}
            >
              <Archive className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
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
            <div className="flex flex-col justify-between h-full">
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
                      className="px-1 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border border-emerald-400 dark:bg-discord-sidebar dark:hover:bg-discord-hover dark:text-emerald-400 dark:border-emerald-800/60 transition-all text-center hover:scale-105 active:scale-95 shadow-xs font-black text-xs"
                    >
                      Q50
                    </button>
                    <button
                      type="button"
                      onClick={() => setPresetAmount(100, true)}
                      className="px-1 py-2 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-950 border border-sky-400 dark:bg-discord-sidebar dark:hover:bg-discord-hover dark:text-cyan-400 dark:border-cyan-800/60 transition-all text-center hover:scale-105 active:scale-95 shadow-xs font-black text-xs"
                    >
                      Q100
                    </button>
                    <button
                      type="button"
                      onClick={() => setPresetAmount(200, true)}
                      className="px-1 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-400 dark:bg-discord-sidebar dark:hover:bg-discord-hover dark:text-amber-400 dark:border-amber-800/60 transition-all text-center hover:scale-105 active:scale-95 shadow-xs font-black text-xs"
                    >
                      Q200
                    </button>
                    <button
                      type="button"
                      onClick={() => setPresetAmount(500, true)}
                      className="px-1 py-2 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-950 border border-purple-400 dark:bg-discord-sidebar dark:hover:bg-discord-hover dark:text-purple-400 dark:border-purple-800/60 transition-all text-center hover:scale-105 active:scale-95 shadow-xs font-black text-xs"
                    >
                      Q500
                    </button>
                    <button
                      type="button"
                      onClick={() => setPresetAmount(1000, true)}
                      className="px-1 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-950 border border-blue-400 dark:bg-discord-sidebar dark:hover:bg-discord-hover dark:text-discord-blurple dark:border-discord-blurple/60 transition-all text-center hover:scale-105 active:scale-95 shadow-xs font-black text-xs"
                    >
                      Q1000
                    </button>
                  </div>
                </div>

                {/* Intelligent Auto-Breakdown (Sin duplicar montos que ya están en el panel de validación derecho) */}
                <div className="flex items-center justify-between gap-2 p-2 mb-2 rounded-xl bg-discord-sidebar/80 border border-discord-hover text-xs flex-shrink-0">
                  <button
                    type="button"
                    onClick={handleAutoDistribute}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-discord-blurple hover:bg-discord-blurpleHover text-white font-bold transition-all shadow-sm active:scale-95"
                  >
                    <span>⚡ Desglosar en Billetes Disponibles</span>
                  </button>
                  <span className="text-[11px] text-discord-textMuted font-medium pr-1">
                    Optimiza denominaciones según inventario
                  </span>
                </div>

                <div className="text-[10px] font-bold text-discord-textMuted uppercase tracking-wider mb-1.5 flex-shrink-0">
                  Selector Táctil de Billetes Oficiales (7 Denominaciones):
                </div>

                {/* 7 Bills Grid without awkward cutoff */}
                <div className="grid grid-cols-2 gap-2 flex-1 min-h-[220px] overflow-y-auto pr-1 pb-3">
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
              <div className="flex flex-col flex-1 min-h-0">
                <div className="flex items-center justify-between mb-1 flex-shrink-0">
                  <h2 className="text-base lg:text-lg font-black text-white flex items-center gap-2">
                    <ArrowUpRight className="w-5 h-5 text-discord-green" />
                    <span>Depósito y Transferencia de Efectivo</span>
                  </h2>
                </div>

                {/* Sub-selector de Modalidad: Cuenta Propia vs Otra Cuenta */}
                <div className="grid grid-cols-2 gap-2 mb-3 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setDepositMode("own");
                      setFeedbackMessage(null);
                      resetInactivity();
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border ${
                      depositMode === "own"
                        ? "bg-discord-green text-black border-discord-green shadow-sm"
                        : "bg-discord-sidebar text-discord-textMuted border-discord-hover hover:text-white"
                    }`}
                  >
                    <span>💵 Depósito a Cuenta Propia</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDepositMode("third_party");
                      setFeedbackMessage(null);
                      resetInactivity();
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border ${
                      depositMode === "third_party"
                        ? "bg-purple-600 text-white border-purple-500 shadow-sm"
                        : "bg-discord-sidebar text-discord-textMuted border-discord-hover hover:text-white"
                    }`}
                  >
                    <span>🔄 Depósito a Otra Cuenta (Red Nube)</span>
                  </button>
                </div>

                {/* Si es depósito a tercero, pedir ID de 8 dígitos y verificar */}
                {depositMode === "third_party" && (
                  <div className="mb-3 p-3 rounded-xl bg-purple-950/40 border border-purple-800/60 flex-shrink-0 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-purple-200">
                        ID de Cuenta Bancaria del Destinatario (8 dígitos):
                      </label>
                      <span className="text-[10px] text-discord-textMuted">Red Intercajeros SQL</span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={12}
                        value={targetAccountId}
                        onChange={(e) => {
                          setTargetAccountId(e.target.value.replace(/\D/g, ""));
                          setTargetUserData(null);
                          setTargetLookupError(null);
                        }}
                        placeholder="Ej. 20027819"
                        className="flex-1 px-3 py-2 rounded-lg bg-discord-surface border border-purple-700/80 font-mono text-sm font-bold text-white tracking-wider outline-none focus:border-purple-400"
                      />
                      <button
                        type="button"
                        onClick={handleVerifyTargetAccount}
                        disabled={targetLookupLoading || targetAccountId.length < 8}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                          targetAccountId.length >= 8 && !targetLookupLoading
                            ? "bg-purple-600 hover:bg-purple-500 text-white shadow-md active:scale-95"
                            : "bg-discord-surface text-gray-500 border border-discord-hover cursor-not-allowed"
                        }`}
                      >
                        {targetLookupLoading ? "Buscando..." : "Verificar Cuenta"}
                      </button>
                    </div>

                    {targetLookupError && (
                      <div className="p-2 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{targetLookupError}</span>
                      </div>
                    )}

                    {targetUserData && (
                      <div className="p-2.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                          <div>
                            <span className="font-bold text-white block">{targetUserData.nombre_completo}</span>
                            <span className="text-[10px] text-emerald-200 font-mono">ID Cuenta: {targetUserData.id_cuenta}</span>
                          </div>
                        </div>
                        <span className="text-[10px] uppercase font-black bg-emerald-500/30 text-emerald-200 px-2 py-0.5 rounded">
                          Destinatario OK
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <p className="text-xs text-discord-textMuted mb-2 flex-shrink-0">
                  {depositMode === "third_party"
                    ? "Ingrese el efectivo en billetes que desea acreditar a la cuenta del destinatario:"
                    : "Introduzca los billetes por ranura receptora o seleccione piezas por denominación oficial:"}
                </p>

                {/* Quick preset buttons for deposit */}
                <div className="flex flex-wrap items-center gap-2 mb-2.5 p-2 rounded-xl bg-discord-sidebar/70 border border-discord-hover flex-shrink-0">
                  <span className="text-xs font-bold text-discord-textMuted mr-1">Carga Rápida:</span>
                  <button
                    type="button"
                    onClick={() => addPresetDeposit(50)}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border border-emerald-400 dark:bg-discord-sidebar dark:hover:bg-discord-hover dark:text-emerald-400 dark:border-emerald-800/60 transition-all hover:scale-105 active:scale-95 shadow-xs font-bold text-xs"
                  >
                    +Q50
                  </button>
                  <button
                    type="button"
                    onClick={() => addPresetDeposit(100)}
                    className="px-2.5 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-950 border border-sky-400 dark:bg-discord-sidebar dark:hover:bg-discord-hover dark:text-cyan-400 dark:border-cyan-800/60 transition-all hover:scale-105 active:scale-95 shadow-xs font-bold text-xs"
                  >
                    +Q100
                  </button>
                  <button
                    type="button"
                    onClick={() => addPresetDeposit(200)}
                    className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-400 dark:bg-discord-sidebar dark:hover:bg-discord-hover dark:text-amber-400 dark:border-amber-800/60 transition-all hover:scale-105 active:scale-95 shadow-xs font-bold text-xs"
                  >
                    +Q200
                  </button>
                  <button
                    type="button"
                    onClick={() => addPresetDeposit(500)}
                    className="px-2.5 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-950 border border-purple-400 dark:bg-discord-sidebar dark:hover:bg-discord-hover dark:text-purple-400 dark:border-purple-800/60 transition-all hover:scale-105 active:scale-95 shadow-xs font-bold text-xs"
                  >
                    +Q500
                  </button>
                  <button
                    type="button"
                    onClick={() => addPresetDeposit(1000)}
                    className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-950 border border-blue-400 dark:bg-discord-sidebar dark:hover:bg-discord-hover dark:text-discord-blurple dark:border-discord-blurple/60 transition-all hover:scale-105 active:scale-95 shadow-xs font-bold text-xs"
                  >
                    +Q1000
                  </button>
                  <button
                    type="button"
                    onClick={clearDeposit}
                    className="ml-auto px-2.5 py-1.5 rounded-lg bg-discord-surface hover:bg-discord-red/20 text-xs font-bold text-discord-red border border-discord-red/40 transition-all"
                  >
                    Limpiar
                  </button>
                </div>

                <div className="text-[10px] font-bold text-discord-textMuted uppercase tracking-wider mb-1.5 flex-shrink-0">
                  Alimentador de Billetes Oficiales (7 Denominaciones):
                </div>

                <div className="grid grid-cols-2 gap-2 flex-1 min-h-[220px] overflow-y-auto pr-1 pb-3">
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
            <div className="flex flex-col h-full">
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
          {activeTab === "deposit" ? (
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-discord-textMuted mb-2">
                Validación Reactiva de Depósito
              </div>
              <div className="p-4 rounded-xl bg-discord-sidebar border border-discord-hover space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-discord-textMuted">Piezas Introducidas:</span>
                  <span className="font-mono font-bold text-white text-base">
                    {totalDepositPieces} billete{totalDepositPieces !== 1 ? "s" : ""}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-discord-textMuted">Total a Acreditar:</span>
                  <span className="font-mono font-bold text-base text-discord-green">
                    Q{totalSelectedDeposit.toFixed(2)}
                  </span>
                </div>

                <div
                  className={`p-2.5 rounded-lg border text-center text-xs font-bold flex items-center justify-center gap-1.5 ${
                    totalSelectedDeposit > 0
                      ? "bg-discord-green/20 border-discord-green text-discord-green"
                      : "bg-discord-sidebar border-discord-hover text-discord-textMuted"
                  }`}
                >
                  {totalSelectedDeposit > 0 ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Listo para acreditación</span>
                    </>
                  ) : (
                    <span>Inserte o seleccione billetes</span>
                  )}
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  onClick={handleExecuteDeposit}
                  disabled={
                    totalSelectedDeposit <= 0 ||
                    loading ||
                    (depositMode === "third_party" && !targetUserData)
                  }
                  className={`w-full py-4 rounded-xl font-black text-sm uppercase tracking-wider transition-all shadow-md ${
                    totalSelectedDeposit > 0 && !loading && (depositMode !== "third_party" || targetUserData)
                      ? depositMode === "third_party"
                        ? "bg-purple-600 hover:bg-purple-500 text-white shadow-glow active:scale-95"
                        : "bg-discord-green hover:bg-emerald-400 text-black shadow-glow active:scale-95"
                      : "bg-discord-sidebar text-gray-500 border border-discord-hover cursor-not-allowed"
                  }`}
                >
                  {loading
                    ? "Acreditando..."
                    : depositMode === "third_party"
                    ? (targetUserData ? "Confirmar Transferencia / Depósito" : "Verifique Destinatario Primero")
                    : "Confirmar Depósito"}
                </button>

                <button
                  type="button"
                  onClick={clearDeposit}
                  className="w-full py-2.5 rounded-xl bg-discord-sidebar hover:bg-discord-hover text-discord-textMuted hover:text-white font-bold text-xs border border-discord-hover transition-all"
                >
                  Limpiar Alimentador
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-discord-textMuted mb-2">
                Validación Reactiva de Retiro
              </div>
              <div className="p-4 rounded-xl bg-discord-sidebar border border-discord-hover space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-discord-textMuted">Piezas Seleccionadas:</span>
                  <span className="font-mono font-bold text-white text-base">
                    {Object.values(selectedBills).reduce((a, b) => a + Number(b), 0)} billetes
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-discord-textMuted">Total a Dispensar:</span>
                  <span
                    className={`font-mono font-bold text-base ${
                      canWithdraw
                        ? "text-discord-green"
                        : totalSelectedWithdraw > userBalance
                        ? "text-discord-red"
                        : "text-discord-amber"
                    }`}
                  >
                    Q{totalSelectedWithdraw.toFixed(2)}
                  </span>
                </div>

                <div
                  className={`p-2.5 rounded-lg border text-center text-xs font-bold flex items-center justify-center gap-1.5 ${
                    canWithdraw
                      ? "bg-discord-green/20 border-discord-green text-discord-green"
                      : totalSelectedWithdraw === 0
                      ? "bg-discord-sidebar border-discord-hover text-discord-textMuted"
                      : totalSelectedWithdraw > userBalance
                      ? "bg-discord-red/20 border-discord-red text-discord-red"
                      : "bg-discord-amber/20 border-discord-amber text-discord-amber"
                  }`}
                >
                  {canWithdraw ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Listo para dispensar</span>
                    </>
                  ) : totalSelectedWithdraw === 0 ? (
                    <span>Seleccione los billetes a retirar</span>
                  ) : totalSelectedWithdraw > userBalance ? (
                    <>
                      <AlertTriangle className="w-4 h-4" />
                      <span>Fondos insuficientes en cuenta</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4" />
                      <span>Excede el cupo diario disponible</span>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  onClick={handleExecuteWithdrawal}
                  disabled={!canWithdraw || loading}
                  className={`w-full py-4 rounded-xl font-black text-sm uppercase tracking-wider transition-all shadow-md ${
                    canWithdraw && !loading
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
                    setRequestedAmount("0");
                    setFeedbackMessage(null);
                    resetInactivity();
                  }}
                  className="w-full py-2.5 rounded-xl bg-discord-sidebar hover:bg-discord-hover text-discord-textMuted hover:text-white font-bold text-xs border border-discord-hover transition-all"
                >
                  Limpiar Selección
                </button>
              </div>
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-discord-hover">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-discord-textMuted uppercase tracking-wider">
                Últimas 5 Transacciones
              </span>
              <div className="flex items-center gap-1.5">
                {transactions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const ultimos = transactions.slice(0, 5);
                      setActiveVoucher({
                        id: `EXT-${Date.now().toString().slice(-6)}`,
                        tipo: "AUDITORIA",
                        titulo: "ESTADO DE CUENTA: ÚLTIMOS 5 MOVIMIENTOS",
                        cliente: userSummary.nombre_completo,
                        tarjeta: userSummary.tarjeta,
                        saldo_anterior: userSummary.saldo_actual,
                        nuevo_saldo: userSummary.saldo_actual,
                        fecha_hora: new Date().toLocaleString(),
                        detalles_extra: `Extracto oficial de los últimos ${ultimos.length} movimientos de la cuenta.`,
                        ultimos_movimientos: ultimos.map((t: any) => ({
                          id_transaccion: t.id_transaccion,
                          tipo: t.tipo,
                          monto: Number(t.monto) || 0,
                          fecha_hora: t.fecha_hora,
                          desglose: t.desglose || {}
                        }))
                      });
                    }}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 text-[10px] font-bold transition-all"
                    title="Imprimir extracto bancario con los últimos 5 movimientos en PDF"
                  >
                    <Printer className="w-3 h-3" />
                    <span>Imprimir 5 Movimientos (PDF)</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={reloadData}
                  className="p-1 rounded hover:bg-discord-sidebar text-discord-textMuted hover:text-white"
                  title="Actualizar movimientos"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
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
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white">
                        Q{tx.monto?.toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveVoucher({
                            id: tx.id_transaccion || Date.now(),
                            tipo: tx.tipo === "RETIRO" ? "RETIRO" : "DEPOSITO",
                            titulo: tx.tipo === "RETIRO" ? "COMPROBANTE DE RETIRO DE EFECTIVO" : "COMPROBANTE DE DEPÓSITO EN EFECTIVO",
                            cliente: userSummary.nombre_completo,
                            tarjeta: userSummary.tarjeta,
                            monto: Number(tx.monto) || 0,
                            desglose: tx.desglose || {},
                            fecha_hora: tx.fecha_hora || new Date().toLocaleString()
                          });
                        }}
                        className="p-1.5 rounded-md bg-discord-surface hover:bg-discord-hover text-discord-textMuted hover:text-white border border-discord-hover transition-all"
                        title="Imprimir Voucher PDF"
                      >
                        <Printer className="w-3.5 h-3.5 text-blue-400" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-discord-surface text-xs text-discord-textMuted">
        <div>Sesión activa: {userSummary.nombre_completo} | Operaciones con Doble Escritura MySQL y Archivos Planos</div>
        <div className="text-discord-green font-semibold">● Terminal Segura Bancaria</div>
      </div>

      {/* MODAL: GUIA RAPIDA DE AYUDA */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="max-w-lg w-full p-6 bg-discord-surface rounded-2xl border border-discord-hover shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-discord-hover pb-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-discord-blurple" />
                <h3 className="text-lg font-black text-white">Guía Rápida de Autoservicio</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="p-1 rounded-lg hover:bg-discord-sidebar text-discord-textMuted hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-discord-textNormal leading-relaxed">
              <div className="p-3 rounded-xl bg-discord-sidebar border border-discord-hover">
                <strong className="text-white block mb-1">💸 Retiros de Efectivo:</strong>
                Indique el monto deseado o utilice los botones rápidos. Puede usar el botón <em>⚡ Desglose Automático</em> para calcular la combinación óptima según los billetes físicos disponibles en el cajero.
              </div>

              <div className="p-3 rounded-xl bg-discord-sidebar border border-discord-hover">
                <strong className="text-white block mb-1">📥 Depósitos de Efectivo:</strong>
                Seleccione la pestaña de depósito o el menú superior. Introduzca las piezas por denominación (Q200 hasta Q1) o utilice los botones de carga rápida. Al confirmar, su saldo en cuenta y los fondos de la tienda/bóveda se actualizan de inmediato.
              </div>

              <div className="p-3 rounded-xl bg-discord-sidebar border border-discord-hover">
                <strong className="text-white block mb-1">🛡️ Seguridad y Auditoría:</strong>
                Toda transacción queda firmada y registrada en la base de datos relacional y respaldada simultáneamente en archivos planos inmutables.
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowHelpModal(false)}
              className="w-full py-2.5 rounded-xl bg-discord-blurple hover:bg-discord-blurpleHover text-white font-bold text-xs shadow-md"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE VOUCHER / COMPROBANTE OFICIAL IMPRIMIBLE */}
      {activeVoucher && (
        <VoucherModal
          voucher={activeVoucher}
          onClose={() => setActiveVoucher(null)}
        />
      )}
    </div>
  );
};