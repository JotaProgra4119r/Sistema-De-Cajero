import React from "react";
import { Printer, X, ShieldCheck, Building2, Banknote } from "lucide-react";

export interface VoucherData {
  id: string | number;
  tipo: "RETIRO" | "DEPOSITO" | "AUDITORIA" | "INICIALIZACION";
  titulo?: string;
  cliente: string;
  tarjeta?: string;
  monto?: number;
  saldo_anterior?: number;
  nuevo_saldo?: number;
  desglose?: Record<string, number>;
  fecha_hora: string;
  autorizacion?: string;
  detalles_extra?: string;
  items_auditoria?: any[];
  ultimos_movimientos?: Array<{
    id_transaccion?: string | number;
    tipo: string;
    monto: number;
    fecha_hora: string;
    desglose?: Record<string, number>;
  }>;
}

interface VoucherModalProps {
  voucher: VoucherData;
  onClose: () => void;
}

export const VoucherModal: React.FC<VoucherModalProps> = ({ voucher, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  const maskedCard = voucher.tarjeta
    ? voucher.tarjeta.length >= 16
      ? `**** **** **** ${voucher.tarjeta.slice(-4)}`
      : voucher.tarjeta
    : "N/A";

  const authCode = voucher.autorizacion || `AUT-${Math.abs(Number(voucher.id) * 314159 % 900000 + 100000)}`;

  return (
    <div className="voucher-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-fadeIn print:static print:p-0 print:bg-transparent print:backdrop-blur-none">
      {/* Container Dialog */}
      <div className="relative w-full max-w-md bg-white text-gray-900 rounded-2xl shadow-2xl border border-gray-300 overflow-hidden flex flex-col max-h-[92vh] print:max-w-none print:max-h-none print:shadow-none print:border-none print:overflow-visible">
        {/* Header Actions (No se imprime) */}
        <div className="no-print flex items-center justify-between px-4 py-3 bg-slate-100 border-b border-slate-200">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <Printer className="w-4 h-4 text-blue-600" />
            <span>Comprobante Oficial Bancario</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir / PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* PRINTABLE VOUCHER CONTENT */}
        <div
          id="printable-voucher"
          className="p-6 overflow-y-auto print:overflow-visible print:p-2 font-mono text-xs text-gray-900 bg-white"
        >
          {/* Logo y Encabezado del Banco */}
          <div className="text-center pb-3 border-b-2 border-dashed border-gray-400">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Building2 className="w-5 h-5 text-gray-900" />
              <span className="text-base font-black tracking-wider uppercase">
                ATM KIOSK G&T
              </span>
            </div>
            <div className="text-[10px] text-gray-600 font-sans uppercase font-bold tracking-tight">
              Sistema de Autoservicio Bancario Embebido
            </div>
            <div className="text-[10px] text-gray-500 mt-0.5">
              Terminal ID: #ATM-GT-001 | Bóveda Principal
            </div>
            <div className="text-[11px] font-black mt-2 uppercase tracking-wide bg-gray-100 py-1 rounded">
              {voucher.titulo || (voucher.tipo === "RETIRO" ? "COMPROBANTE DE RETIRO" : voucher.tipo === "DEPOSITO" ? "COMPROBANTE DE DEPÓSITO" : "CERTIFICADO DE AUDITORÍA")}
            </div>
          </div>

          {/* Datos del Movimiento */}
          <div className="py-3 space-y-1.5 border-b border-dashed border-gray-300">
            <div className="flex justify-between">
              <span className="text-gray-600">ID Operación:</span>
              <span className="font-bold">#{voucher.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Fecha y Hora:</span>
              <span className="font-semibold">{voucher.fecha_hora}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Titular de Cuenta:</span>
              <span className="font-bold uppercase truncate max-w-[200px]">{voucher.cliente}</span>
            </div>
            {voucher.tarjeta && (
              <div className="flex justify-between">
                <span className="text-gray-600">Tarjeta:</span>
                <span className="font-bold">{maskedCard}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-600">Código Autorización:</span>
              <span className="font-bold text-blue-800">{authCode}</span>
            </div>
          </div>

          {/* Importe y Saldos */}
          {voucher.monto !== undefined && (
            <div className="py-3 space-y-1.5 border-b border-dashed border-gray-300">
              <div className="flex justify-between items-center text-sm font-black py-1 bg-gray-50 px-2 rounded">
                <span>MONTO TOTAL:</span>
                <span className="text-base text-gray-900">
                  Q{voucher.monto.toFixed(2)}
                </span>
              </div>
              {voucher.saldo_anterior !== undefined && (
                <div className="flex justify-between text-[11px] text-gray-600">
                  <span>Saldo Anterior:</span>
                  <span>Q{voucher.saldo_anterior.toFixed(2)}</span>
                </div>
              )}
              {voucher.nuevo_saldo !== undefined && (
                <div className="flex justify-between text-[11px] font-bold text-gray-800">
                  <span>Nuevo Saldo Contable:</span>
                  <span>Q{voucher.nuevo_saldo.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          {/* Desglose de Denominaciones */}
          {voucher.desglose && Object.keys(voucher.desglose).length > 0 && (
            <div className="py-3 border-b border-dashed border-gray-300">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-1 flex items-center gap-1">
                <Banknote className="w-3.5 h-3.5" />
                <span>Desglose de Billetes Oficiales:</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] bg-gray-50 p-2 rounded">
                {Object.entries(voucher.desglose).map(([denom, count]) => (
                  <div key={denom} className="flex justify-between">
                    <span>Q{denom}:</span>
                    <span className="font-bold">{count} pieza{Number(count) !== 1 ? "s" : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Auditoría / Detalles adicionales si aplica */}
          {voucher.detalles_extra && (
            <div className="py-2.5 text-[10px] text-gray-600 border-b border-dashed border-gray-300">
              <span className="font-bold text-gray-800">Detalles: </span>
              {voucher.detalles_extra}
            </div>
          )}

          {/* Tabla de Últimos 5 Movimientos (Extracto / Resumen de Cuenta) */}
          {voucher.ultimos_movimientos && voucher.ultimos_movimientos.length > 0 && (
            <div className="py-3 border-b border-dashed border-gray-300 space-y-2">
              <div className="text-[10px] font-black uppercase text-gray-800 tracking-wider flex items-center justify-between">
                <span>ÚLTIMOS 5 MOVIMIENTOS BANCARIOS</span>
                <span className="text-[9px] text-gray-500 font-normal">Extracto Reciente</span>
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-[10px] text-left">
                  <thead className="bg-gray-100 text-gray-700 font-bold border-b border-gray-200">
                    <tr>
                      <th className="py-1 px-2">Tipo</th>
                      <th className="py-1 px-2">Fecha / Hora</th>
                      <th className="py-1 px-2 text-right">Importe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-mono">
                    {voucher.ultimos_movimientos.slice(0, 5).map((m, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="py-1 px-2 font-bold font-sans">
                          <span className={m.tipo === "RETIRO" ? "text-amber-800" : "text-emerald-800"}>
                            {m.tipo === "RETIRO" ? "(-) RETIRO" : "(+) DEPÓSITO"}
                          </span>
                        </td>
                        <td className="py-1 px-2 text-[9px] text-gray-600">{m.fecha_hora}</td>
                        <td className="py-1 px-2 text-right font-bold text-gray-900">
                          Q{Number(m.monto || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Lista de Eventos de Auditoría (Para Certificados) */}
          {voucher.items_auditoria && voucher.items_auditoria.length > 0 && (
            <div className="py-3 border-b border-dashed border-gray-300 space-y-1.5">
              <div className="text-[10px] font-bold uppercase text-gray-700">
                Resumen de Movimientos Auditados ({voucher.items_auditoria.length} registros):
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1 text-[10px] pr-1">
                {voucher.items_auditoria.slice(0, 20).map((it, idx) => (
                  <div key={idx} className="flex justify-between border-b border-gray-100 pb-0.5">
                    <span className="truncate max-w-[200px]">{it.accion || it.tipo || "OPERACION"}</span>
                    <span className="font-bold">{it.monto ? `Q${Number(it.monto).toFixed(2)}` : it.fecha_hora || ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pie de página y Sello de Seguridad */}
          <div className="pt-4 text-center space-y-2">
            <div className="flex items-center justify-center gap-1.5 text-[10px] text-emerald-700 font-bold">
              <ShieldCheck className="w-4 h-4" />
              <span>Transacción Criptográficamente Asegurada</span>
            </div>
            {/* Código de barras simulado */}
            <div className="flex justify-center items-center py-1">
              <div className="font-mono text-xs tracking-widest bg-gray-900 text-white px-4 py-1 rounded">
                ||| | |||| || ||| ||||| |||
              </div>
            </div>
            <div className="text-[9px] text-gray-500 leading-tight">
              Conserve este comprobante para cualquier reclamo o aclaración contable.
              <br />
              Banco y Sistema de Cajero Automático 2026. Todos los derechos reservados.
            </div>
          </div>
        </div>

        {/* Footer Modal Bar (No se imprime) */}
        <div className="no-print p-3 bg-slate-100 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-300 hover:bg-slate-400 text-slate-800 font-bold text-xs transition-all"
          >
            Cerrar Ventana
          </button>
        </div>
      </div>
    </div>
  );
};
