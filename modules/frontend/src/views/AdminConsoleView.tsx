import React, { useState, useEffect } from "react";
import {
  Shield, Users, BarChart3, FileText, LogOut, Database,
  AlertCircle, CheckCircle2, RefreshCw, Plus, Radio, Video
} from "lucide-react";
import { adminService, hardwareService } from "../services/api";

interface AdminConsoleViewProps {
  adminUser: any;
  onLogout: () => void;
}

const DENOMINATIONS = [200, 100, 50, 20, 10, 5, 1];

export const AdminConsoleView: React.FC<AdminConsoleViewProps> = ({ adminUser, onLogout }) => {
  const [activeSection, setActiveSection] = useState<"vault" | "users" | "analytics" | "audit" | "hardware">("vault");
  const [metrics, setMetrics] = useState<any>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Vault init inputs (max Q10,000)
  const [initBills, setInitBills] = useState<Record<number, number>>({
    200: 20, 100: 25, 50: 20, 20: 50, 10: 50, 5: 50, 1: 100
  });

  // Add cash inputs (max accumulated Q30,000)
  const [addBills, setAddBills] = useState<Record<number, number>>({
    200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0
  });

  // User management modals
  const [selectedUserForLimit, setSelectedUserForLimit] = useState<any | null>(null);
  const [newLimitValue, setNewLimitValue] = useState<string>("");

  const [selectedUserForCard, setSelectedUserForCard] = useState<any | null>(null);
  const [newCardValue, setNewCardValue] = useState<string>("");

  const [showNewEmpModal, setShowNewEmpModal] = useState<boolean>(false);
  const [newEmpName, setNewEmpName] = useState<string>("");
  const [newEmpCard, setNewEmpCard] = useState<string>("");
  const [newEmpPin, setNewEmpPin] = useState<string>("1234");
  const [newEmpBalance, setNewEmpBalance] = useState<string>("1000");
  const [newEmpLimit, setNewEmpLimit] = useState<string>("2000");

  // Hardware status
  const [hardwareStatus, setHardwareStatus] = useState<any>(null);

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

  const totalInit = Object.entries(initBills).reduce((acc, [d, c]) => acc + Number(d) * c, 0);
  const totalAdd = Object.entries(addBills).reduce((acc, [d, c]) => acc + Number(d) * c, 0);

  const handleInitializeVault = async () => {
    setFeedbackMsg(null);
    try {
      const payload: Record<string, number> = {};
      for (const [d, c] of Object.entries(initBills)) payload[d] = c;
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
        if (c > 0) payload[d] = c;
      }
      const res = await adminService.addCashVault(payload);
      setFeedbackMsg({ type: "success", text: res.mensaje });
      setAddBills({ 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0 });
      await fetchMetrics();
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.response?.data?.detail || "Error al agregar efectivo." });
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
    const clean = newCardValue.replace(/\D/g, "");
    if (clean.length !== 16) {
      setFeedbackMsg({ type: "error", text: "La nueva tarjeta debe tener 16 dígitos numéricos." });
      return;
    }
    try {
      const res = await adminService.reassignCard(selectedUserForCard.id_usuario, clean);
      setFeedbackMsg({ type: "success", text: res.mensaje });
      setSelectedUserForCard(null);
      await fetchMetrics();
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.response?.data?.detail || "Error al reasignar tarjeta." });
    }
  };

  const handleRegisterEmployee = async () => {
    const clean = newEmpCard.replace(/\D/g, "");
    if (clean.length !== 16) {
      setFeedbackMsg({ type: "error", text: "La tarjeta debe tener 16 dígitos numéricos." });
      return;
    }
    try {
      const res = await adminService.registerEmployee({
        nombre_completo: newEmpName,
        numero_tarjeta: clean,
        pin: newEmpPin,
        saldo_inicial: parseFloat(newEmpBalance) || 0,
        monto_max_diario: parseFloat(newEmpLimit) || 2000,
      });
      setFeedbackMsg({ type: "success", text: res.mensaje });
      setShowNewEmpModal(false);
      setNewEmpName("");
      setNewEmpCard("");
      await fetchMetrics();
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.response?.data?.detail || "Error al registrar empleado." });
    }
  };

  const handleToggleJam = async () => {
    const current = hardwareStatus?.jam_simulated || false;
    try {
      const res = await hardwareService.toggleJam(!current);
      setFeedbackMsg({ type: "success", text: res.mensaje });
      await fetchMetrics();
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: "Error al alternar atasco." });
    }
  };

  return (
    <div className="w-full h-full flex bg-discord-base text-discord-textNormal select-none overflow-hidden">
      {/* LEFT NAVIGATION RAIL */}
      <div className="w-64 bg-discord-sidebar flex flex-col justify-between p-4 border-r border-discord-hover h-full flex-shrink-0">
        <div>
          <div className="flex items-center gap-3 pb-4 border-b border-discord-hover">
            <div className="w-10 h-10 rounded-xl bg-discord-amber flex items-center justify-center text-black font-black text-xl shadow-md">
              🛡️
            </div>
            <div>
              <h1 className="text-sm font-black text-white uppercase tracking-wider">
                Consola Admin
              </h1>
              <p className="text-[11px] text-discord-textMuted">Gestión de Bóveda & Auditoría</p>
            </div>
          </div>

          <nav className="mt-6 space-y-1.5">
            <button
              type="button"
              onClick={() => { setActiveSection("vault"); setFeedbackMsg(null); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${
                activeSection === "vault"
                  ? "bg-discord-blurple text-white shadow-md"
                  : "text-discord-textMuted hover:bg-discord-surface hover:text-white"
              }`}
            >
              <Database className="w-5 h-5" />
              <span>Bóveda y Arqueo</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveSection("users"); setFeedbackMsg(null); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${
                activeSection === "users"
                  ? "bg-discord-blurple text-white shadow-md"
                  : "text-discord-textMuted hover:bg-discord-surface hover:text-white"
              }`}
            >
              <Users className="w-5 h-5" />
              <span>Cuentas de Usuarios</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveSection("analytics"); setFeedbackMsg(null); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${
                activeSection === "analytics"
                  ? "bg-discord-blurple text-white shadow-md"
                  : "text-discord-textMuted hover:bg-discord-surface hover:text-white"
              }`}
            >
              <BarChart3 className="w-5 h-5" />
              <span>Métricas Diarias</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveSection("audit"); setFeedbackMsg(null); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${
                activeSection === "audit"
                  ? "bg-discord-blurple text-white shadow-md"
                  : "text-discord-textMuted hover:bg-discord-surface hover:text-white"
              }`}
            >
              <FileText className="w-5 h-5" />
              <span>Bitácora de Auditoría</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveSection("hardware"); setFeedbackMsg(null); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${
                activeSection === "hardware"
                  ? "bg-discord-blurple text-white shadow-md"
                  : "text-discord-textMuted hover:bg-discord-surface hover:text-white"
              }`}
            >
              <Radio className="w-5 h-5" />
              <span>Telemetría Hardware</span>
            </button>
          </nav>
        </div>

        <div className="pt-3 pb-2 border-t border-discord-hover flex flex-col gap-2 flex-shrink-0">
          <div className="text-xs text-discord-textMuted truncate">
            Administrador: <span className="text-white font-bold">{adminUser.nombre_completo}</span>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-discord-red/20 hover:bg-discord-red text-discord-red hover:text-white font-bold text-sm transition-all shadow-sm active:scale-95"
          >
            <LogOut className="w-4 h-4" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col p-6 overflow-y-auto">
        {/* TOP 4 KPI CARDS BAR */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="p-4 rounded-2xl bg-discord-surface border border-discord-hover shadow-md">
            <div className="flex items-center justify-between text-xs font-bold text-discord-textMuted uppercase">
              <span>Saldo en Bóveda</span>
              <span className="text-discord-green font-mono font-bold">
                {metrics?.porcentaje_boveda?.toFixed(0) || 0}%
              </span>
            </div>
            <div className="text-2xl font-black text-white font-mono mt-1">
              Q{metrics?.saldo_boveda?.toFixed(2) || "0.00"}
            </div>
            <div className="w-full h-2 bg-discord-sidebar rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-discord-green transition-all duration-500"
                style={{ width: `${Math.min(100, metrics?.porcentaje_boveda || 0)}%` }}
              />
            </div>
            <div className="text-[10px] text-discord-textMuted mt-1 text-right">Tope máx: Q30,000.00</div>
          </div>

          <div className="p-4 rounded-2xl bg-discord-surface border border-discord-hover shadow-md">
            <div className="text-xs font-bold text-discord-textMuted uppercase">Total Retirado Hoy</div>
            <div className="text-2xl font-black text-discord-amber font-mono mt-1">
              Q{metrics?.total_retirado_hoy?.toFixed(2) || "0.00"}
            </div>
            <div className="text-[10px] text-discord-textMuted mt-2">Acumulado de todos los usuarios</div>
          </div>

          <div className="p-4 rounded-2xl bg-discord-surface border border-discord-hover shadow-md">
            <div className="text-xs font-bold text-discord-textMuted uppercase">Promedio de Depósitos</div>
            <div className="text-2xl font-black text-discord-blurple font-mono mt-1">
              Q{metrics?.promedio_depositos?.toFixed(2) || "0.00"}
            </div>
            <div className="text-[10px] text-discord-textMuted mt-2">Monto promedio por operación</div>
          </div>

          <div className="p-4 rounded-2xl bg-discord-surface border border-discord-hover shadow-md">
            <div className="text-xs font-bold text-discord-textMuted uppercase">Estado Bóveda</div>
            <div className="flex items-center gap-2 mt-1">
              <div
                className={`w-3 h-3 rounded-full ${
                  metrics?.estado_inicializacion === "Inicializado" ? "bg-discord-green animate-pulse" : "bg-discord-amber"
                }`}
              />
              <span className="text-xl font-black text-white">{metrics?.estado_inicializacion || "Pendiente"}</span>
            </div>
            <div className="text-[10px] text-discord-textMuted mt-2">
              Último: {metrics?.ultimo_usuario?.nombre}
            </div>
          </div>
        </div>

        {feedbackMsg && (
          <div
            className={`p-3.5 mb-6 rounded-xl border flex items-center gap-3 text-sm font-medium animate-shake ${
              feedbackMsg.type === "success"
                ? "bg-discord-green/20 border-discord-green text-discord-green"
                : "bg-discord-red/20 border-discord-red text-discord-red"
            }`}
          >
            {feedbackMsg.type === "success" ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {/* SECTION 1: BOVEDA & ARQUEO */}
        {activeSection === "vault" && (
          <div className="space-y-6">
            <div className="p-5 bg-discord-surface rounded-2xl border border-discord-hover shadow-md">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Database className="w-5 h-5 text-discord-green" />
                  <span>Existencias Físicas en Cartuchos de Bóveda</span>
                </h2>
                <button
                  type="button"
                  onClick={fetchMetrics}
                  className="px-3 py-1.5 rounded-lg bg-discord-sidebar hover:bg-discord-hover text-xs font-semibold text-discord-textMuted flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Actualizar</span>
                </button>
              </div>

              <div className="grid grid-cols-7 gap-3">
                {DENOMINATIONS.map((d) => {
                  const cnt = metrics?.denominaciones ? metrics.denominaciones[d] || 0 : 0;
                  const sub = d * cnt;
                  return (
                    <div
                      key={d}
                      className="p-3.5 rounded-xl bg-discord-sidebar border border-discord-hover text-center"
                    >
                      <div className="font-extrabold text-xl text-white">Q{d}</div>
                      <div className="text-2xl font-black font-mono text-discord-green my-1">{cnt}</div>
                      <div className="text-[10px] text-discord-textMuted uppercase font-bold">piezas</div>
                      <div className="text-xs font-bold text-discord-textNormal mt-1 pt-1 border-t border-discord-hover">
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

        {/* SECTION 3: ANALITICA DIARIA */}
        {activeSection === "analytics" && (
          <div className="grid grid-cols-2 gap-6">
            <div className="p-5 bg-discord-surface rounded-2xl border border-discord-hover shadow-md">
              <h2 className="text-lg font-black text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-discord-blurple" />
                <span>Métricas Consolidadas de Operatividad</span>
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between p-3 rounded-xl bg-discord-sidebar">
                  <span className="text-discord-textMuted">Total Usuarios con Cambio de PIN:</span>
                  <span className="font-bold text-discord-green font-mono">{metrics?.usuarios_cambio_pin || 0}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-discord-sidebar">
                  <span className="text-discord-textMuted">Último Usuario Conectado:</span>
                  <span className="font-bold text-white">{metrics?.ultimo_usuario?.nombre}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-discord-sidebar">
                  <span className="text-discord-textMuted">Estampa de Tiempo de Conexión:</span>
                  <span className="font-mono text-discord-textMuted">{metrics?.ultimo_usuario?.timestamp}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-discord-sidebar">
                  <span className="text-discord-textMuted">Persistencia Dual Activa:</span>
                  <span className="font-bold text-discord-green">MySQL InnoDB + ./data/storage_txt/</span>
                </div>
              </div>
            </div>

            <div className="p-5 bg-discord-surface rounded-2xl border border-discord-hover shadow-md">
              <h2 className="text-lg font-black text-white mb-4">Capacidad y Stock Máximo</h2>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span>Ocupación de Bóveda (Máx Q30,000)</span>
                    <span className="text-discord-green font-mono">
                      Q{metrics?.saldo_boveda?.toFixed(2)} / Q30,000.00
                    </span>
                  </div>
                  <div className="w-full h-3 bg-discord-sidebar rounded-full overflow-hidden">
                    <div
                      className="h-full bg-discord-green transition-all duration-500"
                      style={{ width: `${Math.min(100, metrics?.porcentaje_boveda || 0)}%` }}
                    />
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-discord-sidebar text-xs text-discord-textMuted leading-relaxed">
                  El algoritmo bancario valida estrictamente antes de cada dispensación la existencia física en
                  los 7 cartuchos independientes, previniendo sobregiros mecánicos o descalces contables.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 4: AUDITORIA */}
        {activeSection === "audit" && (
          <div className="p-5 bg-discord-surface rounded-2xl border border-discord-hover shadow-md">
            <h2 className="text-lg font-black text-white mb-2 flex items-center gap-2">
              <FileText className="w-5 h-5 text-discord-blurple" />
              <span>Bitácora de Auditoría del Sistema (auditoria_eventos.txt)</span>
            </h2>
            <p className="text-xs text-discord-textMuted mb-4">
              Registro inmutable de todas las acciones operativas, administrativas y de dispensación física
            </p>

            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {metrics?.auditoria?.map((log: any) => (
                <div
                  key={log.id_log}
                  className="p-3 rounded-xl bg-discord-sidebar/70 border border-discord-hover flex items-start justify-between text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2 font-bold text-white">
                      <span className="px-2 py-0.5 rounded bg-discord-surface text-discord-blurple border border-discord-hover font-mono">
                        #{log.id_log}
                      </span>
                      <span>{log.accion}</span>
                      {log.id_usuario && (
                        <span className="text-discord-textMuted font-normal">(Usuario ID {log.id_usuario})</span>
                      )}
                    </div>
                    <p className="text-discord-textNormal mt-1">{log.detalles}</p>
                  </div>
                  <div className="font-mono text-[11px] text-discord-textMuted flex-shrink-0 ml-4">
                    {log.fecha_hora}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 5: TELEMETRIA HARDWARE */}
        {activeSection === "hardware" && (
          <div className="grid grid-cols-2 gap-6">
            <div className="p-5 bg-discord-surface rounded-2xl border border-discord-hover shadow-md">
              <h2 className="text-lg font-black text-white mb-4 flex items-center gap-2">
                <Radio className="w-5 h-5 text-discord-green" />
                <span>Simulador & Estado Físico Arduino Mega 2560</span>
              </h2>

              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-discord-sidebar border border-discord-hover flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white text-sm">Simulación de Atasco Mecánico (JAM_DETECTED)</div>
                    <div className="text-xs text-discord-textMuted">
                      Fuerza una respuesta de error mecánico para verificar la cancelación y rollback contable.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleJam}
                    className={`px-4 py-2 rounded-xl font-bold text-xs transition-all ${
                      hardwareStatus?.jam_simulated
                        ? "bg-discord-red text-white shadow-glow"
                        : "bg-discord-surface hover:bg-discord-hover text-white border border-discord-hover"
                    }`}
                  >
                    {hardwareStatus?.jam_simulated ? "Atasco Activado" : "Normal"}
                  </button>
                </div>

                <div className="p-3.5 rounded-xl bg-discord-sidebar border border-discord-hover space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-discord-textMuted">Puerto Configurado:</span>
                    <span className="font-mono text-white font-bold">{hardwareStatus?.arduino_port}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-discord-textMuted">Baudios Serie:</span>
                    <span className="font-mono text-white">{hardwareStatus?.arduino_baudrate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-discord-textMuted">Estado de Conexión:</span>
                    <span className={hardwareStatus?.arduino_connected ? "text-discord-green font-bold" : "text-discord-amber font-bold"}>
                      {hardwareStatus?.arduino_connected ? "Físico Conectado" : "Emulador Integrado"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5 bg-discord-surface rounded-2xl border border-discord-hover shadow-md">
              <h2 className="text-lg font-black text-white mb-4 flex items-center gap-2">
                <Video className="w-5 h-5 text-discord-blurple" />
                <span>ESP32-CAM & Sensor Ultrasónico HC-SR04</span>
              </h2>

              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-discord-sidebar border border-discord-hover flex items-center justify-between">
                  <div>
                    <div className="text-xs text-discord-textMuted">Distancia de Proximidad Detectada:</div>
                    <div className="text-3xl font-black font-mono text-discord-green mt-1">
                      {hardwareStatus?.distance_cm?.toFixed(1) || "45.0"} cm
                    </div>
                  </div>
                  <div className="px-3 py-1.5 rounded-lg bg-discord-green/20 text-discord-green text-xs font-bold border border-discord-green">
                    Usuario en Rango (&lt; 100 cm)
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-discord-sidebar border border-discord-hover text-xs text-discord-textMuted">
                  La cámara OV2640 toma capturas fotográficas en el momento exacto en que se dispara la orden de
                  dispensación y las guarda en el registro de seguridad del cajero.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

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
            <p className="text-xs text-discord-textMuted mb-4">
              Empleado: <span className="text-white font-bold">{selectedUserForCard.nombre_completo}</span>
              <br />
              <span className="text-discord-amber text-[11px]">
                * Se preserva el récord histórico de consumos y extracciones acumuladas.
              </span>
            </p>
            <div className="mb-4">
              <label className="text-xs font-semibold text-discord-textMuted block mb-1">
                Nuevo Número de Tarjeta (16 dígitos):
              </label>
              <input
                type="text"
                maxLength={16}
                value={newCardValue}
                onChange={(e) => setNewCardValue(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-discord-sidebar border border-discord-hover font-mono text-lg text-discord-green font-bold focus:outline-none focus:border-discord-blurple tracking-wider"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedUserForCard(null)}
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

      {/* MODAL: REGISTRAR EMPLEADO */}
      {showNewEmpModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="max-w-md w-full p-6 bg-discord-surface rounded-2xl border border-discord-hover shadow-2xl">
            <h3 className="text-lg font-black text-white mb-2">Registro de Nuevo Empleado</h3>
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs font-semibold text-discord-textMuted block mb-1">Nombre Completo:</label>
                <input
                  type="text"
                  value={newEmpName}
                  onChange={(e) => setNewEmpName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-discord-sidebar border border-discord-hover text-sm text-white focus:outline-none"
                  placeholder="Ej. Luis Ramírez"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-discord-textMuted block mb-1">Tarjeta (16 dígitos):</label>
                <input
                  type="text"
                  maxLength={16}
                  value={newEmpCard}
                  onChange={(e) => setNewEmpCard(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-discord-sidebar border border-discord-hover font-mono text-sm text-discord-green font-bold focus:outline-none"
                  placeholder="6789012345678901"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-discord-textMuted block mb-1">PIN (4 d):</label>
                  <input
                    type="password"
                    maxLength={4}
                    value={newEmpPin}
                    onChange={(e) => setNewEmpPin(e.target.value)}
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
                onClick={() => setShowNewEmpModal(false)}
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
    </div>
  );
};
