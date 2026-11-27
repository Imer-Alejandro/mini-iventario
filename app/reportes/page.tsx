"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  BarChart3,
  CalendarDays,
  Check,
  CircleDollarSign,
  Clock3,
  FileText,
  PackageCheck,
  RotateCcw,
  Search,
  TrendingUp,
  Users,
} from "lucide-react";
import { formatCurrencyRD } from "@/lib/money";
import { MeatBadge } from "@/lib/icons/meat-icons";

type PaymentFilter = "ALL" | "CONTADO" | "CREDITO";
type Preset = "TODAY" | "7_DAYS" | "30_DAYS" | "THIS_MONTH" | "CUSTOM";

interface Filters {
  fromDate: string;
  toDate: string;
  paymentType: PaymentFilter;
  categoryId: string;
  productId: string;
}

interface ReportData {
  metrics: {
    salesTotal: string;
    salesCount: number;
    averageTicket: string;
    lineCount: number;
    cashTotal: string;
    creditTotal: string;
    voidedCount: number;
    voidedTotal: string;
  };
  dailySales: Array<{ date: string; label: string; total: string }>;
  categorySales: Array<{ name: string; total: string }>;
  topProducts: Array<{ id: string; name: string; iconId?: string; total: string; saleLines: number }>;
  topCustomers: Array<{ id: string; name: string; total: string; tickets: number }>;
  recentSales: Array<{
    id: string;
    number: number;
    createdAt: string;
    customerName: string;
    paymentType: string;
    status: string;
    total: string;
    lineCount: number;
  }>;
  categories: Array<{ id: string; name: string }>;
  products: Array<{ id: string; name: string; categoryId?: string | null }>;
  updatedAt: string;
}

function formatDateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getPresetRange(preset: Exclude<Preset, "CUSTOM">) {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  if (preset === "7_DAYS") start.setDate(start.getDate() - 6);
  if (preset === "30_DAYS") start.setDate(start.getDate() - 29);
  if (preset === "THIS_MONTH") start.setDate(1);
  return { fromDate: formatDateInput(start), toDate: formatDateInput(end) };
}

function getLocalBoundary(value: string, endOfDay: boolean) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(
    year,
    month - 1,
    day,
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0,
  ).toISOString();
}

