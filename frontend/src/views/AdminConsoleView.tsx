import React, { useState, useEffect } from "react";
import {
  Shield, Users, BarChart3, FileText, LogOut, Database,
  AlertCircle, CheckCircle2, RefreshCw, Plus, Radio,
  ArrowDownRight, ArrowUpRight, RotateCcw, AlertTriangle,
  Cpu, CreditCard, Terminal, Printer, PieChart, TrendingUp, Banknote, Key
} from "lucide-react";
import { adminService, hardwareService } from "../services/api";
import { VoucherModal, type VoucherData } from "../components/VoucherModal";

interface AdminConsoleViewProps {
  adminUser: any;
  onLogout: () => void;
}

const DENOMINATIONS = [200, 100, 50, 20, 10, 5, 1];

export const AdminConsoleView: React.FC<AdminConsoleViewProps> = ({ adminUser, onLogout }) => {
  const [activeSection, setActiveSection] = useState<"vault" | "users" | "analytics" | "audit" | "hardware">("vault");
  const [auditFilter, setAuditFilter] = useState<"all" | "withdrawals" | "deposits" | "system">("all");
  const [metrics, setMetrics] = useState<any>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [activeVoucher, setActiveVoucher] = useState<VoucherData | null>(null);

  // Vault init inputs (max Q10,000)
  const [initBills, setInitBills] = useState<Record<number, number>>({
    200: 20, 100: 25, 50: 20, 20: 50, 10: 50, 5: 50, 1: 100
  });

  // Add cash inputs (max accumulated Q30,000)
  const [addBills, setAddBills] = useState<Record<number, number>>({
    200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0
  });

  // Vault reset state
  const [showResetVaultModal, setShowResetVaultModal] = useState<boolean>(false);
  const [resettingVault, setResettingVault] = useState<boolean>(false);

  // User management modals & in-dialog errors
  const [selectedUserForLimit, setSelectedUserForLimit] = useState<any | null>(null);
  const [newLimitValue, setNewLimitValue] = useState<string>("");

  const [selectedUserForCard, setSelectedUserForCard] = useState<any | null>(null);
  const [newCardValue, setNewCardValue] = useState<string>("");
  const [reassignModalError, setReassignModalError] = useState<string | null>(null);

  const [selectedUserForPin, setSelectedUserForPin] = useState<any | null>(null);
  const [newPinValue, setNewPinValue] = useState<string>("");
  const [pinModalError, setPinModalError] = useState<string | null>(null);

  const [showNewEmpModal, setShowNewEmpModal] = useState<boolean>(false);
  const [newEmpName, setNewEmpName] = useState<string>("");
  const [newEmpCard, setNewEmpCard] = useState<string>("");
  const [newEmpPin, setNewEmpPin] = useState<string>("1234");
  const [newEmpBalance, setNewEmpBalance] = useState<string>("1000");
  const [newEmpLimit, setNewEmpLimit] = useState<string>("2000");
  const [newEmpModalError, setNewEmpModalError] = useState<string | null>(null);

  // Hardware status & RFID debug simulation
  const [hardwareStatus, setHardwareStatus] = useState<any>(null);
  const [rfidDebugCard, setRfidDebugCard] = useState<string>("1234567812345678");
  const [rfidDebugUid, setRfidDebugUid] = useState<string>("B4:5A:21:8F");
  const [rfidTapping, setRfidTapping] = useState<boolean>(false);

  const fetchMetrics = async () => {
    try {
      const data = await adminService.getMetrics();
      setMetrics(data);
      const hw = await hardwareService.getStatus();
      setHardwareStatus(hw);
    } catch (err: any) {
      console.error("Error fetching metrics:", err);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 10000);
    return () => clearInterval(interval);
  }, []);

  const totalInit = Object.entries(initBills).reduce((acc, [d, c]) => acc + Number(d) * Number(c), 0);
  const totalAdd = Object.entries(addBills).reduce((acc, [d, c]) => acc + Number(d) * Number(c), 0);

  const handleInitializeVault = async () => {
    setFeedbackMsg(null);
    try {
      const payload: Record<string, number> = {};
      for (const [d, c] of Object.entries(initBills)) payload[d] = Number(c);
      const res = await adminService.initializeVault(payload);
      setFeedbackMsg({ type: "success", text: res.mensaje });
      await fetchMetrics();
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.response?.data?.detail || "Error al inicializar bóveda." });
    }
  };

  const handleAddCash = async () => {
    setFeedbackMsg(null);
    try {
      const payload: Record<string, number> = {};
      for (const [d, c] of Object.entries(addBills)) {
        if (Number(c) > 0) payload[d] = Number(c);
      }
      const res = await adminService.addCashVault(payload);
      setFeedbackMsg({ type: "success", text: res.mensaje });
      setAddBills({ 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0 });
      await fetchMetrics();
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.response?.data?.detail || "Error al agregar efectivo." });
    }
  };

  const handleResetVault = async () => {
    setResettingVault(true);
    setFeedbackMsg(null);
    try {
      const res = await adminService.resetVault();
      setFeedbackMsg({ type: "success", text: res.mensaje || "Bóveda reiniciada a cero (Q0.00) exitosamente." });
      setShowResetVaultModal(false);
      await fetchMetrics();
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.response?.data?.detail || "Error al reiniciar bóveda a cero." });
    } finally {
      setResettingVault(false);
    }
  };

  const handleSaveLimit = async () => {
    if (!selectedUserForLimit) return;
    const val = parseFloat(newLimitValue);
    if (!val || val <= 0) return;
    try {
      const res = await adminService.adjustLimit(selectedUserForLimit.id_usuario, val);
      setFeedbackMsg({ type: "success", text: res.mensaje });
      setSelectedUserForLimit(null);
      await fetchMetrics();
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.response?.data?.detail || "Error al ajustar límite." });
    }
  };

  const handleSaveCard = async () => {
    if (!selectedUserForCard) return;
    setReassignModalError(null);
    const clean = newCardValue.replace(/\D/g, "");
    if (clean.length < 16) {
      setReassignModalError(`La tarjeta tiene solo ${clean.length} dígitos. Se requieren exactamente 16 dígitos numéricos (faltan ${16 - clean.length}).`);
      return;
    }
    if (clean.length > 16) {
      setReassignModalError(`La tarjeta excede los 16 dígitos (${clean.length}/16).`);
      return;
    }
    try {
      const res = await adminService.reassignCard(selectedUserForCard.id_usuario, clean);
      setFeedbackMsg({ type: "success", text: res.mensaje });
      setSelectedUserForCard(null);
      setReassignModalError(null);
      await fetchMetrics();
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Error al reasignar tarjeta.";
      setReassignModalError(msg);
    }
  };

  const handleSavePin = async () => {
    if (!selectedUserForPin) return;
    setPinModalError(null);
    const cleanPin = newPinValue.replace(/\D/g, "");
    if (cleanPin.length !== 4) {
      setPinModalError(`El PIN debe tener exactamente 4 dígitos numéricos (${cleanPin.length}/4).`);
      return;
    }
    try {
      const res = await adminService.changeUserPin(selectedUserForPin.id_usuario, cleanPin);
      setFeedbackMsg({ type: "success", text: res.mensaje });
      setSelectedUserForPin(null);
      setNewPinValue("");
      setPinModalError(null);
      await fetchMetrics();
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Error al actualizar el PIN.";
      setPinModalError(msg);
    }
  };

  const handleRegisterEmployee = async () => {
    setNewEmpModalError(null);
    const clean = newEmpCard.replace(/\D/g, "");
    if (!newEmpName.trim()) {
      setNewEmpModalError("Por favor ingrese el nombre completo del empleado.");
      return;
    }
    if (clean.length < 16) {
      setNewEmpModalError(`La tarjeta tiene solo ${clean.length} dígitos. Se requieren exactamente 16 dígitos numéricos (faltan ${16 - clean.length}).`);
      return;
    }
    if (clean.length > 16) {
      setNewEmpModalError(`La tarjeta excede los 16 dígitos (${clean.length}/16).`);
      return;
    }
    if (newEmpPin.length !== 4) {
      setNewEmpModalError("El PIN debe tener exactamente 4 dígitos.");
      return;
    }

    try {
      const res = await adminService.registerEmployee({
        nombre_completo: newEmpName.trim(),
        numero_tarjeta: clean,
        pin: newEmpPin,
        saldo_inicial: parseFloat(newEmpBalance) || 0,
        monto_max_diario: parseFloat(newEmpLimit) || 2000,
      });
      setFeedbackMsg({ type: "success", text: res.mensaje });
      setShowNewEmpModal(false);
      setNewEmpName("");
      setNewEmpCard("");
      setNewEmpModalError(null);
      await fetchMetrics();
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Error al registrar empleado.";
      setNewEmpModalError(msg);
    }
  };

  const handlePrintAuditCertificate = () => {
    let items: any[] = [];
    let title = "CERTIFICADO DE AUDITORÍA GENERAL";
    let extra = "Auditoría completa de retiros, depósitos y eventos del sistema.";
    let totalMonto: number | undefined = undefined;

    if (auditFilter === "withdrawals") {
      items = (metrics?.transacciones || []).filter((t: any) => t.tipo === "RETIRO");
      title = "ACTA DE AUDITORÍA: RETIROS DE EFECTIVO";
      extra = "Listado formal certificado de retiros de efectivo dispensados.";
      totalMonto = items.reduce((acc: number, it: any) => acc + (Number(it.monto) || 0), 0);
    } else if (auditFilter === "deposits") {
      items = (metrics?.transacciones || []).filter((t: any) => t.tipo === "DEPOSITO");
      title = "ACTA DE AUDITORÍA: FONDOS INGRESADOS (DEPÓSITOS)";
      extra = "Listado formal certificado de depósitos recibidos y acreditados en bóveda.";
      totalMonto = items.reduce((acc: number, it: any) => acc + (Number(it.monto) || 0), 0);
    } else if (auditFilter === "system") {
      items = (metrics?.auditoria || []);
      title = "CERTIFICADO DE AUDITORÍA: EVENTOS Y SEGURIDAD";
      extra = "Bitácora cronológica inmutable de accesos, inicializaciones y cambios administrativos.";
    } else {
      items = (metrics?.transacciones || []);
      totalMonto = items.reduce((acc: number, it: any) => acc + (Number(it.monto) || 0), 0);
    }

    setActiveVoucher({
      id: `AUD-${Date.now().toString().slice(-6)}`,
      tipo: "AUDITORIA",
      titulo: title,
      cliente: adminUser?.nombre_completo || "ADMINISTRADOR DE BÓVEDA",
      monto: totalMonto,
      detalles_extra: extra,
      fecha_hora: new Date().toLocaleString(),
      items_auditoria: items
    });
  };

  const handleToggleRfidDebug = async () => {
    const current = hardwareStatus?.debug_mode ?? true;
    try {
      const res = await hardwareService.toggleRfidDebug(!current);
      setFeedbackMsg({ type: "success", text: res.mensaje });
      await fetchMetrics();
    } catch {
      setFeedbackMsg({ type: "error", text: "Error al alternar modo de depuración RFID." });
    }
  };

  const handleSimulateRfidTap = async () => {
    setRfidTapping(true);
    try {
      const res = await hardwareService.simulateRfidTap(rfidDebugCard, rfidDebugUid);
      setFeedbackMsg({ type: "success", text: res.message });
      await fetchMetrics();
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.response?.data?.detail || "Error al simular acercar tarjeta RFID." });
    } finally {
      setRfidTapping(false);
    }
  };

  return (
    <div className="w-full h-full flex bg-discord-base text-discord-textNormal select-none overflow-hidden">
      {/* LEFT NAVIGATION RAIL */}
      <div className="w-52 lg:w-64 bg-discord-sidebar flex flex-col justify-between p-3 lg:p-4 border-r border-discord-hover h-full flex-shrink-0 overflow-y-auto">
        <div>
          <div className="flex items-center gap-2.5 lg:gap-3 pb-3 lg:pb-4 border-b border-discord-hover">
            <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-discord-amber flex items-center justify-center text-black font-black text-lg lg:text-xl shadow-md">
              🛡️
            </div>
            <div>
              <h1 className="text-xs lg:text-sm font-black text-white uppercase tracking-wider">
                Consola Admin
              </h1>
              <p className="text-[10px] lg:text-[11px] text-discord-textMuted">Gestión de Bóveda & Auditoría</p>
            </div>
          </div>

          <nav className="mt-4 lg:mt-6 space-y-1 lg:space-y-1.5">
            <button
              type="button"
              onClick={() => { setActiveSection("vault"); setFeedbackMsg(null); }}
              className={`w-full flex items-center gap-2.5 lg:gap-3 px-3 lg:px-4 py-2.5 lg:py-3 rounded-xl font-bold text-xs lg:text-sm transition-all ${
                activeSection === "vault"
                  ? "bg-discord-blurple text-white shadow-md"
                  : "text-discord-textMuted hover:bg-discord-surface hover:text-white"
              }`}
            >
              <Database className="w-4 h-4 lg:w-5 lg:h-5" />
              <span>Bóveda y Arqueo</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveSection("users"); setFeedbackMsg(null); }}
              className={`w-full flex items-center gap-2.5 lg:gap-3 px-3 lg:px-4 py-2.5 lg:py-3 rounded-xl font-bold text-xs lg:text-sm transition-all ${
                activeSection === "users"
                  ? "bg-discord-blurple text-white shadow-md"
                  : "text-discord-textMuted hover:bg-discord-surface hover:text-white"
              }`}
            >
              <Users className="w-4 h-4 lg:w-5 lg:h-5" />
              <span>Cuentas de Usuarios</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveSection("analytics"); setFeedbackMsg(null); }}
              className={`w-full flex items-center gap-2.5 lg:gap-3 px-3 lg:px-4 py-2.5 lg:py-3 rounded-xl font-bold text-xs lg:text-sm transition-all ${
                activeSection === "analytics"
                  ? "bg-discord-blurple text-white shadow-md"
                  : "text-discord-textMuted hover:bg-discord-surface hover:text-white"
              }`}
            >
              <BarChart3 className="w-4 h-4 lg:w-5 lg:h-5" />
              <span>Métricas Diarias</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveSection("audit"); setFeedbackMsg(null); }}
              className={`w-full flex items-center gap-2.5 lg:gap-3 px-3 lg:px-4 py-2.5 lg:py-3 rounded-xl font-bold text-xs lg:text-sm transition-all ${
                activeSection === "audit"
                  ? "bg-discord-blurple text-white shadow-md"
                  : "text-discord-textMuted hover:bg-discord-surface hover:text-white"
              }`}
            >
              <FileText className="w-4 h-4 lg:w-5 lg:h-5" />
              <span>Bitácora de Auditoría</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveSection("hardware"); setFeedbackMsg(null); }}
              className={`w-full flex items-center gap-2.5 lg:gap-3 px-3 lg:px-4 py-2.5 lg:py-3 rounded-xl font-bold text-xs lg:text-sm transition-all ${
                activeSection === "hardware"
                  ? "bg-discord-blurple text-white shadow-md"
                  : "text-discord-textMuted hover:bg-discord-surface hover:text-white"
              }`}
            >
              <Radio className="w-4 h-4 lg:w-5 lg:h-5" />
              <span>Telemetría Hardware</span>
            </button>
          </nav>
        </div>

        <div className="pt-3 pb-1 border-t border-discord-hover flex flex-col gap-2 flex-shrink-0">
          <div className="text-[11px] lg:text-xs text-discord-textMuted truncate">
            Administrador: <span className="text-white font-bold">{adminUser.nombre_completo}</span>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 lg:py-3 rounded-xl bg-discord-red/20 hover:bg-discord-red text-discord-red hover:text-white font-bold text-xs lg:text-sm transition-all shadow-sm active:scale-95"
          >
            <LogOut className="w-4 h-4" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col p-4 lg:p-6 overflow-y-auto">
        {/* TOP 4 KPI CARDS BAR */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-4 lg:mb-6">
          <div className="p-3 lg:p-4 rounded-2xl bg-discord-surface border border-discord-hover shadow-md">
            <div className="flex items-center justify-between text-[11px] lg:text-xs font-bold text-discord-textMuted uppercase">
              <span>Saldo en Bóveda</span>
              <span className="text-discord-green font-mono font-bold">
                {metrics?.porcentaje_boveda?.toFixed(0) || 0}%
              </span>
            </div>
            <div className="text-xl lg:text-2xl font-black text-white font-mono mt-1">
              Q{metrics?.saldo_boveda?.toFixed(2) || "0.00"}
            </div>
            <div className="w-full h-1.5 lg:h-2 bg-discord-sidebar rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-discord-green transition-all duration-500"
                style={{ width: `${Math.min(100, metrics?.porcentaje_boveda || 0)}%` }}
              />
            </div>
            <div className="text-[10px] text-discord-textMuted mt-1 text-right">Tope máx: Q30,000.00</div>
          </div>

          <div className="p-3 lg:p-4 rounded-2xl bg-discord-surface border border-discord-hover shadow-md">
            <div className="text-[11px] lg:text-xs font-bold text-discord-textMuted uppercase flex items-center justify-between">
              <span>Billetes en Bóveda</span>
              <Banknote className="w-4 h-4 text-discord-blurple" />
            </div>
            <div className="text-xl lg:text-2xl font-black text-discord-blurple font-mono mt-1">
              {Object.values(metrics?.stock_boveda || {}).reduce((a: number, b: any) => a + Number(b), 0)} piezas
            </div>
            <div className="text-[10px] text-discord-textMuted mt-2">Inventario físico en 7 cartuchos</div>
          </div>

          <div className="p-3 lg:p-4 rounded-2xl bg-discord-surface border border-discord-hover shadow-md">
            <div className="text-[11px] lg:text-xs font-bold text-discord-textMuted uppercase flex items-center justify-between">
              <span>Cuentas Registradas</span>
              <Users className="w-4 h-4 text-discord-amber" />
            </div>
            <div className="text-xl lg:text-2xl font-black text-discord-amber font-mono mt-1">
              {metrics?.usuarios?.length || 0} activas
            </div>
            <div className="text-[10px] text-discord-textMuted mt-2">Tarjetas y usuarios habilitados</div>
          </div>

          <div className="p-3 lg:p-4 rounded-2xl bg-discord-surface border border-discord-hover shadow-md">
            <div className="text-[11px] lg:text-xs font-bold text-discord-textMuted uppercase">Estado Bóveda</div>
            <div className="flex items-center gap-2 mt-1">
              <div
                className={`w-2.5 h-2.5 lg:w-3 lg:h-3 rounded-full ${
                  metrics?.estado_inicializacion === "Inicializado" ? "bg-discord-green animate-pulse" : "bg-discord-amber"
                }`}
              />
              <span className="text-base lg:text-lg font-black text-white">{metrics?.estado_inicializacion || "Pendiente"}</span>
            </div>
            <div className="text-[10px] text-discord-textMuted mt-2">
              Último: {metrics?.ultimo_usuario?.nombre}
            </div>
          </div>
        </div>

        {feedbackMsg && (
          <div
            className={`p-3 lg:p-3.5 mb-4 lg:mb-6 rounded-xl border flex items-center gap-3 text-xs lg:text-sm font-medium animate-shake z-10 ${
              feedbackMsg.type === "success"
                ? "bg-discord-green/20 border-discord-green text-discord-green"
                : "bg-discord-red/20 border-discord-red text-discord-red"
            }`}
          >
            {feedbackMsg.type === "success" ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {/* SECTION 1: BOVEDA & ARQUEO */}
        {activeSection === "vault" && (
          <div className="space-y-4 lg:space-y-6">
            <div className="p-4 lg:p-5 bg-discord-surface rounded-2xl border border-discord-hover shadow-md">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <h2 className="text-base lg:text-lg font-black text-white flex items-center gap-2">
                  <Database className="w-5 h-5 text-discord-green" />
                  <span>Existencias Físicas en Cartuchos de Bóveda</span>
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowResetVaultModal(true)}
                    className="px-3 py-1.5 rounded-lg bg-discord-red/20 hover:bg-discord-red text-discord-red hover:text-white border border-discord-red/40 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reiniciar Bóveda (Q0.00)</span>
                  </button>
                  <button
                    type="button"
                    onClick={fetchMetrics}
                    className="px-3 py-1.5 rounded-lg bg-discord-sidebar hover:bg-discord-hover text-xs font-semibold text-discord-textMuted flex items-center gap-1.5 border border-discord-hover"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Actualizar</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-4 md:grid-cols-7 gap-2 lg:gap-3">
                {DENOMINATIONS.map((d) => {
                  const cnt = metrics?.denominaciones ? metrics.denominaciones[d] || 0 : 0;
                  const sub = d * cnt;
                  return (
                    <div
                      key={d}
                      className="p-2.5 lg:p-3.5 rounded-xl bg-discord-sidebar border border-discord-hover text-center"
                    >
                      <div className="font-extrabold text-base lg:text-xl text-white">Q{d}</div>
                      <div className="text-xl lg:text-2xl font-black font-mono text-discord-green my-0.5 lg:my-1">{cnt}</div>
                      <div className="text-[9px] lg:text-[10px] text-discord-textMuted uppercase font-bold">piezas</div>
                      <div className="text-[11px] lg:text-xs font-bold text-discord-textNormal mt-1 pt-1 border-t border-discord-hover">
                        Q{sub.toFixed(2)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* Inicialización Diaria */}
              <div className="p-5 bg-discord-surface rounded-2xl border border-discord-hover shadow-md">
                <h3 className="text-base font-black text-white mb-1 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-discord-amber" />
                  <span>Inicialización Diaria (Máx Q10,000.00)</span>
                </h3>
                <p className="text-xs text-discord-textMuted mb-4">
                  Carga inicial de piezas al arrancar la jornada. Reinicia los consumos diarios a cero.
                </p>

                <div className="grid grid-cols-4 gap-2 mb-4">
                  {DENOMINATIONS.map((d) => (
                    <div key={d} className="bg-discord-sidebar p-2 rounded-lg border border-discord-hover">
                      <div className="text-[11px] font-bold text-discord-textMuted">Q{d}:</div>
                      <input
                        type="number"
                        min="0"
                        value={initBills[d] || 0}
                        onChange={(e) =>
                          setInitBills({ ...initBills, [d]: Math.max(0, parseInt(e.target.value) || 0) })
                        }
                        className="w-full bg-transparent font-mono text-base font-bold text-white focus:outline-none"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-discord-hover">
                  <div>
                    <div className="text-xs text-discord-textMuted">Total a Inicializar:</div>
                    <div
                      className={`text-xl font-black font-mono ${
                        totalInit <= 10000 ? "text-discord-green" : "text-discord-red"
                      }`}
                    >
                      Q{totalInit.toFixed(2)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleInitializeVault}
                    disabled={totalInit <= 0 || totalInit > 10000}
                    className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
                      totalInit > 0 && totalInit <= 10000
                        ? "bg-discord-amber hover:bg-amber-400 text-black shadow-md font-extrabold"
                        : "bg-gray-700 text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    Inicializar Bóveda
                  </button>
                </div>
              </div>

              {/* Agregar Efectivo */}
              <div className="p-5 bg-discord-surface rounded-2xl border border-discord-hover shadow-md">
                <h3 className="text-base font-black text-white mb-1 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-discord-green" />
                  <span>Agregar Efectivo (Recarga a Bóveda)</span>
                </h3>
                <p className="text-xs text-discord-textMuted mb-4">
                  Recarga posterior de piezas. Bloqueado si el total consolidado superaría Q30,000.00.
                </p>

                <div className="grid grid-cols-4 gap-2 mb-4">
                  {DENOMINATIONS.map((d) => (
                    <div key={d} className="bg-discord-sidebar p-2 rounded-lg border border-discord-hover">
                      <div className="text-[11px] font-bold text-discord-textMuted">Q{d}:</div>
                      <input
                        type="number"
                        min="0"
                        value={addBills[d] || 0}
                        onChange={(e) =>
                          setAddBills({ ...addBills, [d]: Math.max(0, parseInt(e.target.value) || 0) })
                        }
                        className="w-full bg-transparent font-mono text-base font-bold text-white focus:outline-none"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-discord-hover">
                  <div>
                    <div className="text-xs text-discord-textMuted">Efectivo a Añadir:</div>
                    <div className="text-xl font-black font-mono text-discord-green">
                      Q{totalAdd.toFixed(2)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddCash}
                    disabled={totalAdd <= 0 || (metrics?.saldo_boveda || 0) + totalAdd > 30000}
                    className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
                      totalAdd > 0 && (metrics?.saldo_boveda || 0) + totalAdd <= 30000
                        ? "bg-discord-green hover:bg-emerald-400 text-black shadow-md font-extrabold"
                        : "bg-gray-700 text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    Confirmar Recarga
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 2: USUARIOS */}
        {activeSection === "users" && (
          <div className="p-5 bg-discord-surface rounded-2xl border border-discord-hover shadow-md">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-black text-white">Catálogo Maestro de Usuarios & Empleados</h2>
                <p className="text-xs text-discord-textMuted">
                  Preserva consumos de extracciones acumuladas al reasignar número de tarjeta
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewEmpModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-discord-blurple hover:bg-discord-blurpleHover text-white font-bold text-xs shadow-md"
              >
                <Plus className="w-4 h-4" />
                <span>Registrar Nuevo Empleado</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-discord-hover text-discord-textMuted font-bold uppercase">
                    <th className="py-2.5 px-3">ID</th>
                    <th className="py-2.5 px-3">Empleado</th>
                    <th className="py-2.5 px-3">Tarjeta (16 dígitos)</th>
                    <th className="py-2.5 px-3">Saldo</th>
                    <th className="py-2.5 px-3">Límite Diario</th>
                    <th className="py-2.5 px-3">Retirado Hoy</th>
                    <th className="py-2.5 px-3">Último Acceso</th>
                    <th className="py-2.5 px-3">Cambio PIN</th>
                    <th className="py-2.5 px-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-discord-hover">
                  {metrics?.usuarios?.map((u: any) => (
                    <tr key={u.id_usuario} className="hover:bg-discord-sidebar/60 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-white">{u.id_usuario}</td>
                      <td className="py-3 px-3 font-bold text-white">
                        {u.nombre_completo}
                        {u.rol === "ADMINISTRADOR" && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] bg-amber-950 text-amber-400 font-bold border border-amber-800">
                            ADMIN
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-discord-green font-bold tracking-wider">
                        {u.tarjeta}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-white">Q{u.saldo_actual?.toFixed(2)}</td>
                      <td className="py-3 px-3 font-mono text-discord-textMuted">Q{u.monto_max_diario?.toFixed(2)}</td>
                      <td className="py-3 px-3 font-mono text-discord-amber font-bold">
                        Q{u.total_retirado_hoy?.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-discord-textMuted">{u.ultimo_acceso}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            u.cambio_pin_realizado
                              ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                              : "bg-gray-800 text-gray-400"
                          }`}
                        >
                          {u.cambio_pin_realizado ? "Efectuado" : "Pendiente"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right space-x-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedUserForPin(u);
                            setNewPinValue("");
                            setPinModalError(null);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-discord-sidebar hover:bg-discord-hover text-discord-amber hover:text-white border border-discord-hover"
                          title="Cambiar PIN desde modo administrador"
                        >
                          Cambiar PIN
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedUserForLimit(u);
                            setNewLimitValue(u.monto_max_diario.toString());
                          }}
                          className="px-2.5 py-1 rounded-lg bg-discord-sidebar hover:bg-discord-hover text-discord-textMuted hover:text-white border border-discord-hover"
                        >
                          Modificar Límite
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedUserForCard(u);
                            setNewCardValue(u.tarjeta);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-discord-sidebar hover:bg-discord-hover text-discord-green hover:text-white border border-discord-hover"
                        >
                          Reasignar Plástico
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SECTION 3: ANALITICA DIARIA Y METRICAS AVANZADAS */}
        {activeSection === "analytics" && (
          <div className="space-y-4">
            {/* KPI Cards: Promedios y Totales */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
              <div className="p-4 rounded-2xl bg-discord-surface border border-discord-hover shadow-sm">
                <div className="flex items-center justify-between text-xs text-discord-textMuted font-bold uppercase mb-1">
                  <span>Promedio de Retiros</span>
                  <ArrowDownRight className="w-4 h-4 text-discord-amber" />
                </div>
                <div className="text-xl lg:text-2xl font-black font-mono text-discord-amber">
                  Q{metrics?.promedio_retiros?.toFixed(2) || "0.00"}
                </div>
                <div className="text-[11px] text-discord-textMuted mt-1">
                  {metrics?.conteo_retiros || 0} operaciones registradas
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-discord-surface border border-discord-hover shadow-sm">
                <div className="flex items-center justify-between text-xs text-discord-textMuted font-bold uppercase mb-1">
                  <span>Promedio de Depósitos</span>
                  <ArrowUpRight className="w-4 h-4 text-discord-green" />
                </div>
                <div className="text-xl lg:text-2xl font-black font-mono text-discord-green">
                  Q{metrics?.promedio_depositos?.toFixed(2) || "0.00"}
                </div>
                <div className="text-[11px] text-discord-textMuted mt-1">
                  {metrics?.conteo_depositos || 0} operaciones registradas
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-discord-surface border border-discord-hover shadow-sm">
                <div className="flex items-center justify-between text-xs text-discord-textMuted font-bold uppercase mb-1">
                  <span>Total Retirado</span>
                  <TrendingUp className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-xl lg:text-2xl font-black font-mono text-white">
                  Q{metrics?.total_retiros?.toFixed(2) || "0.00"}
                </div>
                <div className="text-[11px] text-discord-textMuted mt-1">
                  Hoy: Q{metrics?.total_retirado_hoy?.toFixed(2) || "0.00"}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-discord-surface border border-discord-hover shadow-sm">
                <div className="flex items-center justify-between text-xs text-discord-textMuted font-bold uppercase mb-1">
                  <span>Total Depositado</span>
                  <Database className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-xl lg:text-2xl font-black font-mono text-white">
                  Q{metrics?.total_depositos?.toFixed(2) || "0.00"}
                </div>
                <div className="text-[11px] text-discord-textMuted mt-1">
                  Acumulado contable global
                </div>
              </div>
            </div>

            {/* CHARTS ROW: GRAFICA DE PALITOS (TIMELINE) & GRAFICA DE PAYS (DONUT) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* GRAFICA DE PALITOS / BARRAS (LÍNEA DE TIEMPO) - 7 COLS */}
              <div className="col-span-1 lg:col-span-7 p-4 lg:p-5 bg-discord-surface rounded-2xl border border-discord-hover shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm lg:text-base font-black text-white flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-discord-blurple" />
                      <span>Línea de Tiempo y Promedio por Jornada</span>
                    </h3>
                    <div className="flex items-center gap-3 text-[11px] font-bold">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-discord-amber inline-block" />
                        <span className="text-discord-textMuted">Retiros</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-discord-green inline-block" />
                        <span className="text-discord-textMuted">Depósitos</span>
                      </div>
                    </div>
                  </div>

                  {/* SVG Bar Chart */}
                  <div className="w-full h-48 bg-discord-sidebar/60 rounded-xl p-3 border border-discord-hover flex flex-col justify-end">
                    {(!metrics?.historico_diario || metrics.historico_diario.length === 0) ? (
                      <div className="h-full flex items-center justify-center text-xs text-discord-textMuted">
                        Sin suficientes registros históricos para graficar.
                      </div>
                    ) : (
                      <div className="h-full flex items-end justify-around gap-2 pt-4">
                        {metrics.historico_diario.map((d: any, idx: number) => {
                          const maxVal = Math.max(
                            ...metrics.historico_diario.map((x: any) => Math.max(x.retiros || 0, x.depositos || 0)),
                            100
                          );
                          const hRetiro = Math.max(4, Math.round(((d.retiros || 0) / maxVal) * 120));
                          const hDeposito = Math.max(4, Math.round(((d.depositos || 0) / maxVal) * 120));

                          return (
                            <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full group">
                              <div className="flex items-end gap-1.5 w-full justify-center">
                                {/* Barra de Retiro (Ámbar) */}
                                <div
                                  style={{ height: `${hRetiro}px` }}
                                  className="w-3.5 sm:w-5 bg-discord-amber hover:bg-amber-400 rounded-t-md transition-all shadow-sm relative group-hover:scale-105"
                                  title={`Retiros: Q${Number(d.retiros).toFixed(2)} (Prom: Q${Number(d.promedio_retiro || 0).toFixed(2)})`}
                                />
                                {/* Barra de Depósito (Verde) */}
                                <div
                                  style={{ height: `${hDeposito}px` }}
                                  className="w-3.5 sm:w-5 bg-discord-green hover:bg-emerald-400 rounded-t-md transition-all shadow-sm relative group-hover:scale-105"
                                  title={`Depósitos: Q${Number(d.depositos).toFixed(2)} (Prom: Q${Number(d.promedio_deposito || 0).toFixed(2)})`}
                                />
                              </div>
                              <span className="text-[10px] font-mono font-bold text-discord-textMuted mt-2 truncate max-w-[55px]">
                                {d.fecha.length > 5 ? d.fecha.slice(5) : d.fecha}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-[11px] text-discord-textMuted mt-3 flex items-center justify-between">
                  <span>Histograma diario comparativo de volumen financiero</span>
                  <span className="font-mono text-white font-bold">Base 7 días</span>
                </div>
              </div>

              {/* GRAFICA DE PAYS / TORTA (DONUT SVG) - 5 COLS */}
              <div className="col-span-1 lg:col-span-5 p-4 lg:p-5 bg-discord-surface rounded-2xl border border-discord-hover shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-sm lg:text-base font-black text-white mb-3 flex items-center gap-2">
                    <PieChart className="w-5 h-5 text-discord-green" />
                    <span>Distribución Proporcional (Gráfica de Pay)</span>
                  </h3>

                  {(() => {
                    const totalVol = (metrics?.total_retiros || 0) + (metrics?.total_depositos || 0);
                    const pctRetiro = totalVol > 0 ? ((metrics?.total_retiros || 0) / totalVol) * 100 : 50;
                    const pctDeposito = totalVol > 0 ? ((metrics?.total_depositos || 0) / totalVol) * 100 : 50;
                    const circumference = 251.2;
                    const strokeRetiro = (pctRetiro / 100) * circumference;

                    return (
                      <div className="flex flex-col sm:flex-row items-center justify-around gap-4 p-3 bg-discord-sidebar/60 rounded-xl border border-discord-hover">
                        {/* Circular Donut SVG */}
                        <div className="relative w-32 h-32 flex-shrink-0 flex items-center justify-center">
                          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                            <circle
                              cx="50"
                              cy="50"
                              r="40"
                              stroke="var(--atm-color-green)"
                              strokeWidth="12"
                              fill="transparent"
                            />
                            <circle
                              cx="50"
                              cy="50"
                              r="40"
                              stroke="var(--atm-color-amber)"
                              strokeWidth="12"
                              fill="transparent"
                              strokeDasharray={`${strokeRetiro} ${circumference}`}
                              strokeLinecap="round"
                              className="transition-all duration-700 ease-out"
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-xs font-bold text-discord-textMuted uppercase">Flujo</span>
                            <span className="text-sm font-black font-mono text-white">
                              Q{totalVol >= 1000 ? `${(totalVol / 1000).toFixed(1)}k` : totalVol.toFixed(0)}
                            </span>
                          </div>
                        </div>

                        {/* Leyenda y Porcentajes */}
                        <div className="space-y-2 text-xs w-full sm:w-auto">
                          <div className="p-2 rounded-lg bg-discord-surface border border-amber-900/40">
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-bold text-discord-amber flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-discord-amber inline-block" />
                                Retiros ({pctRetiro.toFixed(1)}%)
                              </span>
                              <span className="font-mono font-black text-white">
                                Q{metrics?.total_retiros?.toFixed(2) || "0.00"}
                              </span>
                            </div>
                          </div>

                          <div className="p-2 rounded-lg bg-discord-surface border border-emerald-900/40">
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-bold text-discord-green flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-discord-green inline-block" />
                                Depósitos ({pctDeposito.toFixed(1)}%)
                              </span>
                              <span className="font-mono font-black text-white">
                                Q{metrics?.total_depositos?.toFixed(2) || "0.00"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="text-[11px] text-discord-textMuted mt-3">
                  Participación porcentual de fondos transaccionados en ventanilla
                </div>
              </div>
            </div>

            {/* Bottom Row: Balance Contable Neto y Estado Operativo */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="p-4 bg-discord-surface rounded-2xl border border-discord-hover shadow-sm">
                <h3 className="text-sm font-black text-white mb-2">Balance Neto en Ventanilla</h3>
                {(() => {
                  const neto = (metrics?.total_depositos || 0) - (metrics?.total_retiros || 0);
                  const isPositive = neto >= 0;
                  return (
                    <div>
                      <div className="flex justify-between items-center text-xs font-bold mb-1">
                        <span className="text-discord-textMuted">Flujo Neto (Depósitos - Retiros)</span>
                        <span className={`font-mono text-base font-black ${isPositive ? "text-discord-green" : "text-discord-red"}`}>
                          {isPositive ? "+" : ""}Q{neto.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-[11px] text-discord-textMuted mt-1">
                        {isPositive 
                          ? "Superávit de efectivo ingresado a favor del cajero." 
                          : "Déficit compensado con reservas de bóveda."}
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="p-4 bg-discord-surface rounded-2xl border border-discord-hover shadow-sm flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-discord-textMuted uppercase">Último Usuario Conectado</div>
                  <div className="text-sm font-bold text-white mt-0.5">{metrics?.ultimo_usuario?.nombre || "Ninguno"}</div>
                  <div className="text-[11px] font-mono text-discord-textMuted">{metrics?.ultimo_usuario?.timestamp}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-discord-textMuted uppercase">Usuarios con PIN Nuevo</div>
                  <div className="text-xl font-black font-mono text-discord-green mt-0.5">
                    {metrics?.usuarios_cambio_pin || 0}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 4: AUDITORIA CON VISUALIZACION DE RETIROS Y TRANSACCIONES */}
        {activeSection === "audit" && (
          <div className="p-5 bg-discord-surface rounded-2xl border border-discord-hover shadow-md space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-discord-hover">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-discord-blurple" />
                  <span>Bitácora de Auditoría y Transacciones Financieras</span>
                </h2>
                <p className="text-xs text-discord-textMuted mt-0.5">
                  Registro inmutable de retiros en efectivo, depósitos, accesos de seguridad y dispensación física
                </p>
              </div>

              {/* Filter Tabs & Print Certificate */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-discord-sidebar border border-discord-hover text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setAuditFilter("all")}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      auditFilter === "all" ? "bg-discord-blurple text-white shadow-sm" : "text-discord-textMuted hover:text-white"
                    }`}
                  >
                    <span>Todos los Eventos</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuditFilter("withdrawals")}
                    className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                      auditFilter === "withdrawals" ? "bg-discord-amber text-black shadow-sm font-extrabold" : "text-discord-amber/80 hover:text-discord-amber"
                    }`}
                  >
                    <ArrowDownRight className="w-3.5 h-3.5" />
                    <span>💸 Retiros</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuditFilter("deposits")}
                    className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                      auditFilter === "deposits" ? "bg-discord-green text-black shadow-sm font-extrabold" : "text-discord-green/80 hover:text-discord-green"
                    }`}
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>📥 Depósitos</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuditFilter("system")}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      auditFilter === "system" ? "bg-purple-600 text-white shadow-sm" : "text-discord-textMuted hover:text-white"
                    }`}
                  >
                    <span>⚙️ Eventos de Sistema</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handlePrintAuditCertificate}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-all active:scale-95"
                  title="Generar Certificado Oficial de Auditoría en PDF"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir Certificado (PDF)</span>
                </button>
              </div>
            </div>

            {/* Content Display based on filter */}
            <div className="space-y-2.5 max-h-[540px] overflow-y-auto pr-1">
              {/* RETIROS VIEW */}
              {(auditFilter === "withdrawals" || auditFilter === "all") && (
                <div className="space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-discord-amber flex items-center gap-1.5 pt-1">
                    <ArrowDownRight className="w-4 h-4" />
                    <span>Retiros de Efectivo Registrados</span>
                  </div>

                  {(!metrics?.transacciones || metrics.transacciones.filter((t: any) => t.tipo === "RETIRO").length === 0) ? (
                    <div className="p-4 text-center text-xs text-discord-textMuted bg-discord-sidebar/50 rounded-xl border border-discord-hover">
                      Sin retiros registrados hasta el momento.
                    </div>
                  ) : (
                    metrics.transacciones
                      .filter((t: any) => t.tipo === "RETIRO")
                      .map((tx: any) => (
                        <div
                          key={`tx-${tx.id_transaccion}`}
                          className="p-3.5 rounded-xl bg-discord-sidebar border border-amber-900/40 hover:border-amber-600/60 transition-all flex items-start justify-between text-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-mono font-bold text-[10px]">
                                RETIRO #{tx.id_transaccion}
                              </span>
                              <span className="font-extrabold text-white text-sm">
                                {tx.nombre_usuario}
                              </span>
                              <span className="font-mono text-[11px] text-discord-textMuted">
                                (Tarjeta: {tx.tarjeta})
                              </span>
                            </div>

                            <div className="flex items-center gap-2 pt-1 text-[11px]">
                              <span className="text-discord-textMuted">Desglose físico dispensado:</span>
                              <div className="flex flex-wrap gap-1">
                                {Object.entries(tx.desglose || {}).map(([d, c]: [string, any]) => (
                                  <span
                                    key={d}
                                    className="px-1.5 py-0.5 rounded bg-discord-surface border border-discord-hover font-mono font-semibold text-amber-200 text-[10px]"
                                  >
                                    Q{d} x {c}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                            <div className="text-right">
                              <div className="text-base font-black font-mono text-discord-amber">
                                Q{tx.monto?.toFixed(2)}
                              </div>
                              <div className="text-[10px] font-mono text-discord-textMuted mt-0.5">
                                {tx.fecha_hora}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveVoucher({
                                  id: tx.id_transaccion,
                                  tipo: "RETIRO",
                                  titulo: "COMPROBANTE DE RETIRO DE EFECTIVO",
                                  cliente: tx.nombre_usuario,
                                  tarjeta: tx.tarjeta,
                                  monto: tx.monto,
                                  desglose: tx.desglose,
                                  fecha_hora: tx.fecha_hora
                                });
                              }}
                              className="p-1.5 rounded-lg bg-discord-surface hover:bg-discord-hover text-discord-textMuted hover:text-white border border-discord-hover transition-all"
                              title="Imprimir Voucher"
                            >
                              <Printer className="w-3.5 h-3.5 text-blue-400" />
                            </button>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              )}

              {/* DEPOSITOS VIEW */}
              {(auditFilter === "deposits" || auditFilter === "all") && (
                <div className="space-y-2 mt-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-discord-green flex items-center gap-1.5 pt-2 border-t border-discord-hover/60">
                    <ArrowUpRight className="w-4 h-4" />
                    <span>Depósitos de Efectivo Registrados</span>
                  </div>

                  {(!metrics?.transacciones || metrics.transacciones.filter((t: any) => t.tipo === "DEPOSITO").length === 0) ? (
                    <div className="p-4 text-center text-xs text-discord-textMuted bg-discord-sidebar/50 rounded-xl border border-discord-hover">
                      Sin depósitos registrados hasta el momento.
                    </div>
                  ) : (
                    metrics.transacciones
                      .filter((t: any) => t.tipo === "DEPOSITO")
                      .map((tx: any) => (
                        <div
                          key={`tx-${tx.id_transaccion}`}
                          className="p-3.5 rounded-xl bg-discord-sidebar border border-emerald-900/40 hover:border-emerald-600/60 transition-all flex items-start justify-between text-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono font-bold text-[10px]">
                                DEPÓSITO #{tx.id_transaccion}
                              </span>
                              <span className="font-extrabold text-white text-sm">
                                {tx.nombre_usuario}
                              </span>
                              <span className="font-mono text-[11px] text-discord-textMuted">
                                (Tarjeta: {tx.tarjeta})
                              </span>
                            </div>

                            <div className="flex items-center gap-2 pt-1 text-[11px]">
                              <span className="text-discord-textMuted">Piezas introducidas:</span>
                              <div className="flex flex-wrap gap-1">
                                {Object.entries(tx.desglose || {}).map(([d, c]: [string, any]) => (
                                  <span
                                    key={d}
                                    className="px-1.5 py-0.5 rounded bg-discord-surface border border-discord-hover font-mono font-semibold text-emerald-200 text-[10px]"
                                  >
                                    Q{d} x {c}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                            <div className="text-right">
                              <div className="text-base font-black font-mono text-discord-green">
                                +Q{tx.monto?.toFixed(2)}
                              </div>
                              <div className="text-[10px] font-mono text-discord-textMuted mt-0.5">
                                {tx.fecha_hora}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveVoucher({
                                  id: tx.id_transaccion,
                                  tipo: "DEPOSITO",
                                  titulo: "COMPROBANTE DE DEPÓSITO EN EFECTIVO",
                                  cliente: tx.nombre_usuario,
                                  tarjeta: tx.tarjeta,
                                  monto: tx.monto,
                                  desglose: tx.desglose,
                                  fecha_hora: tx.fecha_hora
                                });
                              }}
                              className="p-1.5 rounded-lg bg-discord-surface hover:bg-discord-hover text-discord-textMuted hover:text-white border border-discord-hover transition-all"
                              title="Imprimir Voucher"
                            >
                              <Printer className="w-3.5 h-3.5 text-blue-400" />
                            </button>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              )}

              {/* SYSTEM AUDIT LOGS VIEW */}
              {(auditFilter === "system" || auditFilter === "all") && (
                <div className="space-y-2 mt-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-discord-textMuted flex items-center gap-1.5 pt-2 border-t border-discord-hover/60">
                    <FileText className="w-4 h-4 text-discord-blurple" />
                    <span>Eventos de Seguridad & Bitácora de Auditoría (auditoria_eventos.txt)</span>
                  </div>

                  {metrics?.auditoria?.map((log: any) => (
                    <div
                      key={`log-${log.id_log}`}
                      className="p-3 rounded-xl bg-discord-sidebar/70 border border-discord-hover flex items-start justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2 font-bold text-white">
                          <span className="px-2 py-0.5 rounded bg-discord-surface text-discord-blurple border border-discord-hover font-mono text-[10px]">
                            #{log.id_log}
                          </span>
                          <span className="text-discord-blurple font-mono">{log.accion}</span>
                          {log.id_usuario && (
                            <span className="text-discord-textMuted font-normal">(Usuario ID {log.id_usuario})</span>
                          )}
                        </div>
                        <p className="text-discord-textNormal mt-1 leading-relaxed">{log.detalles}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                        <span className="font-mono text-[11px] text-discord-textMuted">
                          {log.fecha_hora}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveVoucher({
                              id: log.id_log,
                              tipo: "AUDITORIA",
                              titulo: `EVENTO DE AUDITORÍA: ${log.accion}`,
                              cliente: adminUser?.nombre_completo || "ADMINISTRADOR",
                              detalles_extra: log.detalles,
                              fecha_hora: log.fecha_hora
                            });
                          }}
                          className="p-1.5 rounded-lg bg-discord-surface hover:bg-discord-hover text-discord-textMuted hover:text-white border border-discord-hover transition-all"
                          title="Imprimir Constancia"
                        >
                          <Printer className="w-3.5 h-3.5 text-purple-400" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SECTION 5: TELEMETRIA HARDWARE (ESP32 & RFID RC522) */}
        {activeSection === "hardware" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
            {/* CARD 1: ESP32 CENTRAL CONTROLLER */}
            <div className="p-4 lg:p-5 bg-discord-surface rounded-2xl border border-discord-hover shadow-md flex flex-col justify-between">
              <div>
                <h2 className="text-base lg:text-lg font-black text-white mb-4 flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-discord-green" />
                  <span>Controlador Central ESP32 &amp; Mecanismos</span>
                </h2>

                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-discord-sidebar border border-discord-hover flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white text-xs lg:text-sm">Enlace UART & Bus SPI con RFID</div>
                      <div className="text-[11px] text-discord-textMuted">
                        Monitoreo continuo de señales de radiofrecuencia (13.56 MHz MFRC522).
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-discord-green/20 text-discord-green border border-discord-green/40">
                      Sincronizado
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-discord-sidebar border border-discord-hover space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-discord-textMuted">Microcontrolador:</span>
                      <span className="font-mono text-white font-bold">ESP32 DevKit V1 (WROOM-32)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-discord-textMuted">Puerto Configurado:</span>
                      <span className="font-mono text-white font-bold">{hardwareStatus?.esp32_port || "COM3"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-discord-textMuted">Baudios Serie:</span>
                      <span className="font-mono text-white">{hardwareStatus?.esp32_baudrate || 115200} baud</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-discord-textMuted">Estado de Conexión:</span>
                      <span className={hardwareStatus?.esp32_connected ? "text-discord-green font-bold" : "text-discord-amber font-bold"}>
                        {hardwareStatus?.esp32_connected ? "Enlace Físico / Emulador Activo" : "Desconectado"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-discord-textMuted">Sincronización TOTP:</span>
                      <span className="text-discord-green font-bold">Criptografía Activa (6 dígitos)</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 rounded-xl bg-discord-sidebar/60 border border-discord-hover text-[11px] text-discord-textMuted leading-relaxed">
                El ESP32 centraliza el bus SPI con el lector RFID RC522 para lectura de tarjetas físicas de autoservicio y la orquestación segura del sistema de dispensación.
              </div>
            </div>

            {/* CARD 2: RFID RC522 & MODO DE DEPURACION */}
            <div className="p-4 lg:p-5 bg-discord-surface rounded-2xl border border-discord-hover shadow-md flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base lg:text-lg font-black text-white flex items-center gap-2">
                    <Radio className="w-5 h-5 text-discord-blurple" />
                    <span>Módulo RFID RC522 &amp; Modo Depuración</span>
                  </h2>
                  <button
                    type="button"
                    onClick={handleToggleRfidDebug}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                      hardwareStatus?.debug_mode
                        ? "bg-discord-blurple text-white border-discord-blurple shadow-sm"
                        : "bg-discord-sidebar text-discord-textMuted border-discord-hover"
                    }`}
                  >
                    {hardwareStatus?.debug_mode ? "Depuración: ON" : "Depuración: OFF"}
                  </button>
                </div>

                {/* RFID State Summary */}
                <div className="p-3 rounded-xl bg-discord-sidebar border border-discord-hover mb-3 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-discord-textMuted">Estado Lector RFID:</span>
                    <span className="font-bold text-discord-green">MFRC522 (Bus SPI) Listo</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-discord-textMuted">Último UID detectado:</span>
                    <span className="font-mono text-discord-amber font-bold">{hardwareStatus?.last_scanned_uid || "Ninguno"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-discord-textMuted">Última Tarjeta Leída:</span>
                    <span className="font-mono text-white font-bold">{hardwareStatus?.last_scanned_card || "En espera de lectura..."}</span>
                  </div>
                </div>

                {/* Interactive RFID Card Tap Simulator */}
                <div className="p-3.5 rounded-xl bg-discord-sidebar border border-discord-hover space-y-2.5">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-discord-blurple" />
                    <span>Simular Acercar Tarjeta Física RFID</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => { setRfidDebugCard("1234567812345678"); setRfidDebugUid("B4:5A:21:8F"); }}
                      className="px-2 py-1 rounded bg-discord-surface hover:bg-discord-hover text-[11px] font-medium text-white border border-discord-hover"
                    >
                      👤 Carlos (Emp 1)
                    </button>
                    <button
                      type="button"
                      onClick={() => { setRfidDebugCard("2345678923456789"); setRfidDebugUid("3C:88:9A:12"); }}
                      className="px-2 py-1 rounded bg-discord-surface hover:bg-discord-hover text-[11px] font-medium text-white border border-discord-hover"
                    >
                      👤 María (Emp 2)
                    </button>
                    <button
                      type="button"
                      onClick={() => { setRfidDebugCard("3456789034567890"); setRfidDebugUid("7D:14:4E:99"); }}
                      className="px-2 py-1 rounded bg-discord-surface hover:bg-discord-hover text-[11px] font-medium text-white border border-discord-hover"
                    >
                      👤 Juan (Emp 3)
                    </button>
                    <button
                      type="button"
                      onClick={() => { setRfidDebugCard("9999888877776666"); setRfidDebugUid("A1:F0:3B:55"); }}
                      className="px-2 py-1 rounded bg-amber-950/70 hover:bg-amber-900 text-[11px] font-bold text-amber-300 border border-amber-800"
                    >
                      🛡️ Admin
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-discord-textMuted block mb-0.5">N° Tarjeta (16 d):</label>
                      <input
                        type="text"
                        maxLength={16}
                        value={rfidDebugCard}
                        onChange={(e) => setRfidDebugCard(e.target.value.replace(/\D/g, "").slice(0, 16))}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-discord-surface border border-discord-hover font-mono text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-discord-textMuted block mb-0.5">UID Hexadecimal:</label>
                      <input
                        type="text"
                        value={rfidDebugUid}
                        onChange={(e) => setRfidDebugUid(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-discord-surface border border-discord-hover font-mono text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSimulateRfidTap}
                    disabled={rfidTapping || rfidDebugCard.length !== 16}
                    className={`w-full py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 ${
                      rfidDebugCard.length === 16 && !rfidTapping
                        ? "bg-discord-blurple hover:bg-discord-blurpleHover text-white shadow-glow"
                        : "bg-gray-700 text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    <Radio className="w-4 h-4" />
                    <span>{rfidTapping ? "Procesando Lectura..." : "Simular Acercar Tarjeta RFID (Tap Card)"}</span>
                  </button>
                </div>

                {/* Real-time Debug Logs Console */}
                <div className="mt-3">
                  <div className="text-[11px] font-bold text-discord-textMuted uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Terminal className="w-3.5 h-3.5 text-discord-green" />
                    <span>Consola de Telemetría ESP32 en Vivo:</span>
                  </div>
                  <div className="h-28 overflow-y-auto p-2.5 rounded-xl bg-black/60 border border-discord-hover font-mono text-[10px] space-y-1 select-text">
                    {hardwareStatus?.debug_logs && hardwareStatus.debug_logs.length > 0 ? (
                      hardwareStatus.debug_logs.map((log: any, idx: number) => (
                        <div key={idx} className="leading-tight">
                          <span className="text-gray-500">[{log.timestamp}]</span>{" "}
                          <span className={log.level === "SUCCESS" ? "text-discord-green font-bold" : log.level === "WARN" ? "text-discord-amber" : "text-gray-300"}>
                            {log.message}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-gray-500">Esperando eventos de hardware...</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: REINICIAR BOVEDA A CERO */}
      {showResetVaultModal && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50">
          <div className="max-w-md w-full p-6 bg-discord-surface rounded-2xl border-2 border-discord-red/70 shadow-2xl animate-shake">
            <div className="flex items-center gap-3 text-discord-red mb-3">
              <AlertTriangle className="w-7 h-7 flex-shrink-0" />
              <h3 className="text-lg font-black text-white">¿Reiniciar Bóveda y Cajero a Cero?</h3>
            </div>
            <p className="text-xs text-discord-textNormal leading-relaxed mb-4">
              Esta acción forzará el vaciado de todas las existencias en los 7 cartuchos de billetes (Q200, Q100, Q50, Q20, Q10, Q5, Q1).
              <br /><br />
              El saldo caerá nuevamente a <strong className="text-discord-red font-mono font-bold">Q0.00</strong>, los consumos diarios acumulados de todos los empleados volverán a cero, y el cajero pasará a estado <em>Pendiente</em> requiriendo una nueva inicialización diaria para que los clientes puedan operar.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowResetVaultModal(false)}
                className="px-4 py-2 rounded-xl bg-discord-sidebar hover:bg-discord-hover text-discord-textMuted text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleResetVault}
                disabled={resettingVault}
                className="px-5 py-2 rounded-xl bg-discord-red hover:bg-red-600 text-white text-xs font-extrabold shadow-md flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{resettingVault ? "Reiniciando..." : "Confirmar Reinicio a Cero"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MODIFICAR LIMITE DIARIO */}
      {selectedUserForLimit && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="max-w-md w-full p-6 bg-discord-surface rounded-2xl border border-discord-hover shadow-2xl">
            <h3 className="text-lg font-black text-white mb-2">Modificar Límite Diario de Retiro</h3>
            <p className="text-xs text-discord-textMuted mb-4">
              Empleado: <span className="text-white font-bold">{selectedUserForLimit.nombre_completo}</span>
            </p>
            <div className="mb-4">
              <label className="text-xs font-semibold text-discord-textMuted block mb-1">
                Nuevo Tope Máximo Diario (Q.):
              </label>
              <input
                type="number"
                value={newLimitValue}
                onChange={(e) => setNewLimitValue(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-discord-sidebar border border-discord-hover font-mono text-xl text-white focus:outline-none focus:border-discord-blurple"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedUserForLimit(null)}
                className="px-4 py-2 rounded-xl bg-discord-sidebar hover:bg-discord-hover text-discord-textMuted text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveLimit}
                className="px-5 py-2 rounded-xl bg-discord-blurple hover:bg-discord-blurpleHover text-white text-xs font-bold shadow-md"
              >
                Guardar Límite
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REASIGNAR TARJETA */}
      {selectedUserForCard && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="max-w-md w-full p-6 bg-discord-surface rounded-2xl border border-discord-hover shadow-2xl">
            <h3 className="text-lg font-black text-white mb-2">Reasignación de Tarjeta Plástica</h3>
            <p className="text-xs text-discord-textMuted mb-3">
              Empleado: <span className="text-white font-bold">{selectedUserForCard.nombre_completo}</span>
              <br />
              <span className="text-discord-amber text-[11px]">
                * Se preserva el récord histórico de consumos y extracciones acumuladas.
              </span>
            </p>

            {reassignModalError && (
              <div className="p-3 mb-3 rounded-xl bg-discord-red/20 border border-discord-red text-discord-red text-xs font-semibold flex items-center gap-2 animate-shake">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{reassignModalError}</span>
              </div>
            )}

            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-discord-textMuted">
                  Nuevo Número de Tarjeta (16 dígitos):
                </label>
                <span className={`text-[11px] font-mono font-bold ${
                  newCardValue.length === 16 ? "text-discord-green" : "text-discord-amber"
                }`}>
                  {newCardValue.length === 16 ? "✓ 16/16" : `${newCardValue.length}/16`}
                </span>
              </div>
              <input
                type="text"
                maxLength={16}
                value={newCardValue}
                onChange={(e) => {
                  setReassignModalError(null);
                  setNewCardValue(e.target.value.replace(/\D/g, "").slice(0, 16));
                }}
                className="w-full px-4 py-2.5 rounded-xl bg-discord-sidebar border border-discord-hover font-mono text-lg text-discord-green font-bold focus:outline-none focus:border-discord-blurple tracking-wider"
              />
              <div className="mt-1 text-[11px]">
                {newCardValue.length === 16 ? (
                  <span className="text-discord-green font-semibold">✓ 16 dígitos completos válidos.</span>
                ) : (
                  <span className="text-discord-amber font-semibold">
                    ⚠️ {newCardValue.length === 0 ? "Ingrese los 16 dígitos de la tarjeta." : `Faltan ${16 - newCardValue.length} dígitos para completar los 16.`}
                  </span>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setSelectedUserForCard(null); setReassignModalError(null); }}
                className="px-4 py-2 rounded-xl bg-discord-sidebar hover:bg-discord-hover text-discord-textMuted text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveCard}
                className="px-5 py-2 rounded-xl bg-discord-green hover:bg-emerald-400 text-black text-xs font-extrabold shadow-md"
              >
                Reasignar Plástico
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CAMBIAR PIN (ADMIN) */}
      {selectedUserForPin && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="max-w-md w-full p-6 bg-discord-surface rounded-2xl border border-discord-hover shadow-2xl">
            <div className="flex items-center gap-2 mb-2">
              <Key className="w-5 h-5 text-discord-amber" />
              <h3 className="text-lg font-black text-white">Cambio de PIN Administrativo</h3>
            </div>
            <p className="text-xs text-discord-textMuted mb-3">
              Empleado: <span className="text-white font-bold">{selectedUserForPin.nombre_completo}</span>
              <br />
              <span className="text-discord-textMuted text-[11px]">
                Tarjeta: <span className="font-mono text-discord-green">{selectedUserForPin.tarjeta}</span>
              </span>
            </p>

            {pinModalError && (
              <div className="p-3 mb-3 rounded-xl bg-discord-red/20 border border-discord-red text-discord-red text-xs font-semibold flex items-center gap-2 animate-shake">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{pinModalError}</span>
              </div>
            )}

            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-discord-textMuted">
                  Nuevo PIN Confidencial (4 dígitos):
                </label>
                <span className={`text-[11px] font-mono font-bold ${
                  newPinValue.length === 4 ? "text-discord-green" : "text-discord-amber"
                }`}>
                  {newPinValue.length === 4 ? "✓ 4/4" : `${newPinValue.length}/4`}
                </span>
              </div>
              <input
                type="password"
                maxLength={4}
                value={newPinValue}
                onChange={(e) => {
                  setPinModalError(null);
                  setNewPinValue(e.target.value.replace(/\D/g, "").slice(0, 4));
                }}
                className="w-full px-4 py-2.5 rounded-xl bg-discord-sidebar border border-discord-hover font-mono text-xl text-center text-discord-amber font-bold tracking-widest focus:outline-none focus:border-discord-blurple"
                placeholder="••••"
                autoFocus
              />
              <div className="mt-1 text-[11px]">
                {newPinValue.length === 4 ? (
                  <span className="text-discord-green font-semibold">✓ 4 dígitos ingresados correctamente.</span>
                ) : (
                  <span className="text-discord-amber font-semibold">
                    ⚠️ {newPinValue.length === 0 ? "Ingrese el nuevo PIN de 4 dígitos." : `Faltan ${4 - newPinValue.length} dígitos para completar el PIN.`}
                  </span>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setSelectedUserForPin(null); setNewPinValue(""); setPinModalError(null); }}
                className="px-4 py-2 rounded-xl bg-discord-sidebar hover:bg-discord-hover text-discord-textMuted text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSavePin}
                disabled={newPinValue.length !== 4}
                className={`px-5 py-2 rounded-xl text-xs font-extrabold shadow-md transition-all ${
                  newPinValue.length === 4
                    ? "bg-discord-amber hover:bg-amber-400 text-black cursor-pointer"
                    : "bg-gray-700 text-gray-500 cursor-not-allowed"
                }`}
              >
                Actualizar PIN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR EMPLEADO */}
      {showNewEmpModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="max-w-md w-full p-6 bg-discord-surface rounded-2xl border border-discord-hover shadow-2xl">
            <h3 className="text-lg font-black text-white mb-2">Registro de Nuevo Empleado</h3>

            {newEmpModalError && (
              <div className="p-3 mb-3 rounded-xl bg-discord-red/20 border border-discord-red text-discord-red text-xs font-semibold flex items-center gap-2 animate-shake">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{newEmpModalError}</span>
              </div>
            )}

            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs font-semibold text-discord-textMuted block mb-1">Nombre Completo:</label>
                <input
                  type="text"
                  value={newEmpName}
                  onChange={(e) => {
                    setNewEmpModalError(null);
                    setNewEmpName(e.target.value);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-discord-sidebar border border-discord-hover text-sm text-white focus:outline-none"
                  placeholder="Ej. Luis Ramírez"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-discord-textMuted">Tarjeta (16 dígitos):</label>
                  <span className={`text-[11px] font-mono font-bold ${
                    newEmpCard.length === 16 ? "text-discord-green" : "text-discord-amber"
                  }`}>
                    {newEmpCard.length === 16 ? "✓ 16/16" : `${newEmpCard.length}/16`}
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={16}
                  value={newEmpCard}
                  onChange={(e) => {
                    setNewEmpModalError(null);
                    setNewEmpCard(e.target.value.replace(/\D/g, "").slice(0, 16));
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-discord-sidebar border border-discord-hover font-mono text-sm text-discord-green font-bold focus:outline-none tracking-wider"
                  placeholder="6789012345678901"
                />
                <div className="mt-1 text-[11px]">
                  {newEmpCard.length === 16 ? (
                    <span className="text-discord-green font-semibold">✓ 16 dígitos completos válidos.</span>
                  ) : (
                    <span className="text-discord-amber font-semibold">
                      ⚠️ {newEmpCard.length === 0 ? "Ingrese los 16 dígitos numéricos." : `Faltan ${16 - newEmpCard.length} dígitos para completar los 16.`}
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-discord-textMuted block mb-1">PIN (4 d):</label>
                  <input
                    type="password"
                    maxLength={4}
                    value={newEmpPin}
                    onChange={(e) => {
                      setNewEmpModalError(null);
                      setNewEmpPin(e.target.value.replace(/\D/g, "").slice(0, 4));
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-discord-sidebar border border-discord-hover font-mono text-sm text-white focus:outline-none text-center"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-discord-textMuted block mb-1">Saldo Ini:</label>
                  <input
                    type="number"
                    value={newEmpBalance}
                    onChange={(e) => setNewEmpBalance(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-discord-sidebar border border-discord-hover font-mono text-sm text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-discord-textMuted block mb-1">Límite D:</label>
                  <input
                    type="number"
                    value={newEmpLimit}
                    onChange={(e) => setNewEmpLimit(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-discord-sidebar border border-discord-hover font-mono text-sm text-white focus:outline-none"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setShowNewEmpModal(false); setNewEmpModalError(null); }}
                className="px-4 py-2 rounded-xl bg-discord-sidebar hover:bg-discord-hover text-discord-textMuted text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRegisterEmployee}
                className="px-5 py-2 rounded-xl bg-discord-blurple hover:bg-discord-blurpleHover text-white text-xs font-bold shadow-md"
              >
                Crear Empleado
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VOUCHER MODAL */}
      {activeVoucher && (
        <VoucherModal voucher={activeVoucher} onClose={() => setActiveVoucher(null)} />
      )}
    </div>
  );
};
