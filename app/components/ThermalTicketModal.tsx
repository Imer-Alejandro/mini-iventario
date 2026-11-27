"use client";

import { Printer, CheckCircle2, X, PlusCircle } from "lucide-react";
import { formatCurrencyRD } from "@/lib/money";

interface ThermalTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: {
    number: number;
    createdAt: string | Date;
    customerName?: string;
    paymentType: string;
    total: string;
    paidAmount?: string;
    changeAmount?: string;
    lines: Array<{
      productName: string;
      quantity: string;
      unit?: string;
      unitPrice: string;
      lineTotal: string;
    }>;
  } | null;
}

export function ThermalTicketModal({ isOpen, onClose, sale }: ThermalTicketModalProps) {
  if (!isOpen || !sale) return null;

  const handlePrint = () => {
    window.print();
  };

  const saleDate = new Date(sale.createdAt).toLocaleString("es-DO", {
    dateStyle: "short",
    timeStyle: "medium",
  });
  const customerName = sale.customerName?.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#0B192C]/40 backdrop-blur-md animate-in fade-in duration-200">
      <div className="glass-modal rounded-3xl w-full max-w-md overflow-hidden flex flex-col border border-white/90 shadow-2xl">
        {/* Header con Estado de Éxito */}
        <div className="p-4 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-extrabold text-sm block leading-tight">¡Venta #{sale.number} Exitosa!</span>
              <span className="text-[11px] text-emerald-100 font-medium">Ticket registrado e inventario descontado</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full text-white/80 hover:text-white hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Vista previa del Ticket Térmico de 80mm */}
        <div className="p-5 bg-slate-100/70 flex justify-center max-h-[65vh] overflow-y-auto">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/90 w-full font-mono text-xs text-slate-800 space-y-3 leading-relaxed">
            {/* Encabezado del Comercio */}
            <div className="text-center border-b border-dashed border-slate-300 pb-3">
              <h2 className="text-base font-black text-slate-900 tracking-wider">KORTA BUSINESS</h2>
              <p className="text-[10px] text-slate-500 font-sans font-bold">Carnicería & Cortes Selectos</p>
              <p className="text-[10px] text-slate-500">RNC: 1-31-98765-4</p>
              <p className="text-[10px] text-slate-500">Av. 27 de Febrero #204, Santo Domingo</p>
              <p className="text-[10px] text-slate-500">Tel: (809) 555-0199</p>
            </div>

            {/* Metadatos de la Venta */}
            <div className="text-[11px] space-y-0.5 border-b border-dashed border-slate-300 pb-2">
              <div className="flex justify-between">
                <span>TICKET #:</span>
                <span className="font-black text-slate-900">{sale.number}</span>
              </div>
              <div className="flex justify-between">
                <span>FECHA:</span>
                <span>{saleDate}</span>
              </div>
              {customerName && (
                <div className="flex justify-between">
                  <span>CLIENTE:</span>
                  <span className="font-bold truncate max-w-[180px]">{customerName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>CONDICIÓN:</span>
                <span className="font-bold text-emerald-800">{sale.paymentType}</span>
              </div>
            </div>

            {/* Desglose de Artículos */}
            <div className="border-b border-dashed border-slate-300 pb-2 space-y-1.5">
              <div className="flex justify-between text-[10px] font-bold text-slate-400">
                <span>DESCRIPCIÓN</span>
                <span>IMPORTE</span>
              </div>
              {sale.lines.map((l, i) => (
                <div key={i} className="text-[11px]">
                  <div className="font-bold text-slate-900">{l.productName}</div>
                  <div className="flex justify-between text-slate-600 text-[10px]">
                    <span>
                      {l.quantity}{l.unit ? ` ${l.unit}` : ""} × {formatCurrencyRD(l.unitPrice)}
                      {l.unit ? `/${l.unit}` : ""}
                    </span>
                    <span className="font-bold text-slate-900">{formatCurrencyRD(l.lineTotal)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Totales y Liquidación */}
            <div className="space-y-1 pt-1 text-[11px]">
              <div className="flex justify-between text-slate-600">
                <span>SUBTOTAL:</span>
                <span>{formatCurrencyRD(sale.total)}</span>
              </div>
              <div className="flex justify-between text-slate-500 text-[10px]">
                <span>ITBIS (0% tasa cero en carnes):</span>
                <span>RD$ 0.00</span>
              </div>
              <div className="flex justify-between text-sm font-black text-slate-900 pt-1.5 border-t border-slate-300">
                <span>TOTAL:</span>
                <span>{formatCurrencyRD(sale.total)}</span>
              </div>

              {sale.paidAmount && (
                <div className="flex justify-between text-slate-600 pt-1">
                  <span>PAGÓ CON:</span>
                  <span>{formatCurrencyRD(sale.paidAmount)}</span>
                </div>
              )}
              {sale.changeAmount && (
                <div className="flex justify-between text-emerald-800 font-bold">
                  <span>DEVUELTA / CAMBIO:</span>
                  <span>{formatCurrencyRD(sale.changeAmount)}</span>
                </div>
              )}
            </div>

            {/* Pie de Ticket y Simulación de Código de Barras */}
            <div className="text-center pt-3 border-t border-dashed border-slate-300 text-[10px] text-slate-500 space-y-1.5">
              <p className="font-bold text-slate-700">¡GRACIAS POR SU PREFERENCIA!</p>
              <p className="text-[9px]">Conserve su ticket para cualquier duda o consulta.</p>
              <div className="pt-2 text-[10px] tracking-widest text-slate-400 font-mono">
                ||| || ||||| || |||||||| |||| | |||
              </div>
            </div>
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="p-4 bg-white/90 border-t border-slate-200/80 flex gap-2.5">
          <button
            onClick={handlePrint}
            className="flex-1 py-3.5 bg-[#0B192C] hover:bg-[#182C44] text-white font-bold rounded-2xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer text-xs sm:text-sm"
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            Imprimir Ticket Térmico
          </button>
          <button
            onClick={onClose}
            className="px-5 py-3.5 border border-slate-200/80 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-2xl transition-all cursor-pointer text-xs sm:text-sm flex items-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4 text-slate-500" />
            Nueva Venta
          </button>
        </div>
      </div>
    </div>
  );
}
