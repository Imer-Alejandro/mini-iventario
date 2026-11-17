"use client";

import { useState } from "react";
import {
  X,
  CreditCard,
  Banknote,
  UserCheck,
  AlertTriangle,
  ShieldCheck,
  Clock,
  ArrowRight,
  Receipt,
  User,
} from "lucide-react";
import { TactileNumpad } from "./TactileNumpad";
import { calculateChange, formatCurrencyRD, checkCreditAvailability } from "@/lib/money";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalAmount: string;
  items: Array<{
    name: string;
    quantity: string;
    unit: string;
    unitPrice: string;
    lineTotal: string;
  }>;
  customer?: {
    id: string;
    name: string;
    creditLimit: string;
    balance: string;
    status: string;
  } | null;
  onCompleteSale: (params: {
    paymentType: "CONTADO" | "CREDITO";
    paymentMethod: "EFECTIVO" | "TARJETA";
    paidAmount?: string;
    changeAmount?: string;
    supervisorPin?: string;
  }) => Promise<void>;
}

export function PaymentModal({
  isOpen,
  onClose,
  totalAmount,
  items,
  customer,
  onCompleteSale,
}: PaymentModalProps) {
  const [paymentType, setPaymentType] = useState<"CONTADO" | "CREDITO">("CONTADO");
  const [paymentMethod, setPaymentMethod] = useState<"EFECTIVO" | "TARJETA">("EFECTIVO");
  const [paidInput, setPaidInput] = useState(totalAmount);
  const [supervisorPin, setSupervisorPin] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Cálculo exacto de cambio con Decimal.js
  const changeCalc = calculateChange(paidInput || "0", totalAmount);

  // Verificación de crédito si selecciona venta a crédito
  let creditStatus = null;
  if (paymentType === "CREDITO") {
    if (customer) {
      creditStatus = checkCreditAvailability(customer.balance, customer.creditLimit, totalAmount);
    }
  }

  const handleQuickAmount = (val: string) => {
    if (val === "Exacto") {
      setPaidInput(totalAmount);
    } else {
      setPaidInput(val);
    }
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      if (paymentType === "CONTADO" && paymentMethod === "EFECTIVO") {
        if (!changeCalc.isSufficient) {
          setErrorMsg(`El monto recibido es insuficiente. Falta ${formatCurrencyRD(changeCalc.remainingDue)}`);
          setIsSubmitting(false);
          return;
        }
      }

      if (paymentType === "CREDITO") {
        if (!customer) {
          setErrorMsg("Para vender a crédito debe seleccionar un cliente previamente");
          setIsSubmitting(false);
          return;
        }
        if (creditStatus && !creditStatus.allowed && !supervisorPin) {
          setErrorMsg(`El saldo excede el límite de crédito en ${formatCurrencyRD(creditStatus.exceededAmount)}. Ingrese el PIN de supervisor para autorizar.`);
          setIsSubmitting(false);
          return;
        }
      }

      await onCompleteSale({
        paymentType,
        paymentMethod,
        paidAmount: paidInput,
        changeAmount: changeCalc.change,
        supervisorPin: supervisorPin || undefined,
      });

      onClose();
    } catch (error: unknown) {
      setErrorMsg(error instanceof Error ? error.message : "Error al procesar la venta");
    } finally {
      setIsSubmitting(false);
    }
  };

  const customerInitials = customer
    ? customer.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "MO";

  const currentTime = new Date().toLocaleTimeString("es-DO", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#0B192C]/40 backdrop-blur-md animate-in fade-in duration-200">
      <div className="glass-modal rounded-3xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row border border-white/90 shadow-2xl max-h-[92vh]">
        {/* COLUMNA IZQUIERDA: RESUMEN DE TRANSACCIÓN (Estilo Bitepoint) */}
        <div className="w-full md:w-5/12 bg-white/60 p-5 sm:p-6 border-b md:border-b-0 md:border-r border-slate-200/70 flex flex-col justify-between overflow-y-auto">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs uppercase font-extrabold tracking-wider text-slate-400">
                Detalle del Pedido
              </span>
              <span className="text-xs font-bold text-slate-500 bg-white/80 px-2 py-0.5 rounded-full border border-slate-200/60">
                {items.length} líneas
              </span>
            </div>

            {/* Pill de Información de Cliente (Estilo Bitepoint con initials) */}
            <div className="bg-white/90 p-3.5 rounded-2xl border border-white shadow-xs mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0B192C] to-[#1E293B] text-white font-black flex items-center justify-center text-sm shadow-xs">
                  {customerInitials}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-extrabold text-slate-900 text-sm truncate">
                    {customer ? customer.name : "Cliente Mostrador (Contado)"}
                  </h4>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {currentTime}
                    </span>
                    <span>•</span>
                    <span>{customer ? "Cuenta Corriente" : "Venta Rápida"}</span>
                  </div>
                </div>
              </div>

              {customer && (
                <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Deuda actual:</span>
                  <span className="font-mono font-bold text-amber-700">{formatCurrencyRD(customer.balance)}</span>
                </div>
              )}
            </div>

            {/* Lista de Líneas de Productos */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {items.map((it, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100/80"
                >
                  <div className="flex-1 pr-2">
                    <span className="font-bold text-slate-800 block truncate">{it.name}</span>
                    <span className="text-[11px] text-slate-500">
                      {it.quantity} {it.unit} × {formatCurrencyRD(it.unitPrice)}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-slate-900">
                    {formatCurrencyRD(it.lineTotal)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Desglose Financiero */}
          <div className="mt-4 pt-4 border-t border-slate-200/70">
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal ({items.length} artículos)</span>
                <span className="font-mono font-semibold">{formatCurrencyRD(totalAmount)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>ITBIS (0% exento en carnes frescas)</span>
                <span className="font-mono font-semibold">RD$ 0.00</span>
              </div>
              <div className="flex justify-between items-baseline pt-2.5 border-t border-slate-200/80">
                <span className="text-sm font-black text-slate-900 uppercase tracking-tight">TOTAL A COBRAR</span>
                <span className="text-2xl sm:text-3xl font-black font-mono text-[#0B192C] tracking-tight">
                  {formatCurrencyRD(totalAmount)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: SELECCIÓN DE MÉTODO, TECLADO TÁCTIL Y COBRO */}
        <div className="w-full md:w-7/12 p-5 sm:p-6 flex flex-col justify-between overflow-y-auto bg-white/80">
          <div>
            {/* Header con botón cerrar */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="font-black text-slate-900 text-lg">Método de Pago</h3>
                <p className="text-xs text-slate-500 font-medium">Seleccione la forma de liquidación</p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Pestañas Selectoras de Método (Efectivo / Tarjeta / Crédito) */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <button
                type="button"
                onClick={() => {
                  setPaymentType("CONTADO");
                  setPaymentMethod("EFECTIVO");
                }}
                className={`py-3 px-2 rounded-2xl text-xs font-black flex flex-col items-center gap-1.5 border transition-all cursor-pointer ${
                  paymentType === "CONTADO" && paymentMethod === "EFECTIVO"
                    ? "bg-[#0B192C] text-white border-[#0B192C] shadow-md shadow-[#0B192C]/20"
                    : "bg-white/80 text-slate-700 border-slate-200/80 hover:bg-white"
                }`}
              >
                <Banknote className="w-5 h-5 text-emerald-400" />
                Efectivo
              </button>

              <button
                type="button"
                onClick={() => {
                  setPaymentType("CONTADO");
                  setPaymentMethod("TARJETA");
                }}
                className={`py-3 px-2 rounded-2xl text-xs font-black flex flex-col items-center gap-1.5 border transition-all cursor-pointer ${
                  paymentType === "CONTADO" && paymentMethod === "TARJETA"
                    ? "bg-[#0B192C] text-white border-[#0B192C] shadow-md shadow-[#0B192C]/20"
                    : "bg-white/80 text-slate-700 border-slate-200/80 hover:bg-white"
                }`}
              >
                <CreditCard className="w-5 h-5 text-sky-400" />
                Tarjeta POS
              </button>

              <button
                type="button"
                onClick={() => setPaymentType("CREDITO")}
                className={`py-3 px-2 rounded-2xl text-xs font-black flex flex-col items-center gap-1.5 border transition-all cursor-pointer ${
                  paymentType === "CREDITO"
                    ? "bg-[#0B192C] text-white border-[#0B192C] shadow-md shadow-[#0B192C]/20"
                    : "bg-white/80 text-slate-700 border-slate-200/80 hover:bg-white"
                }`}
              >
                <UserCheck className="w-5 h-5 text-amber-400" />
                A Crédito
              </button>
            </div>

            {/* Alerta de Error si ocurre */}
            {errorMsg && (
              <div className="mb-3 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* CASO 1: EFECTIVO (Bitepoint layout: display grande, chips, keypad, live change) */}
            {paymentType === "CONTADO" && paymentMethod === "EFECTIVO" && (
              <div className="space-y-3">
                {/* Display LUMINOSO de Efectivo Entregado & Devuelta (CERO fondos negros agresivos) */}
                <div className="bg-gradient-to-br from-emerald-50/70 via-white to-slate-50 border-2 border-emerald-500/30 rounded-2xl p-3.5 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 block mb-0.5">
                      Efectivo Recibido
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-bold text-slate-500">RD$</span>
                      <span className="text-3xl sm:text-4xl font-black font-mono text-slate-900 tracking-tight">
                        {paidInput || "0"}
                      </span>
                    </div>
                  </div>

                  <div className="text-right border-l border-emerald-200/60 pl-4">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-0.5">
                      Cambio / Devuelta
                    </span>
                    <span
                      className={`text-2xl sm:text-3xl font-black font-mono ${
                        changeCalc.isSufficient ? "text-emerald-700" : "text-rose-600"
                      }`}
                    >
                      {changeCalc.isSufficient
                        ? formatCurrencyRD(changeCalc.change)
                        : `Falta ${formatCurrencyRD(changeCalc.remainingDue)}`}
                    </span>
                  </div>
                </div>

                {/* Teclado Táctil con Chips de RD$ */}
                <TactileNumpad
                  value={paidInput}
                  onChange={setPaidInput}
                  maxDecimals={2}
                  prefix="RD$"
                  quickAmounts={["100", "500", "1000", "2000", "Exacto"]}
                  onQuickAmountSelect={handleQuickAmount}
                />
              </div>
            )}

            {/* CASO 2: TARJETA DE CRÉDITO/DÉBITO */}
            {paymentType === "CONTADO" && paymentMethod === "TARJETA" && (
              <div className="p-6 bg-slate-50/80 border border-slate-200/80 rounded-2xl text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-800 flex items-center justify-center mx-auto">
                  <CreditCard className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-base">Terminal de Tarjeta (Verifone / Cardnet)</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                    Cobre <span className="font-black text-slate-900">{formatCurrencyRD(totalAmount)}</span> en la terminal bancaria externa y confirme para cerrar el ticket.
                  </p>
                </div>
              </div>
            )}

            {/* CASO 3: VENTA A CRÉDITO CON EVALUACIÓN FINANCIERA */}
            {paymentType === "CREDITO" && (
              <div className="space-y-3">
                {customer ? (
                  <div className="bg-amber-50/70 border border-amber-200/80 p-4 rounded-2xl space-y-2.5">
                    <div className="flex items-center justify-between pb-2 border-b border-amber-200/60">
                      <span className="text-xs font-bold text-amber-900">Estado de Cuenta del Cliente</span>
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-200/60 px-2 py-0.5 rounded-full">
                        {customer.status}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Límite de Crédito Aprobado:</span>
                        <span className="font-mono font-bold text-slate-900">{formatCurrencyRD(customer.creditLimit)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Deuda Anterior:</span>
                        <span className="font-mono font-bold text-slate-900">{formatCurrencyRD(customer.balance)}</span>
                      </div>
                      <div className="flex justify-between text-slate-900 font-bold pt-1.5 border-t border-amber-200/60">
                        <span>Nueva Deuda Acumulada:</span>
                        <span className="font-mono text-amber-900">
                          {creditStatus ? formatCurrencyRD(creditStatus.newBalance) : "..."}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Crédito Restante Disponible:</span>
                        <span className="font-mono font-bold text-emerald-700">
                          {creditStatus ? formatCurrencyRD(creditStatus.availableCredit) : "..."}
                        </span>
                      </div>
                    </div>

                    {/* Alerta de exceso de límite con PIN de supervisor */}
                    {creditStatus && !creditStatus.allowed && (
                      <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                        <div className="flex items-center gap-2 text-rose-800 text-xs font-bold">
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>Excede el límite en {formatCurrencyRD(creditStatus.exceededAmount)}</span>
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-slate-700 block mb-1">
                            PIN de Autorización del Supervisor:
                          </label>
                          <input
                            type="password"
                            maxLength={6}
                            placeholder="Ingrese PIN"
                            value={supervisorPin}
                            onChange={(e) => setSupervisorPin(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-mono tracking-widest text-center focus:ring-2 focus:ring-amber-500 outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center text-rose-800 text-xs font-bold space-y-1">
                    <p>No hay un cliente seleccionado para esta venta.</p>
                    <p className="text-slate-500 font-normal">
                      Seleccione un cliente registrado en el mostrador para habilitar la venta a crédito.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Botón Principal de Confirmación (Cobrar) */}
          <div className="mt-4 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={
                isSubmitting ||
                (paymentType === "CONTADO" && paymentMethod === "EFECTIVO" && !changeCalc.isSufficient) ||
                (paymentType === "CREDITO" && !customer)
              }
              className="w-full py-4 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 active:scale-98 disabled:opacity-40 text-white font-black rounded-2xl shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 text-base sm:text-lg cursor-pointer"
            >
              <ShieldCheck className="w-6 h-6 stroke-[2.5]" />
              {isSubmitting
                ? "Procesando Venta..."
                : `COBRAR ${formatCurrencyRD(totalAmount)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
