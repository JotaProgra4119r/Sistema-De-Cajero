import React, { useState, useEffect } from "react";
import { Volume2, VolumeX, Contrast, Type, Keyboard, RotateCcw, ShieldCheck, X } from "lucide-react";
import { soundEffects } from "../utils/audioAccessibility";
import { userService } from "../services/api";
import { VoucherModal, type VoucherData } from "./VoucherModal";

interface AccessibilityToolbarProps {
  onToggleVirtualKeypad?: () => void;
  showKeypadToggle?: boolean;
}

export const AccessibilityToolbar: React.FC<AccessibilityToolbarProps> = ({
  onToggleVirtualKeypad,
  showKeypadToggle = true
}) => {
  const [audioEnabled, setAudioEnabled] = useState<boolean>(() => soundEffects.isEnabled());
  const [highContrast, setHighContrast] = useState<boolean>(() => localStorage.getItem("atm_high_contrast") === "true");
  const [largeFont, setLargeFont] = useState<boolean>(() => localStorage.getItem("atm_large_font") === "true");
  
  // Pending operation lookup modal
  const [showPendingModal, setShowPendingModal] = useState<boolean>(false);
  const [pendingRefInput, setPendingRefInput] = useState<string>("");
  const [pendingLoading, setPendingLoading] = useState<boolean>(false);
  const [pendingResult, setPendingResult] = useState<any | null>(null);
  const [pendingError, setPendingError] = useState<string | null>(null);
  const [voucherData, setVoucherData] = useState<VoucherData | null>(null);

  useEffect(() => {
    if (highContrast) {
      document.documentElement.classList.add("atm-high-contrast");
    } else {
      document.documentElement.classList.remove("atm-high-contrast");
    }
    localStorage.setItem("atm_high_contrast", highContrast ? "true" : "false");
  }, [highContrast]);

  useEffect(() => {
    if (largeFont) {
      document.documentElement.classList.add("atm-large-font");
    } else {
      document.documentElement.classList.remove("atm-large-font");
    }
    localStorage.setItem("atm_large_font", largeFont ? "true" : "false");
  }, [largeFont]);

  const toggleSound = () => {
    const next = soundEffects.toggle();
    setAudioEnabled(next);
  };

  const handleLookupPending = async () => {
    soundEffects.playKeyClick();
    setPendingError(null);
    setPendingResult(null);
    const ref = pendingRefInput.trim() || localStorage.getItem("last_pending_reference");
    if (!ref) {
      setPendingError("Ingrese una referencia de operación o token (ej. TRF-20261031-123456 o ID de transacción).");
      return;
    }

    setPendingLoading(true);
    try {
      const res = await userService.checkPendingTransaction(ref);
      setPendingResult(res);
      if (res.confirmed) {
        soundEffects.playSuccessChime();
      } else {
        soundEffects.playWarningTone();
      }
    } catch (err: any) {
      soundEffects.playErrorTone();
      setPendingError(err?.response?.data?.detail || "No se pudo verificar el estado en la base de datos.");
    } finally {
      setPendingLoading(false);
    }
  };

  return (
    <>
      <aside 
        aria-label="Barra de Accesibilidad y Control del Cajero"
        className="flex items-center gap-1.5 sm:gap-2 bg-discord-surface/90 backdrop-blur-md px-2.5 py-1.5 rounded-2xl border border-discord-hover text-xs shadow-lg"
      >
        {/* Toggle Audio */}
        <button
          type="button"
          onClick={toggleSound}
          aria-label={audioEnabled ? "Desactivar asistencia sonora" : "Activar asistencia sonora"}
          title={audioEnabled ? "Sonido activado (clic para silenciar)" : "Sonido silenciado (clic para activar)"}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl font-bold transition-all ${
            audioEnabled
              ? "bg-discord-blurple/20 text-discord-blurple border border-discord-blurple/40"
              : "bg-discord-sidebar text-discord-textMuted hover:text-white border border-discord-hover"
          }`}
        >
          {audioEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{audioEnabled ? "Audio On" : "Audio Off"}</span>
        </button>

        {/* Toggle High Contrast */}
        <button
          type="button"
          onClick={() => {
            soundEffects.playKeyClick();
            setHighContrast(!highContrast);
          }}
          aria-label={highContrast ? "Desactivar alto contraste" : "Activar modo alto contraste"}
          title="Modo Alto Contraste para debilidad visual"
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl font-bold transition-all ${
            highContrast
              ? "bg-amber-400 text-black border border-amber-300 shadow-md font-black"
              : "bg-discord-sidebar text-discord-textMuted hover:text-white border border-discord-hover"
          }`}
        >
          <Contrast className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Contraste</span>
        </button>

        {/* Toggle Font Scale */}
        <button
          type="button"
          onClick={() => {
            soundEffects.playKeyClick();
            setLargeFont(!largeFont);
          }}
          aria-label={largeFont ? "Reducir tamaño de fuente" : "Aumentar tamaño de fuente"}
          title="Tamaño de texto grande para alta legibilidad"
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl font-bold transition-all ${
            largeFont
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/40"
              : "bg-discord-sidebar text-discord-textMuted hover:text-white border border-discord-hover"
          }`}
        >
          <Type className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Zoom A+</span>
        </button>

        {/* Toggle Virtual Keypad */}
        {showKeypadToggle && onToggleVirtualKeypad && (
          <button
            type="button"
            onClick={() => {
              soundEffects.playKeyClick();
              onToggleVirtualKeypad();
            }}
            aria-label="Abrir teclado táctil en pantalla"
            title="Teclado Numérico Táctil en Pantalla"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl font-bold bg-discord-sidebar text-discord-textMuted hover:text-white border border-discord-hover transition-all"
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Teclado</span>
          </button>
        )}

        {/* Pending Operation Recovery Button */}
        <button
          type="button"
          onClick={() => {
            soundEffects.playKeyClick();
            const stored = localStorage.getItem("last_pending_reference");
            if (stored) setPendingRefInput(stored);
            setShowPendingModal(true);
          }}
          aria-label="Consultar operación pendiente o recuperar comprobante"
          title="Verificar transacciones pendientes tras cortes de red"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl font-bold bg-emerald-950/40 text-emerald-400 hover:bg-emerald-900/60 border border-emerald-700/50 transition-all"
        >
          <RotateCcw className="w-3.5 h-3.5 animate-spin-slow" />
          <span>Consultar Pendiente</span>
        </button>
      </aside>

      {/* Modal de Consulta y Recuperación de Operaciones Pendientes */}
      {showPendingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-discord-surface rounded-3xl border border-discord-hover shadow-2xl p-6 text-white relative">
            <button
              type="button"
              onClick={() => {
                soundEffects.playWarningTone();
                setShowPendingModal(false);
              }}
              className="absolute top-5 right-5 p-2 rounded-xl bg-discord-sidebar hover:bg-discord-hover text-discord-textMuted hover:text-white transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Consultar Operación Pendiente</h3>
                <p className="text-xs text-discord-textMuted">
                  Recuperación de estado ante interrupciones de red o timeouts
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-300 mb-4 leading-relaxed bg-discord-sidebar p-3.5 rounded-xl border border-discord-hover">
              Si ocurrió un corte de conexión o timeout de 10 segundos durante un retiro, depósito o transferencia, 
              ingrese la referencia técnica o token para verificar si el servidor oficial completó y asentó los fondos.
            </p>

            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs font-bold text-discord-textMuted uppercase tracking-wider block mb-1">
                  Referencia de Operación o Token TRF:
                </label>
                <input
                  type="text"
                  value={pendingRefInput}
                  onChange={(e) => setPendingRefInput(e.target.value.trim())}
                  placeholder="ej. TRF-20261031-123456 o ID numérico"
                  className="w-full px-4 py-2.5 rounded-xl bg-discord-sidebar border border-discord-hover font-mono text-sm text-white focus:outline-none focus:border-discord-blurple"
                />
              </div>

              {pendingError && (
                <div className="p-3 rounded-xl bg-discord-red/20 border border-discord-red text-discord-red text-xs font-semibold">
                  {pendingError}
                </div>
              )}

              {pendingResult && (
                <div className={`p-4 rounded-xl border text-xs leading-relaxed ${
                  pendingResult.confirmed
                    ? "bg-emerald-950/40 border-emerald-600 text-emerald-300"
                    : "bg-amber-950/40 border-amber-600 text-amber-300"
                }`}>
                  <div className="font-bold text-sm mb-1">
                    {pendingResult.confirmed ? "✅ Operación Confirmada y Acreditada" : "⚠️ Operación No Confirmada"}
                  </div>
                  <div>{pendingResult.mensaje}</div>
                  {pendingResult.confirmed && (
                    <div className="mt-2 pt-2 border-t border-emerald-800/60 font-mono space-y-1 text-[11px]">
                      <div>ID Transacción: #{pendingResult.id_transaccion}</div>
                      <div>Tipo: {pendingResult.tipo}</div>
                      <div>Monto: Q{Number(pendingResult.monto).toFixed(2)}</div>
                      <div>Fecha: {pendingResult.fecha_hora}</div>
                      <div>Cajero: {pendingResult.id_cajero}</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-discord-hover">
              {pendingResult?.confirmed && (
                <button
                  type="button"
                  onClick={() => {
                    setVoucherData({
                      id: pendingResult.id_transaccion,
                      tipo: pendingResult.tipo,
                      titulo: "RECUPERACIÓN DE COMPROBANTE OFICIAL",
                      cliente: "Titular de Cuenta Verificado",
                      monto: pendingResult.monto,
                      fecha_hora: pendingResult.fecha_hora,
                      cajero_origen: pendingResult.id_cajero,
                      token_transferencia: pendingResult.token
                    });
                  }}
                  className="px-4 py-2.5 rounded-xl bg-discord-blurple hover:bg-discord-blurple/80 text-white font-bold text-xs transition-all shadow-md"
                >
                  Ver Comprobante
                </button>
              )}

              <button
                type="button"
                onClick={handleLookupPending}
                disabled={pendingLoading}
                className="px-5 py-2.5 rounded-xl bg-discord-green hover:bg-emerald-400 text-black font-extrabold text-xs transition-all shadow-glow"
              >
                {pendingLoading ? "Verificando..." : "Verificar en Servidor"}
              </button>
            </div>
          </div>
        </div>
      )}

      {voucherData && (
        <VoucherModal voucher={voucherData} onClose={() => setVoucherData(null)} />
      )}
    </>
  );
};
