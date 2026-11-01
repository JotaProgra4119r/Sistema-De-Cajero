import React, { useState, useEffect } from "react";
import {
  Building2, Key, CheckCircle2, AlertTriangle,
  RefreshCw, PlusCircle, Radio, X
} from "lucide-react";
import { authService, getTerminalSessionId } from "../services/api";

interface AtmIdentificationModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onAtmSelected: (atm: any) => void;
  currentAtmId?: string;
}

export const AtmIdentificationModal: React.FC<AtmIdentificationModalProps> = ({
  isOpen,
  onClose,
  onAtmSelected,
  currentAtmId,
}) => {
  const [activeTab, setActiveTab] = useState<"connect" | "register">("connect");
  const [atmsList, setAtmsList] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Normal connect inputs
  const [selectedAtmId, setSelectedAtmId] = useState<string>(currentAtmId || "");
  const [connectCode, setConnectCode] = useState<string>("");
  const [conflictDetected, setConflictDetected] = useState<boolean>(false);

  // Register inputs
  const [newName, setNewName] = useState<string>("");
  const [newCode, setNewCode] = useState<string>("");
  const [newLocation, setNewLocation] = useState<string>("");

  const isSessionActive = localStorage.getItem("active_atm_session_started") === "true";

  const fetchAtms = async () => {
    try {
      setLoading(true);
      const list = await authService.getAtms();
      setAtmsList(list);
      if (list.length === 0) {
        // Si no hay cajeros registrados/activos, forzar creación en Primer Inicio
        setActiveTab("register");
      } else if (currentAtmId && list.some((c: any) => c.id_cajero === currentAtmId)) {
        setSelectedAtmId(currentAtmId);
      }
    } catch (err: any) {
      console.error("Error al cargar cajeros:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAtms();
      setErrorMessage(null);
      setSuccessMessage(null);
      setConflictDetected(false);
      setConnectCode("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentSessionId = getTerminalSessionId();

  const handleConnect = async (force: boolean = false) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setConflictDetected(false);

    if (!selectedAtmId) {
      setErrorMessage("Por favor seleccione un cajero de la lista.");
      return;
    }
    if (connectCode.trim().length < 3 || connectCode.trim().length > 6) {
      setErrorMessage("El código de seguridad del cajero debe tener entre 3 y 6 dígitos (ej. '000' o '1234').");
      return;
    }

    try {
      setLoading(true);
      const res = await authService.connectAtm(selectedAtmId, connectCode.trim(), currentSessionId, force);
      setSuccessMessage(res.mensaje || "Cajero enlazado exitosamente.");
      localStorage.setItem("active_atm_id", res.cajero.id_cajero);
      localStorage.setItem("active_atm_nombre", res.cajero.nombre);
      window.dispatchEvent(new CustomEvent("atm_changed", { detail: res.cajero.id_cajero }));
      setTimeout(() => {
        onAtmSelected(res.cajero);
        if (onClose) onClose();
      }, 900);
    } catch (err: any) {
      if (err.response?.status === 409) {
        setConflictDetected(true);
        setErrorMessage(err.response?.data?.detail || "Este cajero ya cuenta con una sesión activa en otra terminal.");
      } else {
        setErrorMessage(err.response?.data?.detail || "Error al conectar el cajero. Verifique el código del cajero.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!newName.trim() || newName.trim().length < 3) {
      setErrorMessage("Por favor escriba el nombre descriptivo del cajero (ej: 'Cajero de José Javier').");
      return;
    }
    if (newCode.trim().length < 3 || newCode.trim().length > 6 || !/^\d{3,6}$/.test(newCode.trim())) {
      setErrorMessage("El código de seguridad debe constar de 3 a 6 dígitos numéricos (ej. '000' o '1234').");
      return;
    }

    try {
      setLoading(true);
      const res = await authService.registerAtm(newName.trim(), newCode.trim(), newLocation.trim(), currentSessionId);
      setSuccessMessage(res.mensaje || "Nuevo cajero registrado y enlazado exitosamente.");
      localStorage.setItem("active_atm_id", res.cajero.id_cajero);
      localStorage.setItem("active_atm_nombre", res.cajero.nombre);
      window.dispatchEvent(new CustomEvent("atm_changed", { detail: res.cajero.id_cajero }));
      setTimeout(() => {
        onAtmSelected(res.cajero);
        if (onClose) onClose();
      }, 900);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || "Error al registrar el nuevo cajero.");
    } finally {
      setLoading(false);
    }
  };

  const selectedAtm = atmsList.find((c) => c.id_cajero === selectedAtmId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-xl bg-discord-surface text-discord-textNormal rounded-2xl shadow-2xl border border-discord-blurple/40 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Modal */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-discord-sidebar via-discord-surface to-discord-sidebar border-b border-discord-hover flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-discord-blurple flex items-center justify-center text-white shadow-md">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>Identificación y Enlace de Cajero</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  Terminal #{currentSessionId.slice(0, 8)}
                </span>
              </h2>
              <p className="text-xs text-discord-textMuted">
                {isSessionActive
                  ? "Seleccione el cajero que operará en este equipo o registre un nuevo cajero en la red."
                  : "⚠️ Identificación obligatoria: Conecte o registre una terminal para habilitar el cajero."}
              </p>
            </div>
          </div>
          {onClose && isSessionActive && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-discord-textMuted hover:text-white hover:bg-discord-hover transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-discord-hover bg-discord-sidebar/50 p-1.5 gap-1.5">
          <button
            type="button"
            onClick={() => { setActiveTab("connect"); setErrorMessage(null); setConflictDetected(false); }}
            className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
              activeTab === "connect"
                ? "bg-discord-blurple text-white shadow-md"
                : "text-discord-textMuted hover:text-white hover:bg-discord-hover"
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>Inicio Normal (Conectar Cajero)</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("register"); setErrorMessage(null); setConflictDetected(false); }}
            className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
              activeTab === "register"
                ? "bg-discord-green text-black font-black shadow-md"
                : "text-discord-textMuted hover:text-white hover:bg-discord-hover"
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>Primer Inicio (Nuevo Cajero)</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          {/* Feedback Alerts */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-discord-red/20 border border-discord-red/40 text-discord-red text-xs font-semibold flex items-start gap-2.5 animate-shake">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <span>{errorMessage}</span>
                {conflictDetected && (
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleConnect(true)}
                      className="px-3 py-1 rounded bg-discord-red text-white text-[11px] font-bold hover:bg-red-600 transition-all shadow-sm"
                    >
                      Forzar Desconexión y Tomar Control
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-discord-green/20 border border-discord-green/40 text-discord-green text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* TAB 1: CONNECT EXISTING ATM */}
          {activeTab === "connect" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-discord-textMuted">
                  Cajeros Registrados en la Red ({atmsList.length})
                </label>
                <button
                  type="button"
                  onClick={fetchAtms}
                  className="text-xs text-discord-blurple hover:underline flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                  <span>Refrescar Red</span>
                </button>
              </div>

              {/* Lista visual de cajeros */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1">
                {atmsList.map((atm) => {
                  const isSelected = selectedAtmId === atm.id_cajero;
                  return (
                    <div
                      key={atm.id_cajero}
                      onClick={() => { setSelectedAtmId(atm.id_cajero); setConflictDetected(false); }}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? "bg-discord-blurple/20 border-discord-blurple ring-1 ring-discord-blurple shadow-md"
                          : "bg-discord-sidebar/60 border-discord-hover hover:border-discord-textMuted"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-xs font-black text-white">{atm.id_cajero}</span>
                        <div className="flex items-center gap-1">
                          {atm.en_linea ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                              En Línea
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-500/20 text-gray-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                              Apagado
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="font-bold text-xs text-white truncate" title={atm.nombre}>
                        {atm.nombre}
                      </div>
                      <div className="text-[10px] text-discord-textMuted truncate mt-0.5">
                        {atm.ubicacion || "Sin ubicación registrada"}
                      </div>
                      <div className="text-[10px] text-discord-textMuted mt-1 pt-1 border-t border-discord-hover flex justify-between font-mono">
                        <span>Bóveda:</span>
                        <span className={atm.vault_total > 0 ? "text-green-400 font-bold" : "text-amber-400"}>
                          Q{atm.vault_total?.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Formulario de Código de Seguridad */}
              {selectedAtm ? (
                <div className="p-3.5 rounded-xl bg-discord-sidebar/90 border border-discord-hover space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-discord-textMuted">Cajero Seleccionado:</span>
                    <span className="font-black text-white">{selectedAtm.nombre} ({selectedAtm.id_cajero})</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-discord-textMuted mb-1 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-discord-amber" />
                      <span>Código de Seguridad del Cajero (3 a 6 dígitos):</span>
                    </label>
                    <input
                      type="password"
                      maxLength={6}
                      value={connectCode}
                      onChange={(e) => setConnectCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="••••"
                      className="w-full px-3 py-2 bg-discord-base border border-discord-hover rounded-lg text-white font-mono tracking-widest text-center text-lg focus:outline-none focus:border-discord-blurple"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleConnect(false);
                      }}
                    />
                    <p className="text-[10px] text-discord-textMuted mt-1">
                      Código configurado para este cajero en la base de datos SQL (ej. 000 para ATM-004 o 1234).
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleConnect(false)}
                    disabled={loading || connectCode.length < 3}
                    className="w-full py-2.5 rounded-xl bg-discord-blurple hover:bg-blue-600 disabled:opacity-40 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all"
                  >
                    <Radio className="w-4 h-4" />
                    <span>{loading ? "Conectando con Servidor..." : "Arrancar y Conectar Cajero"}</span>
                  </button>
                </div>
              ) : atmsList.length > 0 ? (
                <div className="p-4 rounded-xl bg-discord-sidebar/60 border border-discord-hover text-center space-y-2">
                  <Building2 className="w-6 h-6 text-discord-blurple mx-auto opacity-70" />
                  <p className="text-xs text-discord-textMuted font-bold">
                    👆 Seleccione un cajero de la lista superior para vincularlo a esta terminal e ingresar su código.
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center space-y-2.5">
                  <AlertTriangle className="w-6 h-6 text-amber-400 mx-auto" />
                  <p className="text-xs text-amber-300 font-bold">
                    No hay cajeros activos disponibles en la red bancaria.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab("register")}
                    className="px-4 py-2 rounded-xl bg-discord-green hover:bg-emerald-500 text-black font-black text-xs transition-all shadow-md"
                  >
                    + Registrar Nuevo Cajero (Primer Inicio)
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: REGISTER NEW ATM (PRIMER INICIO) */}
          {activeTab === "register" && (
            <div className="space-y-3.5">
              <div className="p-3 rounded-xl bg-discord-green/10 border border-discord-green/30 text-xs text-discord-textNormal">
                <span className="font-bold text-discord-green">Primer Inicio de Terminal: </span>
                Puede asignar un nombre personalizado a este cajero (ej. <span className="font-mono text-white">"Cajero de José Javier"</span>) y su propio código de 4 dígitos. Se sincronizará en la red y con SQL.
              </div>

              <div>
                <label className="block text-xs font-bold text-discord-textMuted mb-1">
                  Nombre Personalizado del Cajero *
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="ej. Cajero de José Javier / Sucursal Miraflores"
                  className="w-full px-3 py-2 bg-discord-base border border-discord-hover rounded-lg text-white text-xs sm:text-sm focus:outline-none focus:border-discord-green"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-discord-textMuted mb-1 flex items-center gap-1">
                    <Key className="w-3.5 h-3.5 text-discord-amber" />
                    <span>Código de Seguridad (3 a 6 dígitos) *</span>
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="ej. 000 o 1234"
                    className="w-full px-3 py-2 bg-discord-base border border-discord-hover rounded-lg text-white font-mono tracking-widest text-center text-base focus:outline-none focus:border-discord-green"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-discord-textMuted mb-1">
                    Ubicación Física (Opcional)
                  </label>
                  <input
                    type="text"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    placeholder="ej. Zona 10, Pasillo Central"
                    className="w-full px-3 py-2 bg-discord-base border border-discord-hover rounded-lg text-white text-xs sm:text-sm focus:outline-none focus:border-discord-green"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleRegister}
                  disabled={loading || !newName.trim() || newCode.length < 3}
                  className="w-full py-2.5 rounded-xl bg-discord-green hover:bg-green-500 disabled:opacity-40 text-black font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>{loading ? "Registrando en SQL y Red..." : "Registrar y Poner en Línea"}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
