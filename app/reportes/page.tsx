"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarDays, CircleDollarSign, PackageCheck, TrendingUp } from "lucide-react";
import { formatCurrencyRD } from "@/lib/money";
import { MeatBadge } from "@/lib/icons/meat-icons";

interface ReportData {
  dailySales: Array<{ date: string; label: string; total: string }>;
  categorySales: Array<{ name: string; total: string }>;
  topProducts: Array<{ id: string; name: string; unit: string; iconId?: string; quantity: string; total: string }>;
}

export default function ReportesPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "No se pudieron cargar los reportes.");
        setData(result);
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "No se pudieron cargar los reportes."))
      .finally(() => setIsLoading(false));
  }, []);

  const weekTotal = useMemo(
    () => (data?.dailySales || []).reduce((sum, day) => sum + Number(day.total), 0),
    [data],
  );
  const bestDay = useMemo(
    () => (data?.dailySales || []).reduce((best, day) => Number(day.total) > Number(best?.total || 0) ? day : best, data?.dailySales[0]),
    [data],
  );
  const maxDaily = Math.max(...(data?.dailySales || []).map((day) => Number(day.total)), 1);
  const maxCategory = Math.max(...(data?.categorySales || []).map((category) => Number(category.total)), 1);

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">
            <BarChart3 className="h-3.5 w-3.5" />
            Análisis del negocio
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Reportes de ventas</h1>
          <p className="mt-1.5 max-w-xl text-sm text-slate-500">Visualiza tendencias recientes, categorías y productos con mayor movimiento.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
          <CalendarDays className="h-4 w-4 text-slate-400" />
          Últimos 7 días
        </div>
      </header>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <section className="grid gap-3 sm:grid-cols-3">
        <article className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><CircleDollarSign className="h-5 w-5" /></span>
          <span>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Ventas en 7 días</span>
            <span className="mt-1 block text-xl font-bold tracking-tight text-slate-900">{isLoading ? "…" : formatCurrencyRD(weekTotal.toFixed(2))}</span>
          </span>
        </article>
        <article className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><TrendingUp className="h-5 w-5" /></span>
          <span>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Mejor día</span>
            <span className="mt-1 block text-xl font-bold capitalize tracking-tight text-slate-900">{isLoading ? "…" : bestDay?.label || "Sin ventas"}</span>
          </span>
        </article>
        <article className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><PackageCheck className="h-5 w-5" /></span>
          <span>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Productos destacados</span>
            <span className="mt-1 block text-xl font-bold tracking-tight text-slate-900">{isLoading ? "…" : data?.topProducts.length || 0}</span>
          </span>
        </article>
      </section>

      <section className="grid gap-5 lg:grid-cols-12">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-8 sm:p-6">
          <div className="mb-6">
            <h2 className="text-base font-bold text-slate-900">Ventas por día</h2>
            <p className="mt-1 text-xs text-slate-500">Ingresos registrados en el periodo seleccionado</p>
          </div>
          {isLoading ? (
            <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
          ) : data?.dailySales.length ? (
            <div className="flex h-64 items-end gap-2 border-b border-slate-100 pb-2 sm:gap-4">
              {data.dailySales.map((day, index) => {
                const height = Math.max(4, (Number(day.total) / maxDaily) * 100);
                const isToday = index === data.dailySales.length - 1;
                return (
                  <div key={day.date} className="group flex h-full flex-1 flex-col items-center justify-end gap-2">
                    <span className="text-[9px] font-medium text-slate-400 opacity-0 transition group-hover:opacity-100" title={formatCurrencyRD(day.total)}>{formatCurrencyRD(day.total)}</span>
                    <div className="flex h-[80%] w-full items-end justify-center">
                      <div className={`w-full max-w-16 rounded-t-xl transition-all ${isToday ? "bg-[#368b76]" : "bg-[#d9e9e4] group-hover:bg-[#9ecbbd]"}`} style={{ height: `${height}%` }} title={`${day.label}: ${formatCurrencyRD(day.total)}`} />
                    </div>
                    <span className={`text-[10px] font-semibold capitalize ${isToday ? "text-emerald-800" : "text-slate-400"}`}>{day.label}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-16 text-center text-sm text-slate-400">No hay ventas registradas en este periodo.</p>
          )}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-4 sm:p-6">
          <div className="mb-5">
            <h2 className="text-base font-bold text-slate-900">Ventas por categoría</h2>
            <p className="mt-1 text-xs text-slate-500">Distribución por tipo de producto en el periodo</p>
          </div>
          {isLoading ? (
            <div className="space-y-4">{[1, 2, 3].map((item) => <div key={item} className="h-8 animate-pulse rounded-lg bg-slate-100" />)}</div>
          ) : data?.categorySales.length ? (
            <div className="space-y-5">
              {data.categorySales.map((category, index) => (
                <div key={category.name}>
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-semibold text-slate-700">{category.name}</span>
                    <span className="shrink-0 font-semibold text-slate-900">{formatCurrencyRD(category.total)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${["bg-[#368b76]", "bg-[#6b9b8b]", "bg-[#91b2a7]", "bg-[#b2c9c1]"][index % 4]}`} style={{ width: `${Math.max(3, (Number(category.total) / maxCategory) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-slate-400">Aún no hay ventas por categoría.</p>
          )}
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4">
          <h2 className="text-base font-bold text-slate-900">Productos con mayor venta</h2>
          <p className="mt-1 text-xs text-slate-500">Ranking del periodo por monto facturado</p>
        </div>
        {isLoading ? (
          <div className="h-32 animate-pulse rounded-xl bg-slate-100" />
        ) : data?.topProducts.length ? (
          <div className="divide-y divide-slate-100">
            {data.topProducts.map((product, index) => (
              <div key={product.id} className="flex items-center gap-3 py-3">
                <span className="w-6 text-center text-xs font-bold text-slate-400">{String(index + 1).padStart(2, "0")}</span>
                <MeatBadge iconId={product.iconId} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{product.name}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{product.quantity} {product.unit} vendidos</p>
                </div>
                <p className="text-sm font-bold text-slate-900">{formatCurrencyRD(product.total)}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-slate-400">Aún no hay productos vendidos.</p>
        )}
      </section>
    </div>
  );
}
