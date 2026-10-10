import { useState, useEffect } from "react";
import { Lock, UserCheck, CreditCard, Clock, AlertCircle } from "lucide-react";
import { VirtualKeypad } from "../components/VirtualKeypad";
import { HardwareBadges } from "../components/HardwareBadges";
import { authService } from "../services/api";

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
  
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<string>("");
  const [currentDate, setCurrentDate] = useState<string>("");
  const [dynamicTokenPreview, setDynamicTokenPreview] = useState<string>("------");
  const [vaultEmpty, setVaultEmpty] = useState<boolean>(false);
  const [vaultTotal, setVaultTotal] = useState<number>(0);
  const [rfidScannedNotification, setRfidScannedNotification] = useState<string | null>(null);

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
        const res = await authService.getTokenPreview();
        setDynamicTokenPreview(res.token);
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
  }, []);

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
      const res = await authService.login(cleanCard, pin, token, isAdminMode);
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
              Banco Nacional de Guatemala
            </h1>
            <p className="text-[10px] lg:text-xs text-discord-textMuted tracking-widest uppercase">
              Terminal Kiosco de Autoservicio Bancario Embebido
            </p>
          </div>
        </div>

        {/* Dual Mode Switcher */}
        <div className="flex items-center gap-2 lg:gap-3 bg-discord-surface p-1.5 rounded-2xl border-2 border-slate-700 dark:border-discord-hover shadow-md">
          <button
            type="button"
            onClick={() => {
              setIsAdminMode(false);
              setErrorMessage(null);
            }}
            className={`flex items-center gap-2 px-3.5 lg:px-5 py-2 lg:py-2.5 rounded-xl font-bold text-xs lg:text-sm transition-all ${
              !isAdminMode
                ? "bg-blue-700 dark:bg-discord-blurple text-white shadow-md font-extrabold"
                : "text-slate-800 dark:text-discord-textMuted hover:text-discord-textPure"
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
                ? "bg-amber-600 text-white shadow-md font-extrabold border border-amber-800"
                : "text-slate-800 dark:text-discord-textMuted hover:text-discord-textPure"
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>Panel Administrador</span>
          </button>
        </div>
      </div>

      {/* Main Split-Screen Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 my-auto py-4">
        {/* Left Column: Brand Identity, Hardware Badges, Clock & Quick Presets */}
        <div className="col-span-1 lg:col-span-5 flex flex-col justify-between p-5 lg:p-8 bg-discord-surface rounded-3xl border-2 border-slate-700 dark:border-discord-hover shadow-kiosk">
          <div>
            <div className="flex items-center gap-2.5 text-slate-800 dark:text-discord-textMuted text-sm font-bold mb-3">
              <Clock className="w-5 h-5 text-blue-700 dark:text-discord-blurple" />
              <span className="capitalize">{currentDate}</span>
            </div>
            <div className="text-5xl font-black text-slate-900 dark:text-discord-textPure tracking-tight font-mono">
              {currentTime}
            </div>

            <div className="my-6 border-t-2 border-slate-400 dark:border-discord-hover/60" />

            {/* Hardware badges */}
            <div className="space-y-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-discord-textMuted">
                Estado Físico del Kiosco
              </h3>
              <HardwareBadges />
            </div>

            <div className="mt-8 p-4 rounded-2xl bg-slate-100 dark:bg-discord-sidebar/80 border-2 border-slate-600 dark:border-discord-hover shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-discord-textMuted">Token Dinámico Actual (TOTP):</div>
                  <div className="text-2xl font-mono font-black text-emerald-800 dark:text-discord-green tracking-widest mt-1">
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
                  className="px-3.5 py-2 text-xs font-black rounded-xl bg-white dark:bg-discord-surface hover:bg-slate-200 dark:hover:bg-discord-hover text-slate-900 dark:text-white border-2 border-slate-700 dark:border-discord-hover transition-all shadow-sm"
                >
                  Usar Token
                </button>
              </div>
            </div>
          </div>

          {/* Quick evaluation shortcuts */}
          <div className="mt-6 pt-4 border-t-2 border-slate-400 dark:border-discord-hover/60">
            <div className="text-xs font-black text-slate-800 dark:text-discord-textMuted uppercase tracking-wider mb-2">
              Cuentas Rápidas de Prueba:
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPresetUser("1234567812345678", "1234", dynamicTokenPreview, false)}
                className="px-3 py-2 text-xs font-bold rounded-xl bg-white dark:bg-discord-surface hover:bg-slate-100 dark:hover:bg-discord-hover text-left truncate text-slate-900 dark:text-white border-2 border-slate-700 dark:border-discord-hover shadow-xs"
              >
                👤 Carlos Gómez (Emp 1)
              </button>
              <button
                type="button"
                onClick={() => setPresetUser("2345678923456789", "1234", dynamicTokenPreview, false)}
                className="px-3 py-2 text-xs font-bold rounded-xl bg-white dark:bg-discord-surface hover:bg-slate-100 dark:hover:bg-discord-hover text-left truncate text-slate-900 dark:text-white border-2 border-slate-700 dark:border-discord-hover shadow-xs"
              >
                👤 María López (Emp 2)
              </button>
              <button
                type="button"
                onClick={() => setPresetUser("3456789034567890", "1234", dynamicTokenPreview, false)}
                className="px-3 py-2 text-xs font-bold rounded-xl bg-white dark:bg-discord-surface hover:bg-slate-100 dark:hover:bg-discord-hover text-left truncate text-slate-900 dark:text-white border-2 border-slate-700 dark:border-discord-hover shadow-xs"
              >
                👤 Juan Pérez (Lím Q1500)
              </button>
              <button
                type="button"
                onClick={() => setPresetUser("9999888877776666", "1234", dynamicTokenPreview, true)}
                className="px-3 py-2 text-xs font-black rounded-xl bg-amber-900 dark:bg-amber-950/60 hover:bg-amber-800 text-left truncate text-amber-100 border-2 border-amber-950 shadow-xs"
              >
                🛡️ Admin Bóveda
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Authentication Container & Virtual Keypad */}
        <div className="col-span-1 lg:col-span-7 flex flex-col justify-center p-5 lg:p-8 bg-discord-surface rounded-3xl border-2 border-slate-700 dark:border-discord-hover shadow-kiosk">
          <div className="max-w-[480px] mx-auto w-full">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-black text-slate-900 dark:text-discord-textPure">
                {isAdminMode ? "Acceso a Consola Administrativa" : "Autenticación de Autoservicio"}
              </h2>
              <p className="text-sm font-semibold text-slate-800 dark:text-discord-textMuted mt-1">
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
              <div className="flex items-center gap-2 p-3.5 mb-4 bg-red-100 dark:bg-discord-red/20 border-2 border-red-600 rounded-xl text-red-800 dark:text-discord-red text-sm font-bold animate-shake">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="space-y-4 mb-6">
              <div
                onClick={() => setActiveField("card")}
                className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                  activeField === "card"
                    ? "bg-blue-50 dark:bg-discord-sidebar border-blue-700 dark:border-discord-blurple ring-2 ring-blue-500/40"
                    : "bg-slate-50 dark:bg-discord-sidebar/60 border-slate-600 dark:border-discord-hover"
                }`}
              >
                <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-discord-textMuted mb-1">
                  <span>Número de Tarjeta (16 dígitos)</span>
                  {activeField === "card" && <span className="text-blue-700 dark:text-discord-blurple font-black">● Activo</span>}
                </div>
                <div className="font-mono text-xl font-black tracking-widest text-slate-900 dark:text-white">
                  {cardNumber || <span className="text-slate-400 dark:text-gray-600">XXXX-XXXX-XXXX-XXXX</span>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div
                  onClick={() => setActiveField("pin")}
                  className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                    activeField === "pin"
                      ? "bg-blue-50 dark:bg-discord-sidebar border-blue-700 dark:border-discord-blurple ring-2 ring-blue-500/40"
                      : "bg-slate-50 dark:bg-discord-sidebar/60 border-slate-600 dark:border-discord-hover"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-discord-textMuted mb-1">
                    <span>PIN (4 dígitos)</span>
                    {activeField === "pin" && <span className="text-blue-700 dark:text-discord-blurple font-black">● Activo</span>}
                  </div>
                  <div className="flex items-center gap-2 h-7">
                    {[0, 1, 2, 3].map((idx) => (
                      <div
                        key={idx}
                        className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${
                          idx < pin.length
                            ? "bg-emerald-600 border-emerald-800 dark:bg-discord-green dark:border-discord-green shadow-xs"
                            : "border-slate-400 bg-white dark:border-gray-600 dark:bg-discord-surface"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div
                  onClick={() => setActiveField("token")}
                  className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                    activeField === "token"
                      ? "bg-blue-50 dark:bg-discord-sidebar border-blue-700 dark:border-discord-blurple ring-2 ring-blue-500/40"
                      : "bg-slate-50 dark:bg-discord-sidebar/60 border-slate-600 dark:border-discord-hover"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-discord-textMuted mb-1">
                    <span>Token Dinámico</span>
                    {activeField === "token" && <span className="text-blue-700 dark:text-discord-blurple font-black">● Activo</span>}
                  </div>
                  <div className="font-mono text-xl font-black tracking-widest text-emerald-800 dark:text-discord-green">
                    {token || <span className="text-slate-400 dark:text-gray-600">000000</span>}
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

            <div className="mt-3 text-center text-[11px] font-bold text-slate-800 dark:text-discord-textMuted flex items-center justify-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-discord-green" />
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