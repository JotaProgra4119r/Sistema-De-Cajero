import { useState, useEffect } from "react";
import { Lock, UserCheck, CreditCard, Clock, AlertCircle } from "lucide-react";
import { VirtualKeypad } from "../components/VirtualKeypad";
import { HardwareBadges } from "../components/HardwareBadges";
import { authService } from "../services/api";

interface WelcomeAuthViewProps {
  onLoginSuccess: (userData: any, isAdmin: boolean) => void;
}

type ActiveField = "card" | "pin" | "token";

export const WelcomeAuthView: React.FC<WelcomeAuthViewProps> = ({ onLoginSuccess }) => {
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
      } catch {
        // ignore
      }
    };
    fetchToken();
    const tokenInterval = setInterval(fetchToken, 5000);

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

  const handleClear = () => {
    setErrorMessage(null);
    if (activeField === "card") setCardNumber("");
    else if (activeField === "pin") setPin("");
    else if (activeField === "token") setToken("");
  };

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
    <div className="w-full h-full flex flex-col justify-between bg-discord-base p-4 lg:p-6 text-discord-textNormal select-none overflow-y-auto lg:overflow-hidden">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-discord-surface flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-2xl bg-discord-blurple flex items-center justify-center shadow-glow flex-shrink-0">
            <CreditCard className="w-6 h-6 lg:w-7 lg:h-7 text-white" />
          </div>
          <div>
            <h1 className="text-xl lg:text-2xl font-black tracking-wider text-discord-textPure uppercase">
              Banco Nacional de Guatemala
            </h1>
            <p className="text-[11px] lg:text-xs text-discord-textMuted tracking-widest uppercase">
              Terminal Kiosco de Autoservicio Bancario Embebido
            </p>
          </div>
        </div>

        {/* Dual Mode Switcher */}
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
                : "text-discord-textMuted hover:text-white"
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
                ? "bg-discord-amber text-black shadow-md font-extrabold"
                : "text-discord-textMuted hover:text-white"
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
                    {activeField === "pin" && <span className="text-discord-blurple">● Activo</span>}
                  </div>
                  <div className="flex items-center gap-2 h-7">
                    {[0, 1, 2, 3].map((idx) => (
                      <div
                        key={idx}
                        className={`w-3.5 h-3.5 rounded-full border transition-all ${
                          idx < pin.length
                            ? "bg-discord-green border-discord-green shadow-sm"
                            : "border-gray-600 bg-discord-surface"
                        }`}
                      />
                    ))}
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
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-discord-surface text-xs text-discord-textMuted">
        <div>Terminal ID: ATM-GT-001 | Bóveda Central Quetzales | Resolución Kiosco: 1920x1080</div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-discord-green animate-ping" />
          <span>Sistema Seguro con Persistencia Dual Concurrente (.txt + DB)</span>
        </div>
      </div>
    </div>
  );
};