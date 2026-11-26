"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Building2, CreditCard, DollarSign, Pencil, Plus, Search, Truck, X } from "lucide-react";
import { formatCurrencyRD, sumLineTotals, validateAndParseAmount } from "@/lib/money";

interface Supplier {
  id: string;
  name: string;
  rnc?: string | null;
  phone?: string | null;
  address?: string | null;
  contact?: string | null;
  paymentTerms?: string | null;
  balance: string;
  status: "ACTIVE" | "INACTIVE";
  ledgerCount?: number;
}

interface LedgerEntry {
  id: string;
  type: "FACTURA" | "PAGO" | "AJUSTE";
  amount: string;
  referenceId?: string | null;
  note?: string | null;
  createdAt: string;
}

const PAYMENT_TERMS = [
  { value: "CONTADO", label: "Contado" },
  { value: "CREDITO_7_DIAS", label: "Crédito a 7 días" },
  { value: "CREDITO_15_DIAS", label: "Crédito a 15 días" },
  { value: "CREDITO_30_DIAS", label: "Crédito a 30 días" },
  { value: "CREDITO_45_DIAS", label: "Crédito a 45 días" },
  { value: "CREDITO_60_DIAS", label: "Crédito a 60 días" },
  { value: "CREDITO_90_DIAS", label: "Crédito a 90 días" },
] as const;

