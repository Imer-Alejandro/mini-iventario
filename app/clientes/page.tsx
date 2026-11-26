"use client";

import { useState, useEffect } from "react";
import {
  Users,
  Plus,
  Search,
  FileText,
  ArrowDownLeft,
  X,
  Pencil,
} from "lucide-react";
import { formatCurrencyRD, sumLineTotals, validateAndParseAmount } from "@/lib/money";

interface Customer {
  id: string;
  name: string;
  documentId?: string;
  phone?: string;
  address?: string;
  creditLimit: string;
  balance: string;
  status: "ACTIVE" | "BLOCKED";
  ledgerCount?: number;
}

interface LedgerEntry {
  id: string;
  type: string;
  amount: string;
  note?: string;
  createdAt: string;
}

export default function ClientesPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerLedger, setCustomerLedger] = useState<LedgerEntry[]>([]);
  const [isLoadingLedger, setIsLoadingLedger] = useState(false);

  // Modal de Abono
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"EFECTIVO" | "TRANSFERENCIA" | "TARJETA">("EFECTIVO");
  const [paymentNote, setPaymentNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isCustomerFormOpen, setIsCustomerFormOpen] = useState(false);
  const [customerFormError, setCustomerFormError] = useState<string | null>(null);
  const [customerForm, setCustomerForm] = useState({
    name: "",
    documentId: "",
    phone: "",
    address: "",
    creditLimit: "0",
    status: "ACTIVE" as "ACTIVE" | "BLOCKED",
  });

  const fetchCustomers = () => {
    fetch("/api/customers")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setCustomers(data);
      })
      .catch(() => {});
  };

  const openCustomerForm = (customer?: Customer) => {
    setEditingCustomer(customer || null);
    setCustomerFormError(null);
    setCustomerForm({
      name: customer?.name || "",
      documentId: customer?.documentId || "",
      phone: customer?.phone || "",
      address: customer?.address || "",
      creditLimit: customer?.creditLimit || "0",
      status: customer?.status || "ACTIVE",
    });
    setIsCustomerFormOpen(true);
  };

  const handleSaveCustomer = async () => {
    if (!customerForm.name.trim()) {
      setCustomerFormError("El nombre del cliente es obligatorio.");
      return;
    }
    try {
      validateAndParseAmount(customerForm.creditLimit);
    } catch (error) {
      setCustomerFormError(error instanceof Error ? error.message : "El límite de crédito debe tener máximo 2 decimales.");
      return;
    }

    try {
      setIsSubmitting(true);
      setCustomerFormError(null);
      const response = await fetch("/api/customers", {
        method: editingCustomer ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...customerForm, id: editingCustomer?.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo guardar el cliente.");
      setIsCustomerFormOpen(false);
      setEditingCustomer(null);
      fetchCustomers();
    } catch (error) {
      setCustomerFormError(error instanceof Error ? error.message : "No se pudo guardar el cliente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const openCustomerStatement = async (cust: Customer) => {
    setSelectedCustomer(cust);
    setIsLoadingLedger(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/customers/${cust.id}/payments`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo cargar el estado de cuenta.");
      if (data.ledger) setCustomerLedger(data.ledger);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "No se pudo cargar el estado de cuenta.");
    } finally {
      setIsLoadingLedger(false);
    }
  };

  const handleRegisterPayment = async () => {
    if (!selectedCustomer) return;
    try {
      setIsSubmitting(true);
      setActionError(null);

      if (validateAndParseAmount(paymentAmount).isZero()) {
        setActionError("El monto del abono debe ser mayor a cero");
        return;
      }

      const res = await fetch(`/api/customers/${selectedCustomer.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: paymentAmount,
          paymentMethod,
          note: paymentNote || `Abono a cuenta corriente vía ${paymentMethod}`,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al procesar el abono");
      }

      const result = await res.json();
      setIsPaymentModalOpen(false);
      setPaymentAmount("");
      setPaymentNote("");

      // Refrescar estado del cliente
      fetchCustomers();
      if (result.customer) {
        setSelectedCustomer(result.customer);
      }
      openCustomerStatement(result.customer || selectedCustomer);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "No se pudo registrar el abono.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.documentId && c.documentId.includes(searchQuery))
  );

  const totalDebt = sumLineTotals(customers.map((customer) => customer.balance || "0"));

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Encabezado */}
      <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
            <Users className="w-7 h-7 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Clientes y Crédito</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Cuentas por cobrar · Libro mayor trazable · Control estricto de cupo
            </p>
          </div>
        </div>

        {/* Total Cartera por Cobrar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-slate-50 border border-slate-200/80 px-5 py-3 rounded-2xl text-right">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cartera Total por Cobrar</span>
            <span className="text-xl font-black font-mono text-rose-700">{formatCurrencyRD(totalDebt)}</span>
          </div>
          <button type="button" onClick={() => openCustomerForm()} className="inline-flex items-center gap-2 rounded-xl bg-[#176b5d] px-4 py-3 text-xs font-bold text-white transition hover:bg-[#12584d]">
            <Plus className="h-4 w-4" />
            Nuevo cliente
          </button>
        </div>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Buscar cliente por nombre o RNC/Cédula..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium shadow-xs focus:ring-2 focus:ring-emerald-500 outline-none"
        />
      </div>

      {/* Grid de Clientes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCustomers.map((cust) => {
          const balDec = parseFloat(cust.balance);
          const limitDec = parseFloat(cust.creditLimit);
          const hasDebt = balDec > 0;
          const usagePct = limitDec > 0 ? Math.min(100, Math.round((balDec / limitDec) * 100)) : 0;

          return (
            <div
              key={cust.id}
              className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs hover:border-emerald-500 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-extrabold text-slate-900 text-base leading-snug">{cust.name}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    cust.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700"
                  }`}>
                    {cust.status === "ACTIVE" ? "Activo" : "Bloqueado"}
                  </span>
                </div>

                <p className="text-xs text-slate-500 font-mono mb-3">
                  {cust.documentId || "Sin documento"} {cust.phone ? `· ${cust.phone}` : ""}
                </p>

                {/* Saldo y Límite */}
                <div className="bg-slate-50 p-3.5 rounded-2xl space-y-2 mb-3">
                  <div className="flex justify-between items-baseline text-xs">
                    <span className="text-slate-500 font-medium">Deuda Pendiente:</span>
                    <span className={`font-mono font-black text-sm ${hasDebt ? "text-rose-600" : "text-emerald-700"}`}>
                      {formatCurrencyRD(cust.balance)}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline text-xs">
                    <span className="text-slate-500 font-medium">Límite Aprobado:</span>
                    <span className="font-mono font-bold text-slate-700">
                      {formatCurrencyRD(cust.creditLimit)}
                    </span>
                  </div>

                  {/* Barra de progreso de uso de crédito */}
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1">
                    <div
                      className={`h-full rounded-full ${usagePct > 80 ? "bg-rose-500" : "bg-emerald-500"}`}
                      style={{ width: `${usagePct}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Botón Ver Estado de Cuenta */}
              <div className="mt-4 grid grid-cols-[auto_1fr] gap-2">
                <button
                  type="button"
                  onClick={() => openCustomerForm(cust)}
                  aria-label={`Editar ${cust.name}`}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => openCustomerStatement(cust)}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-[#183044] py-2.5 text-xs font-bold text-white transition hover:bg-[#24455f]"
                >
                  <FileText className="h-3.5 w-3.5 text-emerald-300" />
                  Estado de cuenta / abono
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {isCustomerFormOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/35 p-3 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-7">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">Directorio</p>
                <h2 className="text-xl font-bold tracking-tight text-slate-900">{editingCustomer ? "Editar cliente" : "Crear cliente"}</h2>
                <p className="mt-1 text-sm text-slate-500">Datos de contacto y condiciones de crédito.</p>
              </div>
              <button type="button" onClick={() => setIsCustomerFormOpen(false)} aria-label="Cerrar" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-5 w-5" /></button>
            </div>
            {customerFormError && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">{customerFormError}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5 text-xs font-semibold text-slate-600 sm:col-span-2">
                Nombre o razón social
                <input value={customerForm.name} onChange={(event) => setCustomerForm({ ...customerForm, name: event.target.value })} placeholder="Ej. Restaurante El Buen Corte" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500" />
              </label>
              <label className="space-y-1.5 text-xs font-semibold text-slate-600">
                Cédula o RNC
                <input value={customerForm.documentId} onChange={(event) => setCustomerForm({ ...customerForm, documentId: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500" />
              </label>
              <label className="space-y-1.5 text-xs font-semibold text-slate-600">
                Teléfono
                <input value={customerForm.phone} onChange={(event) => setCustomerForm({ ...customerForm, phone: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500" />
              </label>
              <label className="space-y-1.5 text-xs font-semibold text-slate-600 sm:col-span-2">
                Dirección
                <input value={customerForm.address} onChange={(event) => setCustomerForm({ ...customerForm, address: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500" />
              </label>
              <label className="space-y-1.5 text-xs font-semibold text-slate-600">
                Límite de crédito (RD$)
                <input type="text" inputMode="decimal" value={customerForm.creditLimit} onChange={(event) => setCustomerForm({ ...customerForm, creditLimit: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500" />
              </label>
              <label className="space-y-1.5 text-xs font-semibold text-slate-600">
                Estado
                <select value={customerForm.status} onChange={(event) => setCustomerForm({ ...customerForm, status: event.target.value as "ACTIVE" | "BLOCKED" })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500">
                  <option value="ACTIVE">Activo</option>
                  <option value="BLOCKED">Bloqueado</option>
                </select>
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button type="button" onClick={() => setIsCustomerFormOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button type="button" onClick={handleSaveCustomer} disabled={isSubmitting} className="rounded-xl bg-[#176b5d] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#12584d] disabled:opacity-60">{isSubmitting ? "Guardando..." : editingCustomer ? "Guardar cambios" : "Crear cliente"}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ESTADO DE CUENTA Y ABONOS */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">{selectedCustomer.name}</h3>
                <p className="text-xs text-slate-500 font-medium">
                  {selectedCustomer.documentId} · Tel: {selectedCustomer.phone || "N/A"}
                </p>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Resumen de Deuda y Botón Abono */}
            <div className="p-5 bg-gradient-to-r from-rose-50/80 via-white to-amber-50/60 border-b border-rose-100 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-black block mb-1">Deuda Actual</span>
                <span className="text-3xl font-black font-mono text-rose-700">
                  {formatCurrencyRD(selectedCustomer.balance)}
                </span>
                <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
                  Límite aprobado: {formatCurrencyRD(selectedCustomer.creditLimit)}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCustomer(null);
                    openCustomerForm(selectedCustomer);
                  }}
                  className="px-4 py-3 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-2 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                  EDITAR CLIENTE
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActionError(null);
                    setIsPaymentModalOpen(true);
                  }}
                  className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center gap-2 transition-colors"
                >
                  <ArrowDownLeft className="w-4 h-4" />
                  REGISTRAR ABONO
                </button>
              </div>
            </div>
            {actionError && <p role="alert" className="mx-5 mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{actionError}</p>}

            {/* Libro Mayor Trazable */}
            <div className="p-5 overflow-y-auto space-y-3 flex-1">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Libro Mayor de Movimientos (Trazabilidad)
              </h4>

              {isLoadingLedger ? (
                <p className="text-xs text-slate-400 py-6 text-center">Cargando movimientos...</p>
              ) : customerLedger.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">No hay movimientos registrados.</p>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                  {customerLedger.map((mov) => {
                    const isVenta = mov.type === "VENTA";
                    return (
                      <div key={mov.id} className="p-3 bg-white flex items-center justify-between text-xs">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isVenta ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
                            }`}>
                              {mov.type}
                            </span>
                            <span className="font-semibold text-slate-800">{mov.note || "Sin nota"}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                            {new Date(mov.createdAt).toLocaleDateString("es-DO")} {new Date(mov.createdAt).toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>

                        <span className={`font-mono font-bold text-sm ${isVenta ? "text-rose-600" : "text-emerald-700"}`}>
                          {isVenta ? "+" : ""}{formatCurrencyRD(mov.amount)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUBMODAL: REGISTRAR ABONO */}
      {isPaymentModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 w-full max-w-md space-y-4">
            <h3 className="font-extrabold text-slate-900 text-base">Registrar Abono a Deuda</h3>
            <p className="text-xs text-slate-500">
              Cliente: <span className="font-bold text-slate-800">{selectedCustomer.name}</span>
            </p>

            {actionError && (
              <div className="p-3 bg-rose-50 text-rose-800 border border-rose-200 text-xs rounded-xl font-semibold">
                {actionError}
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Monto del Abono en RD$</label>
              <input
                type="text"
                placeholder="0.00"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-base font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Método de Pago</label>
              <div className="grid grid-cols-3 gap-2">
                {(["EFECTIVO", "TRANSFERENCIA", "TARJETA"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethod(m)}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                      paymentMethod === m
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-slate-50 text-slate-700 border-slate-200"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              {paymentMethod === "EFECTIVO" && (
                <span className="text-[10px] text-emerald-700 font-semibold block mt-1">
                  ✓ El efectivo ingresará automáticamente a la caja abierta de hoy.
                </span>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Nota / Referencia</label>
              <input
                type="text"
                placeholder="Ej: Pago quincenal en efectivo..."
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="flex-1 py-3 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRegisterPayment}
                disabled={isSubmitting}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold shadow-md"
              >
                {isSubmitting ? "Guardando..." : "Confirmar Abono"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
