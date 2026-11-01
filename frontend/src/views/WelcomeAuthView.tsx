import { useState, useEffect } from "react";
import { Lock, UserCheck, CreditCard, Clock, AlertCircle, Eye, EyeOff, RefreshCw, Cloud, CheckCircle2 } from "lucide-react";
import { VirtualKeypad } from "../components/VirtualKeypad";
import { HardwareBadges } from "../components/HardwareBadges";
import { AccessibilityToolbar } from "../components/AccessibilityToolbar";
import { authService, syncService } from "../services/api";

interface WelcomeAuthViewProps {
  onLoginSuccess: (userData: any, isAdmin: boolean) => void;
  lastRfidCard?: string | null;
}

type ActiveField = "card" | "pin" | "token";

export const WelcomeAuthView: React.FC<WelcomeAuthViewProps> = ({ onLoginSuccess, lastRfidCard }) => {
  const [isAdminMode, setIsAdminMode] = useState<boolean>(false);
  const [cardNumber, setCardNumber] = useState<string>("");
  const [pin, setPin] = useState<string>("");
  const [token, setToken] = useState<string>("");
  const [activeField, setActiveField] = useState<ActiveField>("card");
  const [showPin, setShowPin] = useState<boolean>(false);
  
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<string>("");
  const [currentDate, setCurrentDate] = useState<string>("");
  const [dynamicTokenPreview, setDynamicTokenPreview] = useState<string>("------");
  const [vaultEmpty, setVaultEmpty] = useState<boolean>(false);
  const [vaultTotal, setVaultTotal] = useState<number>(0);
  const [rfidScannedNotification, setRfidScannedNotification] = useState<string | null>(null);
  const [activeAtm, setActiveAtm] = useState<string>(() => localStorage.getItem("active_atm_id") || "ATM-001");
  const [atmName, setAtmName] = useState<string>("Cajero Central - Zona 10");
  const [syncing, setSyncing] = useState<boolean>(false);
  const [syncNotification, setSyncNotification] = useState<string | null>(null);

  const handleExecuteSync = async () => {
    setSyncing(true);
    setSyncNotification(null);
    try {
      await syncService.executeSync();
      setSyncNotification("Bases de datos sincronizadas con el servidor en línea exitosamente.");
      const tokRes = await authService.getTokenPreview(activeAtm);
      setDynamicTokenPreview(tokRes.token);
      if (tokRes.cajero_nombre) setAtmName(tokRes.cajero_nombre);
      if (tokRes.vault_total !== undefined) {
        setVaultTotal(tokRes.vault_total);
        setVaultEmpty(tokRes.vault_empty ?? tokRes.vault_total <= 0);
      }
      setTimeout(() => setSyncNotification(null), 4000);
    } catch {
      setSyncNotification("Aviso: Servidor en la nube en reposo o sin conexión directa en este instante.");
      setTimeout(() => setSyncNotification(null), 4000);
    } finally {
      setSyncing(false);
    }
  };

  // Auto-populate when physical RFID card is detected
  useEffect(() => {
    if (lastRfidCard) {
      const clean = lastRfidCard.replace(/\D/g, "");
      setCardNumber(formatCard(clean));
      setActiveField("pin");
      setErrorMessage(null);
      setRfidScannedNotification(`Tarjeta física RFID acercada: ${formatCard(clean)}`);
      setTimeout(() => setRfidScannedNotification(null), 4000);
    }
  }, [lastRfidCard]);

  // Escuchar cambio de cajero activo
  useEffect(() => {
    const handleAtmChanged = (e: any) => {
      const nextId = e.detail || localStorage.getItem("active_atm_id") || "ATM-001";
      setActiveAtm(nextId);
    };
    window.addEventListener("atm_changed", handleAtmChanged);
    return () => window.removeEventListener("atm_changed", handleAtmChanged);
  }, []);

  // Clock updater & dynamic token preview
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString("es-GT", { hour12: false }));
      setCurrentDate(now.toLocaleDateString("es-GT", { weekday: "long", year: "numeric", month: "long", day: "numeric" }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);

    const fetchToken = async () => {
      try {
        const res = await authService.getTokenPreview(activeAtm);
        setDynamicTokenPreview(res.token);
        if (res.cajero_nombre) setAtmName(res.cajero_nombre);
        if (res.vault_total !== undefined) {
          setVaultTotal(res.vault_total);
          setVaultEmpty(res.vault_empty ?? res.vault_total <= 0);
        }
      } catch {
        // ignore
      }
    };
    fetchToken();
    const tokenInterval = setInterval(fetchToken, 4000);

    return () => {
      clearInterval(interval);
      clearInterval(tokenInterval);
    };
  }, [activeAtm]);

  // Format 16 digits into XXXX-XXXX-XXXX-XXXX
  const formatCard = (digits: string) => {
    const clean = digits.replace(/\D/g, "").slice(0, 16);
    const parts = [];
    for (let i = 0; i < clean.length; i += 4) {
      parts.push(clean.slice(i, i + 4));
    }
    return parts.join("-");
  };

  const handleKeypadPress = (digit: string) => {
    setErrorMessage(null);
    if (activeField === "card") {
      const clean = cardNumber.replace(/\D/g, "");
      if (clean.length < 16) {
        const next = clean + digit;
        setCardNumber(formatCard(next));
        if (next.length === 16) setActiveField("pin");
      }
    } else if (activeField === "pin") {
      if (pin.length < 4) {
        const next = pin + digit;
        setPin(next);
        if (next.length === 4) setActiveField("token");
      }
    } else if (activeField === "token") {
      if (token.length < 6) {
        setToken(token + digit);
      }
    }
  };

  const handleBackspace = () => {
    setErrorMessage(null);
    if (activeField === "card") {
      const clean = cardNumber.replace(/\D/g, "");
      if (clean.length > 0) {
        setCardNumber(formatCard(clean.slice(0, -1)));
      }
    } else if (activeField === "pin") {
      if (pin.length > 0) {
        setPin((prev) => prev.slice(0, -1));
      } else {
        setActiveField("card");
      }
    } else if (activeField === "token") {
      if (token.length > 0) {
        setToken((prev) => prev.slice(0, -1));
      } else {
        setActiveField("pin");
      }
    }
  };

  const handleClear = () => {
    setErrorMessage(null);
    if (activeField === "card") setCardNumber("");
    else if (activeField === "pin") setPin("");
    else if (activeField === "token") setToken("");
  };

  // Keyboard navigation and typing listener for laptop / computer keyboards
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if an explicit input or textarea is focused
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        handleKeypadPress(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === "Tab") {
        e.preventDefault();
        setActiveField((prev) => {
          if (prev === "card") return "pin";
          if (prev === "pin") return "token";
          return "card";
        });
      } else if (e.key === "Escape" || e.key === "Delete") {
        e.preventDefault();
        handleClear();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeField, cardNumber, pin, token, isAdminMode, vaultEmpty, vaultTotal, loading]);

  const handleSubmit = async () => {
    const cleanCard = cardNumber.replace(/\D/g, "");
    if (cleanCard.length !== 16) {
      setErrorMessage("Por favor ingrese el número de tarjeta completo (16 dígitos).");
      setActiveField("card");
      return;
    }
    if (pin.length !== 4) {
      setErrorMessage("Por favor ingrese su PIN de 4 dígitos.");
      setActiveField("pin");
      return;
    }
    if (token.length < 6) {
      setErrorMessage("Por favor ingrese el token dinámico de 6 dígitos.");
      setActiveField("token");
      return;
    }

    if (!isAdminMode && (vaultEmpty || vaultTotal <= 0)) {
      setErrorMessage("⚠️ Cajero fuera de servicio: Bóveda completamente vacía (Q0.00). Debe ser inicializado con fondos por un administrador antes de permitir operaciones a usuarios.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await authService.login(cleanCard, pin, token, isAdminMode, activeAtm);
      localStorage.setItem("atm_token", res.access_token);
      onLoginSuccess(res.user, isAdminMode);
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Error de conexión o credenciales inválidas.";
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  // Quick preset test helpers for touch evaluation
  const setPresetUser = async (card: string, p: string, tok: string, admin: boolean) => {
    setIsAdminMode(admin);
    setCardNumber(formatCard(card));
    setPin(p);
    setErrorMessage(null);
    let activeTok = tok;
    try {
      const res = await authService.getTokenPreview();
      activeTok = res.token;
      setDynamicTokenPreview(res.token);
    } catch {
      // fallback to current preview
    }
    setToken(activeTok);
  };

  return (
    <div className="w-full h-full flex flex-col justify-between bg-discord-base p-3 md:p-4 lg:p-5 text-discord-textNormal select-none overflow-y-auto">
      {/* Active ATM Status Banner */}
      <div className="mb-2 p-2 rounded-xl bg-discord-sidebar border border-discord-hover flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-discord-blurple animate-pulse" />
          <span className="font-bold text-discord-textPure uppercase">🏧 {activeAtm}:</span>
          <span className="text-discord-textMuted font-semibold">{atmName}</span>
        </div>
        <div className="flex items-center gap-2">
          {vaultEmpty ? (
            <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30 text-[11px]">
              ⚠️ Bóveda Vacía (Q0.00)
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30 text-[11px]">
              🟢 En Servicio (Q{vaultTotal.toFixed(2)})
            </span>
          )}

          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("open_atm_identification_modal"))}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-discord-surface hover:bg-discord-hover text-discord-blurple hover:text-white font-bold text-[11px] border border-discord-hover transition-all"
            title="Cambiar o enlazar terminal de cajero (ATM-001 a ATM-004 o registrar nuevo)"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Cambiar Cajero</span>
          </button>

          <button
            type="button"
            onClick={handleExecuteSync}
            disabled={syncing}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 font-bold text-[11px] border border-emerald-700/50 transition-all"
            title="Sincronizar datos y transacciones con el servidor en línea (Render)"
          >
            <Cloud className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} />
            <span>{syncing ? "Sincronizando..." : "Sincronizar Nube"}</span>
          </button>
        </div>
      </div>

      {/* Sync Notification Banner */}
      {syncNotification && (
        <div className="mb-2 p-2 rounded-xl bg-blue-950/50 border border-blue-500/40 text-blue-300 text-xs font-bold flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
            <span>{syncNotification}</span>
          </div>
          <span className="text-[10px] bg-blue-800/60 text-white px-2 py-0.5 rounded font-mono">SYNC OK</span>
        </div>
      )}

      {/* RFID Scan Toast Notification */}
      {rfidScannedNotification && (
        <div className="mb-2 p-2.5 rounded-xl bg-discord-green/20 border border-discord-green text-discord-green text-xs font-bold flex items-center justify-between animate-bounce">
          <span>💳 {rfidScannedNotification}</span>
          <span className="text-[10px] text-white bg-discord-green/40 px-2 py-0.5 rounded">RFID OK</span>
        </div>
      )}

      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-discord-surface flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 lg:w-11 lg:h-11 rounded-2xl bg-discord-blurple flex items-center justify-center shadow-glow flex-shrink-0">
            <CreditCard className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg lg:text-2xl font-black tracking-wider text-discord-textPure uppercase">
              Banco Nacional Inzano GYT
            </h1>
            <p className="text-[10px] lg:text-xs text-discord-textMuted tracking-widest uppercase">
              Terminal Kiosco de Autoservicio Bancario Embebido · {activeAtm}
            </p>
          </div>
        </div>

        {/* Accessibility & Dual Mode Switcher */}
        <div className="flex flex-wrap items-center gap-2 lg:gap-3">
          <AccessibilityToolbar showKeypadToggle={false} />

          <div className="flex items-center gap-2 lg:gap-3 bg-discord-surface p-1.5 rounded-2xl border border-discord-hover">
            <button
              type="button"
              onClick={() => {
                setIsAdminMode(false);
                setErrorMessage(null);
              }}
              className={`flex items-center gap-2 px-3.5 lg:px-5 py-2 lg:py-2.5 rounded-xl font-bold text-xs lg:text-sm transition-all ${
                !isAdminMode
                  ? "bg-discord-blurple text-white shadow-md"
                  : "text-discord-textMuted hover:text-discord-textPure"
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Terminal Usuario</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsAdminMode(true);
                setErrorMessage(null);
              }}
              className={`flex items-center gap-2 px-3.5 lg:px-5 py-2 lg:py-2.5 rounded-xl font-bold text-xs lg:text-sm transition-all ${
                isAdminMode
                  ? "bg-discord-amber shadow-md font-extrabold"
                  : "text-discord-textMuted hover:text-discord-textPure"
              }`}
            >
              <Lock className="w-4 h-4" />
              <span>Panel Administrador</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Split-Screen Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 my-auto py-4">
        {/* Left Column: Brand Identity, Hardware Badges, Clock & Quick Presets */}
        <div className="col-span-1 lg:col-span-5 flex flex-col justify-between p-5 lg:p-8 bg-discord-surface/60 rounded-3xl border border-discord-hover shadow-kiosk">
          <div>
            <div className="flex items-center gap-2.5 text-discord-textMuted text-sm font-semibold mb-3">
              <Clock className="w-5 h-5 text-discord-blurple" />
              <span className="capitalize">{currentDate}</span>
            </div>
            <div className="text-5xl font-black text-discord-textPure tracking-tight font-mono">
              {currentTime}
            </div>

            <div className="my-6 border-t border-discord-hover/60" />

            {/* Hardware badges */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-discord-textMuted">
                Estado Físico del Kiosco
              </h3>
              <HardwareBadges />
            </div>

            <div className="mt-8 p-4 rounded-2xl bg-discord-sidebar/80 border border-discord-hover">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-discord-textMuted">Token Dinámico Actual (TOTP):</div>
                  <div className="text-2xl font-mono font-bold text-discord-green tracking-widest mt-1">
                    {dynamicTokenPreview}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const res = await authService.getTokenPreview();
                      setDynamicTokenPreview(res.token);
                      setToken(res.token);
                    } catch {
                      setToken(dynamicTokenPreview);
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-discord-surface hover:bg-discord-hover text-white border border-discord-hover transition-all"
                >
                  Usar Token
                </button>
              </div>
            </div>
          </div>

          {/* Quick evaluation shortcuts */}
          <div className="mt-6 pt-4 border-t border-discord-hover/60">
            <div className="text-xs font-bold text-discord-textMuted uppercase tracking-wider mb-2">
              Cuentas Rápidas de Prueba:
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPresetUser("1234567812345678", "1234", dynamicTokenPreview, false)}
                className="px-3 py-2 text-xs font-semibold rounded-xl bg-discord-surface hover:bg-discord-hover text-left truncate text-white border border-discord-hover"
              >
                👤 Carlos Gómez (Emp 1)
              </button>
              <button
                type="button"
                onClick={() => setPresetUser("2345678923456789", "1234", dynamicTokenPreview, false)}
                className="px-3 py-2 text-xs font-semibold rounded-xl bg-discord-surface hover:bg-discord-hover text-left truncate text-white border border-discord-hover"
              >
                👤 María López (Emp 2)
              </button>
              <button
                type="button"
                onClick={() => setPresetUser("3456789034567890", "1234", dynamicTokenPreview, false)}
                className="px-3 py-2 text-xs font-semibold rounded-xl bg-discord-surface hover:bg-discord-hover text-left truncate text-white border border-discord-hover"
              >
                👤 Juan Pérez (Lím Q1500)
              </button>
              <button
                type="button"
                onClick={() => setPresetUser("9999888877776666", "1234", dynamicTokenPreview, true)}
                className="px-3 py-2 text-xs font-bold rounded-xl bg-amber-950/60 hover:bg-amber-900/80 text-left truncate text-amber-300 border border-amber-800"
              >
                🛡️ Admin Bóveda
              </button>
              <button
                type="button"
                onClick={() => setPresetUser("8888888888888888", "1234", dynamicTokenPreview, true)}
                className="col-span-2 px-3 py-2.5 text-xs font-black rounded-xl bg-purple-950/70 hover:bg-purple-900/90 text-left truncate text-purple-300 border border-purple-700 shadow-md flex items-center justify-between"
              >
                <span>⭐ Super Administrador (Red Global)</span>
                <span className="text-[10px] bg-purple-800/80 text-white px-2 py-0.5 rounded font-mono">Master</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Authentication Container & Virtual Keypad */}
        <div className="col-span-1 lg:col-span-7 flex flex-col justify-center p-5 lg:p-8 bg-discord-surface rounded-3xl border border-discord-hover shadow-kiosk">
          <div className="max-w-[480px] mx-auto w-full">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-black text-discord-textPure">
                {isAdminMode ? "Acceso a Consola Administrativa" : "Autenticación de Autoservicio"}
              </h2>
              <p className="text-sm text-discord-textMuted mt-1">
                Introduzca sus credenciales táctiles de tres factores
              </p>
            </div>

            {((vaultEmpty || vaultTotal <= 0) && !isAdminMode) && (
              <div className="p-4 mb-4 rounded-2xl bg-amber-500/15 border-2 border-amber-500/80 text-amber-300 flex items-start gap-3 text-xs font-medium shadow-lg backdrop-blur-sm animate-pulse">
                <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-black text-amber-200 uppercase tracking-wide text-xs">
                    ⚠️ BÓVEDA VACÍA (Q0.00) - TERMINAL EN ESPERA
                  </div>
                  <div className="mt-1 text-amber-100/90 leading-relaxed text-[11px]">
                    El cajero se encuentra en estado inicial sin efectivo cargado. El acceso de usuarios está restringido hasta que se inicialice. Ingrese con credenciales de <strong>Panel Administrador</strong> para configurar y cargar la bóveda.
                  </div>
                </div>
              </div>
            )}

            {errorMessage && (
              <div className="flex items-center gap-2 p-3.5 mb-4 bg-discord-red/20 border border-discord-red rounded-xl text-discord-red text-sm font-medium animate-shake">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="space-y-4 mb-6">
              <div
                onClick={() => setActiveField("card")}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  activeField === "card"
                    ? "bg-discord-sidebar border-discord-blurple ring-2 ring-discord-blurple/50"
                    : "bg-discord-sidebar/60 border-discord-hover"
                }`}
              >
                <div className="flex items-center justify-between text-xs font-semibold text-discord-textMuted mb-1">
                  <span>Número de Tarjeta (16 dígitos)</span>
                  {activeField === "card" && <span className="text-discord-blurple">● Activo</span>}
                </div>
                <div className="font-mono text-xl font-bold tracking-widest text-white">
                  {cardNumber || <span className="text-gray-600">XXXX-XXXX-XXXX-XXXX</span>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div
                  onClick={() => setActiveField("pin")}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    activeField === "pin"
                      ? "bg-discord-sidebar border-discord-blurple ring-2 ring-discord-blurple/50"
                      : "bg-discord-sidebar/60 border-discord-hover"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-discord-textMuted mb-1">
                    <span>PIN (4 dígitos)</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowPin(!showPin);
                        }}
                        aria-label={showPin ? "Ocultar PIN" : "Mostrar PIN"}
                        className="p-1 rounded text-discord-textMuted hover:text-white transition-all"
                        title={showPin ? "Ocultar PIN" : "Mostrar PIN"}
                      >
                        {showPin ? <EyeOff className="w-3.5 h-3.5 text-discord-amber" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      {activeField === "pin" && <span className="text-discord-blurple">● Activo</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 h-7 font-mono font-bold text-xl text-discord-green">
                    {showPin ? (
                      <span className="tracking-widest">{pin ? pin.padEnd(4, "•") : "••••"}</span>
                    ) : (
                      [0, 1, 2, 3].map((idx) => (
                        <div
                          key={idx}
                          className={`w-3.5 h-3.5 rounded-full border transition-all ${
                            idx < pin.length
                              ? "bg-discord-green border-discord-green shadow-sm"
                              : "border-gray-600 bg-discord-surface"
                          }`}
                        />
                      ))
                    )}
                  </div>
                </div>

                <div
                  onClick={() => setActiveField("token")}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    activeField === "token"
                      ? "bg-discord-sidebar border-discord-blurple ring-2 ring-discord-blurple/50"
                      : "bg-discord-sidebar/60 border-discord-hover"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-discord-textMuted mb-1">
                    <span>Token Dinámico</span>
                    {activeField === "token" && <span className="text-discord-blurple">● Activo</span>}
                  </div>
                  <div className="font-mono text-xl font-bold tracking-widest text-discord-green">
                    {token || <span className="text-gray-600">000000</span>}
                  </div>
                </div>
              </div>
            </div>

            <VirtualKeypad
              onNumberClick={handleKeypadPress}
              onClear={handleClear}
              onEnter={handleSubmit}
              enterDisabled={loading}
            />

            <div className="mt-3 text-center text-[11px] text-discord-textMuted flex items-center justify-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-discord-green" />
              <span>Soporte de teclado físico activo (0-9, Backspace, Enter, Tab) &amp; Lector RFID ESP32</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-discord-surface text-xs text-discord-textMuted flex-shrink-0">
        <div>Terminal ID: ATM-GT-001 | Bóveda Central Quetzales | Resolución Kiosco: Adaptable (mínimo 720p)</div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-discord-green animate-ping" />
          <span>Sistema Seguro con Persistencia Dual Concurrente (.txt + DB)</span>
        </div>
      </div>
    </div>
  );
};