function MetricCard({
  icon,
  label,
  value,
  helper,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  helper: string;
  tone: string;
}) {
  return (
    <article className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone}`}>{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
        <span className="mt-1 block truncate text-xl font-black tracking-tight text-slate-900">{value}</span>
        <span className="mt-0.5 block truncate text-[10px] text-slate-400">{helper}</span>
      </span>
    </article>
  );
}

export default function ReportesPage() {
  const initialRange = getPresetRange("7_DAYS");
  const [draftFilters, setDraftFilters] = useState<Filters>({
    ...initialRange,
    paymentType: "ALL",
    categoryId: "ALL",
    productId: "ALL",
  });
  const [filters, setFilters] = useState(draftFilters);
  const [preset, setPreset] = useState<Preset>("7_DAYS");
  const [data, setData] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({
      fromDate: filters.fromDate,
      toDate: filters.toDate,
      from: getLocalBoundary(filters.fromDate, false),
      to: getLocalBoundary(filters.toDate, true),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      paymentType: filters.paymentType,
      categoryId: filters.categoryId,
      productId: filters.productId,
    });

    fetch(`/api/reports?${params}`)
      .then(async (response) => {
        const result: ReportData & { error?: string } = await response.json();
        if (!response.ok) throw new Error(result.error || "No se pudieron cargar los reportes.");
        if (active) {
          setData(result);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setData(null);
          setError(cause instanceof Error ? cause.message : "No se pudieron cargar los reportes.");
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [filters, refreshKey]);

  const maxDaily = Math.max(0, ...(data?.dailySales || []).map((day) => Number(day.total)));
  const maxCategory = Math.max(0, ...(data?.categorySales || []).map((category) => Number(category.total)));
  const filteredProducts = (data?.products || []).filter((product) =>
    draftFilters.categoryId === "ALL" || product.categoryId === draftFilters.categoryId,
  );
  const paymentSum = Number(data?.metrics.cashTotal || 0) + Number(data?.metrics.creditTotal || 0);
  const cashPercent = paymentSum > 0 ? (Number(data?.metrics.cashTotal || 0) / paymentSum) * 100 : 0;
  const creditPercent = paymentSum > 0 ? (Number(data?.metrics.creditTotal || 0) / paymentSum) * 100 : 0;

  const handlePreset = (nextPreset: Exclude<Preset, "CUSTOM">) => {
    setDraftFilters((current) => ({ ...current, ...getPresetRange(nextPreset) }));
    setPreset(nextPreset);
    setFilterError(null);
  };

  const handleApplyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draftFilters.fromDate || !draftFilters.toDate || draftFilters.fromDate > draftFilters.toDate) {
      setFilterError("Selecciona un rango válido: la fecha inicial debe ser anterior a la fecha final.");
      return;
    }
    const selectedDays = (
      Date.parse(`${draftFilters.toDate}T00:00:00.000Z`)
      - Date.parse(`${draftFilters.fromDate}T00:00:00.000Z`)
    ) / (24 * 60 * 60 * 1000) + 1;
    if (selectedDays > 366) {
      setFilterError("El rango máximo permitido es de 366 días.");
      return;
    }
    setFilterError(null);
    setIsLoading(true);
    setError(null);
    setFilters({ ...draftFilters });
    setRefreshKey((current) => current + 1);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">
            <BarChart3 className="h-3.5 w-3.5" />
            Análisis del negocio
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Reportes de ventas</h1>
          <p className="mt-1.5 max-w-xl text-sm text-slate-500">
            Filtra por periodo, forma de pago, categoría o producto. Las ventas anuladas no se suman a los ingresos.
          </p>
        </div>
        {data && (
          <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
            <CalendarDays className="h-4 w-4 text-slate-400" />
            {filters.fromDate} — {filters.toDate}
          </div>
        )}
      </header>

      <form onSubmit={handleApplyFilters} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Search className="h-4 w-4 text-emerald-700" />
            Filtros del reporte
          </div>
          <div className="flex flex-wrap gap-1.5">
            {([
              ["TODAY", "Hoy"],
              ["7_DAYS", "7 días"],
              ["30_DAYS", "30 días"],
              ["THIS_MONTH", "Este mes"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => handlePreset(value)}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
                  preset === value
                    ? "bg-emerald-700 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="space-y-1 text-[11px] font-semibold text-slate-600">
            Desde
            <input
              type="date"
              required
              value={draftFilters.fromDate}
              onChange={(event) => {
                setDraftFilters((current) => ({ ...current, fromDate: event.target.value }));
                setPreset("CUSTOM");
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white"
            />
          </label>
          <label className="space-y-1 text-[11px] font-semibold text-slate-600">
            Hasta
            <input
              type="date"
              required
              value={draftFilters.toDate}
              onChange={(event) => {
                setDraftFilters((current) => ({ ...current, toDate: event.target.value }));
                setPreset("CUSTOM");
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white"
            />
          </label>
          <label className="space-y-1 text-[11px] font-semibold text-slate-600">
            Tipo de venta
            <select
              value={draftFilters.paymentType}
              onChange={(event) => setDraftFilters((current) => ({ ...current, paymentType: event.target.value as PaymentFilter }))}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white"
            >
              <option value="ALL">Contado y crédito</option>
              <option value="CONTADO">Contado</option>
              <option value="CREDITO">Crédito</option>
            </select>
          </label>
          <label className="space-y-1 text-[11px] font-semibold text-slate-600">
            Categoría
            <select
              value={draftFilters.categoryId}
              onChange={(event) => setDraftFilters((current) => ({
                ...current,
                categoryId: event.target.value,
                productId: "ALL",
              }))}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white"
            >
              <option value="ALL">Todas las categorías</option>
              {(data?.categories || []).map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-[11px] font-semibold text-slate-600">
            Producto
            <select
              value={draftFilters.productId}
              onChange={(event) => setDraftFilters((current) => ({ ...current, productId: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white"
            >
              <option value="ALL">Todos los productos</option>
              {filteredProducts.map((product) => (
                <option key={product.id} value={product.id}>{product.name}</option>
              ))}
            </select>
          </label>
        </div>

        {filterError && <p role="alert" className="text-xs font-semibold text-rose-700">{filterError}</p>}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <p className="text-[11px] text-slate-500">
            El promedio se calcula sobre los tickets incluidos en los filtros. “Contado” agrupa efectivo y tarjeta.
          </p>
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60"
          >
            <Check className="h-4 w-4" />
            {isLoading ? "Actualizando..." : "Aplicar filtros"}
          </button>
        </div>
      </form>

      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((item) => <div key={item} className="h-24 animate-pulse rounded-2xl bg-slate-100" />)}
        </div>
      ) : data ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              icon={<CircleDollarSign className="h-5 w-5" />}
              label="Ingresos confirmados"
              value={formatCurrencyRD(data.metrics.salesTotal)}
              helper="Excluye ventas anuladas"
              tone="bg-emerald-50 text-emerald-700"
            />
            <MetricCard
              icon={<FileText className="h-5 w-5" />}
              label="Tickets"
              value={String(data.metrics.salesCount)}
              helper={`${data.metrics.voidedCount} anulados en el periodo`}
              tone="bg-blue-50 text-blue-700"
            />
            <MetricCard
              icon={<TrendingUp className="h-5 w-5" />}
              label="Promedio por ticket"
              value={formatCurrencyRD(data.metrics.averageTicket)}
              helper="Ingresos ÷ tickets filtrados"
              tone="bg-violet-50 text-violet-700"
            />
            <MetricCard
              icon={<PackageCheck className="h-5 w-5" />}
              label="Líneas vendidas"
              value={String(data.metrics.lineCount)}
              helper="Renglones de productos en tickets"
              tone="bg-amber-50 text-amber-700"
            />
          </section>

          <section className="grid gap-5 lg:grid-cols-12">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-8 sm:p-6">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Ingresos por día</h2>
                  <p className="mt-1 text-xs text-slate-500">Solo ventas confirmadas, dentro del periodo y filtros seleccionados.</p>
                </div>
                <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-800">
                  {data.dailySales.length} días
                </span>
              </div>
              {data.dailySales.some((day) => Number(day.total) > 0) ? (
                <div className="overflow-x-auto pb-2">
                  <div className="flex h-64 min-w-max items-end gap-2 border-b border-slate-100 px-1 sm:gap-3">
                    {data.dailySales.map((day) => {
                      const total = Number(day.total);
                      const height = maxDaily > 0 ? (total / maxDaily) * 100 : 0;
                      return (
                        <div key={day.date} className="group flex h-full w-10 flex-col items-center justify-end gap-2">
                          <span className="text-[9px] font-medium text-slate-500 opacity-0 transition group-hover:opacity-100" title={formatCurrencyRD(day.total)}>
                            {total > 0 ? formatCurrencyRD(day.total) : ""}
                          </span>
                          <div className="flex h-[78%] w-full items-end justify-center">
                            <div
                              className={`w-7 rounded-t-lg transition ${total > 0 ? "bg-emerald-600 group-hover:bg-emerald-700" : "bg-slate-100"}`}
                              style={{ height: `${height}%` }}
                              title={`${day.date}: ${formatCurrencyRD(day.total)}`}
                            />
                          </div>
                          <span className="whitespace-nowrap text-[9px] font-semibold text-slate-500">{day.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="py-16 text-center text-sm text-slate-400">No hay ventas confirmadas en este periodo.</p>
              )}
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-4 sm:p-6">
              <div className="mb-5">
                <h2 className="text-base font-bold text-slate-900">Forma de venta</h2>
                <p className="mt-1 text-xs text-slate-500">Contado y crédito según los filtros actuales.</p>
              </div>
              <div className="space-y-5">
                <div>
                  <div className="mb-1.5 flex justify-between text-xs">
                    <span className="font-semibold text-slate-600">Contado</span>
                    <span className="font-bold text-slate-900">{formatCurrencyRD(data.metrics.cashTotal)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-emerald-600" style={{ width: `${cashPercent}%` }} />
                  </div>
                </div>
                <div>
                  <div className="mb-1.5 flex justify-between text-xs">
                    <span className="font-semibold text-slate-600">Crédito</span>
                    <span className="font-bold text-slate-900">{formatCurrencyRD(data.metrics.creditTotal)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-violet-500" style={{ width: `${creditPercent}%` }} />
                  </div>
                </div>
              </div>
              <div className="mt-6 rounded-xl border border-rose-100 bg-rose-50/70 p-3">
                <div className="flex items-center gap-2 text-xs font-bold text-rose-800">
                  <RotateCcw className="h-4 w-4" />
                  Ventas anuladas
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-2">
                  <span className="text-xl font-black text-rose-900">{data.metrics.voidedCount} tickets</span>
                  <span className="text-xs font-bold text-rose-800">{formatCurrencyRD(data.metrics.voidedTotal)}</span>
                </div>
                <p className="mt-1 text-[10px] text-rose-700">Se muestran aparte y no se suman a los ingresos.</p>
              </div>
            </article>
          </section>

          <section className="grid gap-5 lg:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5">
                <h2 className="text-base font-bold text-slate-900">Ventas por categoría</h2>
                <p className="mt-1 text-xs text-slate-500">Importe de líneas confirmadas; el filtro de producto/categoría se respeta.</p>
              </div>
              {data.categorySales.length ? (
                <div className="space-y-4">
                  {data.categorySales.map((category, index) => (
                    <div key={category.name}>
                      <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                        <span className="truncate font-semibold text-slate-700">{category.name}</span>
                        <span className="shrink-0 font-bold text-slate-900">{formatCurrencyRD(category.total)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full ${["bg-emerald-600", "bg-teal-500", "bg-cyan-500", "bg-sky-500"][index % 4]}`}
                          style={{ width: `${maxCategory > 0 ? (Number(category.total) / maxCategory) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-10 text-center text-sm text-slate-400">Sin ventas por categoría en esta selección.</p>
              )}
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-4">
                <h2 className="text-base font-bold text-slate-900">Productos con mayor ingreso</h2>
                <p className="mt-1 text-xs text-slate-500">Ordenados por importe confirmado. “Líneas” indica en cuántos renglones aparecen.</p>
              </div>
              {data.topProducts.length ? (
                <div className="divide-y divide-slate-100">
                  {data.topProducts.map((product, index) => (
                    <div key={product.id} className="flex items-center gap-3 py-3">
                      <span className="w-6 text-center text-xs font-bold text-slate-400">{String(index + 1).padStart(2, "0")}</span>
                      <MeatBadge iconId={product.iconId} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800">{product.name}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500">{product.saleLines} líneas vendidas</p>
                      </div>
                      <p className="shrink-0 text-sm font-bold text-slate-900">{formatCurrencyRD(product.total)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-10 text-center text-sm text-slate-400">No hay productos vendidos en esta selección.</p>
              )}
            </article>
          </section>

          <section className="grid gap-5 lg:grid-cols-12">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-5 sm:p-6">
              <div className="mb-4 flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-700" />
                <div>
                  <h2 className="text-base font-bold text-slate-900">Clientes principales</h2>
                  <p className="mt-1 text-xs text-slate-500">Solo ventas asociadas a clientes registrados.</p>
                </div>
              </div>
              {data.topCustomers.length ? (
                <div className="divide-y divide-slate-100">
                  {data.topCustomers.map((customer, index) => (
                    <div key={customer.id} className="flex items-center gap-3 py-3">
                      <span className="w-6 text-center text-xs font-bold text-slate-400">{String(index + 1).padStart(2, "0")}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800">{customer.name}</p>
                        <p className="text-[11px] text-slate-500">{customer.tickets} tickets</p>
                      </div>
                      <span className="shrink-0 text-sm font-bold text-slate-900">{formatCurrencyRD(customer.total)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-slate-400">No hay clientes registrados en las ventas filtradas.</p>
              )}
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-7 sm:p-6">
              <div className="mb-4 flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-emerald-700" />
                <div>
                  <h2 className="text-base font-bold text-slate-900">Ventas recientes del periodo</h2>
                  <p className="mt-1 text-xs text-slate-500">Incluye anuladas, claramente marcadas y fuera del total de ingresos.</p>
                </div>
              </div>
              {data.recentSales.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-xs">
                    <thead className="border-b border-slate-100 text-[10px] uppercase text-slate-400">
                      <tr>
                        <th className="py-2 pr-3">Venta</th>
                        <th className="py-2 pr-3">Cliente</th>
                        <th className="py-2 pr-3">Tipo / estado</th>
                        <th className="py-2 text-right">Total filtrado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.recentSales.map((sale) => (
                        <tr key={sale.id}>
                          <td className="py-2.5 pr-3">
                            <span className="block font-bold text-slate-800">#{sale.number}</span>
                            <span className="text-[10px] text-slate-500">
                              {new Date(sale.createdAt).toLocaleString("es-DO", { dateStyle: "short", timeStyle: "short" })}
                            </span>
                          </td>
                          <td className="max-w-40 truncate py-2.5 pr-3 text-slate-600">{sale.customerName}</td>
                          <td className="py-2.5 pr-3">
                            <span className="block text-slate-600">{sale.paymentType === "CREDITO" ? "Crédito" : "Contado"}</span>
                            <span className={`text-[10px] font-bold ${sale.status === "VOIDED" ? "text-rose-700" : "text-emerald-700"}`}>
                              {sale.status === "VOIDED" ? "Anulada" : `${sale.lineCount} líneas`}
                            </span>
                          </td>
                          <td className={`py-2.5 text-right font-bold ${sale.status === "VOIDED" ? "text-rose-700 line-through" : "text-slate-900"}`}>
                            {formatCurrencyRD(sale.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-slate-400">No hay ventas para mostrar.</p>
              )}
            </article>
          </section>
          <p className="flex items-center justify-end gap-1 text-[10px] text-slate-400">
            <Clock3 className="h-3 w-3" />
            Datos actualizados: {new Date(data.updatedAt).toLocaleString("es-DO", { dateStyle: "short", timeStyle: "short" })}
          </p>
        </>
      ) : null}
    </div>
  );
}
