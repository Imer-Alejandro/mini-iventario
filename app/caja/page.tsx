"use client";

import { useState, useEffect } from "react";
import {
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Clock,
  Printer,
  Coins,
  Receipt,
  FileSpreadsheet,
} from "lucide-react";
import { formatCurrencyRD, DOP_DENOMINATIONS, calculateCountedCash } from "@/lib/money";

interface CashMovement {
  id: string;
  type: string;
  amount: string;
  reason?: string;
  createdAt: string;
}

interface CashReport {
  sessionId: string;
  sessionNumber: number;
  userName: string;
  status: "OPEN" | "CLOSED";
  openingAmount: string;
  cashSales: string;
  customerAbonos: string;
  manualIngresos: string;
  manualRetiros: string;
  expectedAmount: string;
  countedAmount: string | null;
  difference: string | null;
  diffReason: string | null;
  openedAt: string;
  closedAt: string | null;
  isBalanced: boolean;
}

export default function CashPage() {
  const [report, setReport] = useState<CashReport | null>(null);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modales
  const [isOpeningModalOpen, setIsOpeningModalOpen] = useState(false);
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [movementType, setMovementType] = useState<"INGRESO_MANUAL" | "RETIRO_MANUAL">("RETIRO_MANUAL");

  // Inputs de apertura
  const [openingInput, setOpeningInput] = useState("5000.00");

  // Inputs de movimiento manual
  const [movAmount, setMovAmount] = useState("");
  const [movReason, setMovReason] = useState("");

  // Inputs de arqueo de cierre
  const [denominationCounts, setDenominationCounts] = useState<Record<string, number>>({});
  const [diffReason, setDiffReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchCashData = async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const res = await fetch("/api/cash");
      const data = await res.json() as {
        report?: CashReport;
        movements?: CashMovement[];
      };
      if (!res.ok) throw new Error("No se pudieron cargar los datos de caja.");
      if (data.report) setReport(data.report);
      if (data.movements) setMovements(data.movements);
    } catch (error: unknown) {
      setLoadError(error instanceof Error ? error.message : "No se pudieron cargar los datos de caja.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/cash")
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudieron cargar los datos de caja.");
        return await response.json() as {
          report?: CashReport;
          movements?: CashMovement[];
        };
      })
      .then((data) => {
        if (cancelled) return;
        if (data.report) setReport(data.report);
        if (data.movements) setMovements(data.movements);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "No se pudieron cargar los datos de caja.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Total físico calculado por billetes y monedas
  const countedFromDenominations = calculateCountedCash(denominationCounts);
  const expectedDecimal = report ? parseFloat(report.expectedAmount) : 0;
  const countedDecimal = parseFloat(countedFromDenominations || "0");
  const differenceDecimal = countedDecimal - expectedDecimal;

  // Apertura de caja
  const handleOpenCash = async () => {
    try {
      setActionError(null);
      const res = await fetch("/api/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "OPEN",
          openingAmount: openingInput,
          userName: "Claudette Colbert (Cajera Principal)",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al abrir la caja");
      }

      setIsOpeningModalOpen(false);
      fetchCashData();
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : "Error al abrir la caja.");
    }
  };

  // Movimiento manual (retiro / ingreso)
  const handleSaveMovement = async () => {
    try {
      setActionError(null);
      if (!movAmount || parseFloat(movAmount) <= 0) {
        setActionError("El monto debe ser mayor que cero");
        return;
      }
      if (!movReason.trim()) {
        setActionError("El motivo del movimiento es obligatorio");
        return;
      }

      const res = await fetch("/api/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "MOVEMENT",
          cashSessionId: report?.sessionId,
          type: movementType,
          amount: movAmount,
          reason: movReason,
          authorizedBy: parseFloat(movAmount) > 1000 ? "user-supervisor-1" : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al registrar movimiento");
      }

      setIsMovementModalOpen(false);
      setMovAmount("");
      setMovReason("");
      fetchCashData();
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : "Error al registrar el movimiento.");
    }
  };

  // Cierre de caja y arqueo
  const handleCloseCash = async () => {
    try {
      setActionError(null);
      if (differenceDecimal !== 0 && !diffReason.trim()) {
        setActionError("Hay una diferencia entre el efectivo esperado y el contado. La justificación es obligatoria.");
        return;
      }

      const res = await fetch("/api/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CLOSE",
          cashSessionId: report?.sessionId,
          denominationCounts,
          diffReason: diffReason.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al cerrar la caja");
      }

      setIsClosingModalOpen(false);
      setDenominationCounts({});
      setDiffReason("");
      fetchCashData();
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : "Error al cerrar la caja.");
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Encabezado y Estado de Caja */}
      <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
            report?.status === "OPEN" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
          }`}>
            <Wallet className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Caja y Arqueo Diario</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                report?.status === "OPEN" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-700"
              }`}>
                {report?.status === "OPEN" ? `TURNO ABIERTO #${report.sessionNumber}` : "TURNO CERRADO"}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Cajera: <span className="font-bold text-slate-700">{report?.userName || "Claudette Colbert"}</span> · Moneda: Pesos Dominicanos (RD$)
            </p>
          </div>
        </div>

        {/* Acciones de Caja */}
        <div className="flex items-center gap-2.5">
          {report?.status === "OPEN" ? (
            <>
              <button
                onClick={() => {
                  setMovementType("RETIRO_MANUAL");
                  setActionError(null);
                  setIsMovementModalOpen(true);
                }}
                className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <ArrowDownRight className="w-4 h-4 text-rose-600" />
                Retiro de Efectivo
              </button>
              <button
                onClick={() => {
                  setMovementType("INGRESO_MANUAL");
                  setActionError(null);
                  setIsMovementModalOpen(true);
                }}
                className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                Ingreso Manual
              </button>
              <button
                onClick={() => {
                  setActionError(null);
                  setIsClosingModalOpen(true);
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-extrabold shadow-sm transition-all flex items-center gap-1.5"
              >
                <Lock className="w-4 h-4 text-emerald-400" />
                REALIZAR CIERRE DIARIO
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                setActionError(null);
                setIsOpeningModalOpen(true);
              }}
              className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-extrabold shadow-md transition-all flex items-center gap-2"
            >
              <Unlock className="w-4 h-4" />
              ABRIR TURNO DE CAJA
            </button>
          )}
        </div>
      </div>

      {loadError && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {loadError}
        </div>
      )}

      {/* Tarjetas Financieras del Turno Actual */}
      {report && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Fondo Inicial */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Fondo Inicial
            </span>
            <span className="text-lg font-black font-mono text-slate-900 block">
              {formatCurrencyRD(report.openingAmount)}
            </span>
            <span className="text-[10px] text-slate-500 font-medium">Apertura de turno</span>
          </div>

          {/* Ventas Efectivo */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Ventas en Efectivo
            </span>
            <span className="text-lg font-black font-mono text-emerald-700 block">
              +{formatCurrencyRD(report.cashSales)}
            </span>
            <span className="text-[10px] text-slate-500 font-medium">Cobradas al contado</span>
          </div>

          {/* Abonos Clientes */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Abonos de Deuda
            </span>
            <span className="text-lg font-black font-mono text-emerald-700 block">
              +{formatCurrencyRD(report.customerAbonos)}
            </span>
            <span className="text-[10px] text-slate-500 font-medium">Recibidos en efectivo</span>
          </div>

          {/* Ingresos Manuales */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Ingresos Manuales
            </span>
            <span className="text-lg font-black font-mono text-slate-800 block">
              +{formatCurrencyRD(report.manualIngresos)}
            </span>
            <span className="text-[10px] text-slate-500 font-medium">Cambio extra / otros</span>
          </div>

          {/* Retiros Manuales */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Retiros / Salidas
            </span>
            <span className="text-lg font-black font-mono text-rose-600 block">
              -{formatCurrencyRD(report.manualRetiros)}
            </span>
            <span className="text-[10px] text-slate-500 font-medium">Hielo, compras, banco</span>
          </div>

          {/* Total Esperado en Caja (Destacado) */}
          <div className="bg-gradient-to-br from-emerald-50 via-white to-teal-50/60 rounded-2xl p-4 shadow-xs border-2 border-emerald-500/30">
            <span className="text-[11px] font-black text-emerald-800 uppercase tracking-wider block mb-1">
              Efectivo Esperado
            </span>
            <span className="text-xl font-black font-mono text-emerald-800 block">
              {formatCurrencyRD(report.expectedAmount)}
            </span>
            <span className="text-[10px] text-slate-500 font-medium">Debe haber en caja</span>
          </div>
        </div>
      )}

      {/* Historial de Movimientos de la Caja Actual */}
      <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold text-slate-900">Movimientos del Turno Actual</h2>
          <span className="text-xs text-slate-500 font-semibold">{movements.length} transacciones</span>
        </div>

        {movements.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-xs">
            No se han registrado movimientos en esta sesión aún.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-100">
                <tr>
                  <th className="py-2.5 px-3">Hora</th>
                  <th className="py-2.5 px-3">Tipo de Movimiento</th>
                  <th className="py-2.5 px-3">Motivo / Concepto</th>
                  <th className="py-2.5 px-3 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movements.map((m) => {
                  const isPositive = m.type !== "RETIRO_MANUAL";
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-mono text-slate-500">
                        {new Date(m.createdAt).toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                          m.type === "VENTA_EFECTIVO" ? "bg-emerald-50 text-emerald-800" :
                          m.type === "ABONO_EFECTIVO" ? "bg-blue-50 text-blue-800" :
                          m.type === "INGRESO_MANUAL" ? "bg-teal-50 text-teal-800" : "bg-rose-50 text-rose-800"
                        }`}>
                          {m.type.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 font-medium">
                        {m.reason || "Sin detalle"}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-bold font-mono ${isPositive ? "text-emerald-700" : "text-rose-600"}`}>
                        {isPositive ? "+" : "-"}{formatCurrencyRD(m.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: APERTURA DE CAJA */}
      {isOpeningModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 w-full max-w-md space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <Unlock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">Apertura de Turno de Caja</h3>
                <p className="text-xs text-slate-500">Ingrese el monto inicial con que inicia la caja</p>
              </div>
            </div>

            {actionError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                {actionError}
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">Fondo Inicial en Efectivo (RD$)</label>
              <input
                type="text"
                value={openingInput}
                onChange={(e) => setOpeningInput(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-lg font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsOpeningModalOpen(false)}
                className="flex-1 py-3 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleOpenCash}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md"
              >
                Confirmar Apertura
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: INGRESO O RETIRO MANUAL */}
      {isMovementModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 w-full max-w-md space-y-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                movementType === "INGRESO_MANUAL" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
              }`}>
                {movementType === "INGRESO_MANUAL" ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  {movementType === "INGRESO_MANUAL" ? "Ingreso Manual de Efectivo" : "Retiro Manual de Efectivo"}
                </h3>
                <p className="text-xs text-slate-500">
                  {movementType === "INGRESO_MANUAL" ? "Suma al efectivo esperado" : "Resta del efectivo esperado (exige motivo)"}
                </p>
              </div>
            </div>

            {actionError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                {actionError}
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Monto en RD$</label>
              <input
                type="text"
                placeholder="0.00"
                value={movAmount}
                onChange={(e) => setMovAmount(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-base font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Motivo Obligatorio</label>
              <input
                type="text"
                placeholder="Ej: Pago de hielo, bolsitas plásticas..."
                value={movReason}
                onChange={(e) => setMovReason(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsMovementModalOpen(false)}
                className="flex-1 py-3 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveMovement}
                className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md"
              >
                Registrar Movimiento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ARQUEO DE CAJA Y CIERRE DIARIO PASO A PASO */}
      {isClosingModalOpen && report && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
            {/* Header del Cierre */}
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                  <Coins className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">Arqueo Físico y Cierre Diario de Caja</h3>
                  <p className="text-xs text-slate-500 font-medium">Turno #{report.sessionNumber} · Claudette Colbert</p>
                </div>
              </div>
              <button
                onClick={() => setIsClosingModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {/* Contenido con Desglose de Denominaciones */}
            <div className="p-6 overflow-y-auto space-y-5">
              {actionError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              {/* Comparador de Efectivo */}
              <div className="grid grid-cols-3 gap-3 bg-gradient-to-r from-emerald-50/70 via-white to-slate-50 border-2 border-emerald-500/30 p-4 rounded-2xl shadow-sm">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-black block mb-1">Efectivo Esperado</span>
                  <span className="text-lg font-bold font-mono text-slate-900">{formatCurrencyRD(report.expectedAmount)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-emerald-800 uppercase font-black block mb-1">Efectivo Contado</span>
                  <span className="text-xl font-black font-mono text-emerald-700">
                    {formatCurrencyRD(countedFromDenominations)}
                  </span>
                </div>
                <div className="border-l border-emerald-200/60 pl-3">
                  <span className="text-[10px] text-slate-500 uppercase font-black block mb-1">Diferencia</span>
                  <span className={`text-lg font-black font-mono ${
                    differenceDecimal === 0 ? "text-emerald-700" :
                    differenceDecimal < 0 ? "text-rose-600" : "text-amber-700"
                  }`}>
                    {differenceDecimal === 0 ? "RD$ 0.00" : formatCurrencyRD(differenceDecimal)}
                  </span>
                </div>
              </div>

              {/* Mensaje de Estado del Arqueo */}
              {differenceDecimal === 0 ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Caja Cuadrada Exacta: El conteo físico coincide exactamente con las operaciones registradas.</span>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs font-medium space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-amber-800">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Descuadre detectado: {differenceDecimal < 0 ? "Faltante en caja" : "Sobrante en caja"}</span>
                  </div>
                  <p className="text-[11px] text-amber-700">
                    Debe ingresar obligatoriamente una justificación para poder asentar el cierre inmutable en auditoría.
                  </p>
                </div>
              )}

              {/* Tabla de Denominaciones del Peso Dominicano (RD$) */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Conteo Físico por Billetes y Monedas (RD$)
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {DOP_DENOMINATIONS.map((denom) => {
                    const count = denominationCounts[denom.value] || 0;
                    const subtotal = count * parseFloat(denom.value);
                    return (
                      <div
                        key={denom.value}
                        className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                      >
                        <span className="font-bold text-slate-700 w-24">{denom.label}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400 text-[10px]">cant:</span>
                          <input
                            type="number"
                            min="0"
                            value={count || ""}
                            placeholder="0"
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              setDenominationCounts((prev) => ({
                                ...prev,
                                [denom.value]: val,
                              }));
                            }}
                            className="w-14 py-1 px-2 text-center bg-white border border-slate-200 rounded-lg font-mono font-bold text-slate-900 focus:ring-1 focus:ring-emerald-500 outline-none"
                          />
                        </div>
                        <span className="font-mono text-slate-500 font-semibold w-16 text-right">
                          RD${subtotal.toFixed(0)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Campo de Justificación Obligatoria si hay descuadre */}
              {differenceDecimal !== 0 && (
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    Justificación Obligatoria del Descuadre
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Detalle la causa del descuadre (ej: error en cambio devuelto, billete dañado descartado...)"
                    value={diffReason}
                    onChange={(e) => setDiffReason(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              )}
            </div>

            {/* Footer con Confirmación */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-2">
              <button
                type="button"
                onClick={() => setIsClosingModalOpen(false)}
                className="flex-1 py-3 border border-slate-200 bg-white rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCloseCash}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold shadow-md flex items-center justify-center gap-1.5"
              >
                <Lock className="w-4 h-4" />
                ASENTAR CIERRE DEFINITIVO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