function getPaymentTermLabel(value?: string | null) {
  return PAYMENT_TERMS.find((option) => option.value === value)?.label
    || value
    || "Sin condiciones de pago registradas";
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isMovementOpen, setIsMovementOpen] = useState(false);
  const [movementType, setMovementType] = useState<"FACTURA" | "PAGO" | "AJUSTE">("FACTURA");
  const [cashSessionId, setCashSessionId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState({
    name: "", rnc: "", phone: "", address: "", contact: "", paymentTerms: "CONTADO", status: "ACTIVE",
  });
  const [movement, setMovement] = useState({
    amount: "", referenceId: "", note: "", paymentMethod: "EFECTIVO" as "EFECTIVO" | "TRANSFERENCIA" | "TARJETA",
  });

  const loadSuppliers = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/suppliers", { cache: "no-store" });
      const data = await response.json() as Supplier[] | { error?: string };
      if (!response.ok) throw new Error("error" in data ? data.error : "No se pudieron cargar los proveedores.");
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los proveedores.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/suppliers", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as Supplier[] | { error?: string };
        if (!response.ok) throw new Error("error" in data ? data.error : "No se pudieron cargar los proveedores.");
        if (active) setSuppliers(Array.isArray(data) ? data : []);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los proveedores.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function openForm(supplier?: Supplier) {
    setEditingId(supplier?.id || "");
    setForm({
      name: supplier?.name || "",
      rnc: supplier?.rnc || "",
      phone: supplier?.phone || "",
      address: supplier?.address || "",
      contact: supplier?.contact || "",
      paymentTerms: PAYMENT_TERMS.some((option) => option.value === supplier?.paymentTerms)
        ? supplier?.paymentTerms || "CONTADO"
        : "CONTADO",
      status: supplier?.status || "ACTIVE",
    });
    setError("");
    setIsFormOpen(true);
  }

  async function saveSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/suppliers", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, id: editingId || undefined }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "No se pudo guardar el proveedor.");
      setNotice(editingId ? "Proveedor actualizado." : "Proveedor creado.");
      setIsFormOpen(false);
      await loadSuppliers();
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar el proveedor.");
    }
  }

  async function openStatement(supplier: Supplier) {
    setSelected(supplier);
    setLedger([]);
    setError("");
    try {
      const response = await fetch(`/api/suppliers/${supplier.id}/ledger`, { cache: "no-store" });
      const data = await response.json() as { supplier?: Supplier; ledger?: LedgerEntry[]; error?: string };
      if (!response.ok) throw new Error(data.error || "No se pudo cargar el estado de cuenta.");
      setSelected(data.supplier || supplier);
      setLedger(data.ledger || []);
    } catch (statementError: unknown) {
      setError(statementError instanceof Error ? statementError.message : "No se pudo cargar el estado de cuenta.");
    }
  }

  function openMovement(type: "FACTURA" | "PAGO" | "AJUSTE") {
    setMovementType(type);
    setMovement({ amount: "", referenceId: "", note: "", paymentMethod: "EFECTIVO" });
    setError("");
    setNotice("");
    setIsMovementOpen(true);
    if (type === "PAGO") {
      fetch("/api/cash")
        .then((response) => response.json())
        .then((data) => setCashSessionId(data.active ? data.report?.sessionId || "" : ""))
        .catch(() => setCashSessionId(""));
    }
  }

  async function saveMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setError("");
    setNotice("");
    try {
      if (validateAndParseAmount(movement.amount).isZero()) {
        throw new Error("El monto debe ser mayor que cero.");
      }
    } catch (validationError: unknown) {
      setError(validationError instanceof Error ? validationError.message : "El monto debe ser mayor que cero.");
      return;
    }
    try {
      const response = await fetch(`/api/suppliers/${selected.id}/ledger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: movementType,
          amount: movement.amount,
          referenceId: movement.referenceId,
          note: movement.note,
          paymentMethod: movement.paymentMethod,
          ...(movementType === "PAGO" && movement.paymentMethod === "EFECTIVO"
            ? { cashSessionId }
            : {}),
        }),
      });
      const result = await response.json() as { supplier?: Supplier; error?: string };
      if (!response.ok) throw new Error(result.error || "No se pudo registrar el movimiento.");
      setNotice(movementType === "PAGO" ? "Pago registrado." : movementType === "FACTURA" ? "Factura registrada." : "Saldo ajustado.");
      setIsMovementOpen(false);
      if (result.supplier) setSelected(result.supplier);
      await Promise.all([loadSuppliers(), openStatement(result.supplier || selected)]);
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo registrar el movimiento.");
    }
  }

  const filtered = suppliers.filter((supplier) =>
    [supplier.name, supplier.rnc, supplier.phone, supplier.contact]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(search.trim().toLowerCase())),
  );
  const totalDebt = sumLineTotals(suppliers.map((supplier) => supplier.balance || "0"));

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200/80 bg-white p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-emerald-400">
            <Truck className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Proveedores y Deudas</h1>
            <p className="mt-1 text-sm text-slate-500">Cuentas por pagar, facturas y pagos trazables</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-right">
            <span className="block text-[10px] font-bold uppercase text-slate-400">Deuda total</span>
            <span className="font-mono text-xl font-black text-rose-700">{formatCurrencyRD(totalDebt)}</span>
          </div>
          <button type="button" onClick={() => openForm()} className="inline-flex items-center gap-2 rounded-xl bg-[#176b5d] px-4 py-3 text-xs font-bold text-white hover:bg-[#12584d]">
            <Plus className="h-4 w-4" /> Nuevo proveedor
          </button>
        </div>
      </header>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</p>}

      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar proveedor..." className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 outline-none focus:border-emerald-500" />
      </div>
      {isLoading ? (
        <p className="rounded-2xl bg-white p-5 text-sm text-slate-500">Cargando proveedores…</p>
      ) : (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((supplier) => (
            <article key={supplier.id} className="rounded-2xl border border-white bg-white/90 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-black text-slate-900">{supplier.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{supplier.rnc || "Sin RNC"} · {supplier.phone || "Sin teléfono"}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-black text-rose-700">{formatCurrencyRD(supplier.balance)}</p>
                  <span className={`mt-1 inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${supplier.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                    {supplier.status === "ACTIVE" ? "Activo" : "Inactivo"}
                  </span>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => void openStatement(supplier)} className="flex-1 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white">
                  Estado de cuenta
                </button>
                <button type="button" onClick={() => openForm(supplier)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </button>
              </div>
            </article>
          ))}
          {filtered.length === 0 && <p className="rounded-2xl bg-white p-5 text-sm text-slate-500">No se encontraron proveedores.</p>}
        </section>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <section role="dialog" aria-modal="true" aria-labelledby="supplier-statement-title" onClick={(event) => event.stopPropagation()} className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <header className="flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-50 p-5">
              <div>
                <h2 id="supplier-statement-title" className="text-lg font-black text-slate-900">{selected.name}</h2>
                <p className="text-sm text-slate-500">{getPaymentTermLabel(selected.paymentTerms)}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Cerrar estado de cuenta" className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700"><X className="h-5 w-5" /></button>
            </header>
            {error && <p role="alert" className="mx-5 mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400">Saldo pendiente</p>
                <p className="font-mono text-2xl font-black text-rose-700">{formatCurrencyRD(selected.balance)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => { const supplier = selected; setSelected(null); openForm(supplier); }} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700"><Pencil className="h-4 w-4" /> Editar</button>
                <button type="button" onClick={() => openMovement("FACTURA")} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white"><Building2 className="h-4 w-4" /> Registrar factura</button>
                <button type="button" onClick={() => openMovement("PAGO")} className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800"><DollarSign className="h-4 w-4" /> Registrar pago</button>
                <button type="button" onClick={() => openMovement("AJUSTE")} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700"><CreditCard className="h-4 w-4" /> Ajustar saldo</button>
              </div>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Libro mayor de movimientos</h3>
              {ledger.map((entry) => (
                <article key={entry.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-3">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{entry.type}{entry.referenceId ? ` · ${entry.referenceId}` : ""}</p>
                    <p className="text-xs text-slate-500">{entry.note || "Sin nota"} · {new Date(entry.createdAt).toLocaleString("es-DO")}</p>
                  </div>
                  <span className={`font-mono text-sm font-black ${entry.type === "PAGO" ? "text-emerald-700" : "text-rose-700"}`}>
                    {entry.type === "PAGO" ? "−" : "+"}{formatCurrencyRD(entry.amount)}
                  </span>
                </article>
              ))}
              {ledger.length === 0 && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No hay movimientos registrados.</p>}
            </div>
          </section>
        </div>
      )}

      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-sm">
          <form onSubmit={saveSupplier} className="max-h-[90vh] w-full max-w-lg overflow-y-auto space-y-4 rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-black text-slate-900">{editingId ? "Editar proveedor" : "Nuevo proveedor"}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                ["name", "Nombre"],
                ["rnc", "RNC / Cédula"],
                ["phone", "Teléfono"],
                ["contact", "Contacto"],
                ["address", "Dirección"],
              ] as const).map(([field, label]) => (
                <label key={field} className="space-y-1 text-sm font-semibold text-slate-700">{label}
                  <input required={field === "name"} value={form[field]} onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5" />
                </label>
              ))}
              <label className="space-y-1 text-sm font-semibold text-slate-700">Condiciones de pago
                <select required value={form.paymentTerms} onChange={(event) => setForm((current) => ({ ...current, paymentTerms: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                  {PAYMENT_TERMS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm font-semibold text-slate-700">Estado
                <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                  <option value="ACTIVE">Activo</option>
                  <option value="INACTIVE">Inactivo</option>
                </select>
              </label>
            </div>
            {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
            <div className="flex gap-2">
              <button className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white">{editingId ? "Guardar cambios" : "Crear proveedor"}</button>
              <button type="button" onClick={() => setIsFormOpen(false)} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600">Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {isMovementOpen && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-sm">
          <form onSubmit={saveMovement} className="w-full max-w-md space-y-4 rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-black text-slate-900">
              {movementType === "PAGO" ? "Registrar pago" : movementType === "FACTURA" ? "Registrar factura" : "Ajustar saldo"}
            </h2>
            <label className="block space-y-1 text-sm font-semibold text-slate-700">Monto
              <input required type="text" inputMode="decimal" value={movement.amount} onChange={(event) => setMovement((current) => ({ ...current, amount: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5" />
            </label>
            <label className="block space-y-1 text-sm font-semibold text-slate-700">Referencia
              <input value={movement.referenceId} onChange={(event) => setMovement((current) => ({ ...current, referenceId: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5" />
            </label>
            {movementType === "PAGO" && (
              <label className="block space-y-1 text-sm font-semibold text-slate-700">Método de pago
                <select value={movement.paymentMethod} onChange={(event) => setMovement((current) => ({ ...current, paymentMethod: event.target.value as typeof current.paymentMethod }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="TRANSFERENCIA">Transferencia</option>
                  <option value="TARJETA">Tarjeta</option>
                </select>
              </label>
            )}
            <label className="block space-y-1 text-sm font-semibold text-slate-700">Nota
              <textarea value={movement.note} onChange={(event) => setMovement((current) => ({ ...current, note: event.target.value }))} rows={3} className="w-full rounded-xl border border-slate-200 px-3 py-2.5" />
            </label>
            {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
            <div className="flex gap-2">
              <button className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white">Registrar</button>
              <button type="button" onClick={() => setIsMovementOpen(false)} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600">Cancelar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
