"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Users,
  Wallet,
  Package,
  AlertTriangle,
  ChevronRight,
  CheckCircle2,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";
import { formatCurrencyRD } from "@/lib/money";

interface DashboardData {
  metrics: {
    salesTotal: string;
    salesCount: number;
    avgTicket: string;
    cashSalesTotal: string;
    creditSalesTotal: string;
    estimatedGrossProfit: string;
    profitMarginPct: string;
    totalDebtOwed: string;
    debtorsCount: number;
    activeCashExpected: string;
    isCashOpen: boolean;
    cashSessionNumber: number | null;
    lowStockAlertsCount: number;
  };
  categorySales: Array<{ name: string; total: string }>;
  recentSales: Array<{
    id: string;
    number: number;
    customerName: string;
    total: string;
    paymentType: string;
    itemsCount: number;
    createdAt: string;
  }>;
  alerts: Array<{
    productId: string;
    productCode: string;
    productName: string;
    currentStock: string;
    minStock: string;
    suggestedQty: string;
  }>;
  dailySales: Array<{ date: string; label: string; total: string }>;
  topProducts: Array<{ id: string; name: string; iconId?: string; quantity: string; total: string }>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => res.json())
      .then((resData) => setData(resData))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const metrics = data?.metrics;

  const todayDateStr = new Date().toLocaleDateString("es-DO", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Banner 360° Superior con Glassmorfismo & Identidad Korta Business */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 shadow-xs flex flex-wrap items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-1.5 max-w-xl">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-emerald-800 bg-emerald-100/70 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              Vista 360° Operativa
            </span>
            <span className="text-xs font-bold text-slate-500 capitalize">{todayDateStr}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Control Financiero & Operativo de Carnicería
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 font-medium">
            Supervisa en vivo el flujo de caja, margen real de rentabilidad, stock al gramo y cuentas por cobrar en un solo panel.
          </p>
        </div>

        {/* Botones de Acción Destacados (NevBank / Finovia) */}
        <div className="flex items-center gap-3">
          <Link
            href="/caja"
            className="px-4 py-3.5 bg-white/80 hover:bg-white text-slate-700 border border-slate-200/90 text-xs font-black rounded-2xl shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <Wallet className="w-4 h-4 text-emerald-600" />
            Control de Caja
          </Link>
          <Link
            href="/ventas"
            className="px-6 py-3.5 bg-[#0B192C] hover:bg-[#182C44] active:scale-95 text-white font-black text-xs sm:text-sm rounded-2xl shadow-md shadow-[#0B192C]/20 transition-all flex items-center gap-2 cursor-pointer"
          >
            <ShoppingCart className="w-4 h-4 text-emerald-400" />
            Abrir Punto de Venta
          </Link>
        </div>
      </div>

      {/* Tarjetas Principales de KPIs Financieros 360° (Glass Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Ventas del Día */}
        <div className="glass-card rounded-3xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">
              Ventas Totales Hoy
            </span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-100/80 text-emerald-800 flex items-center justify-center shadow-xs">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-black font-mono text-[#0B192C] block tracking-tight">
              {metrics ? formatCurrencyRD(metrics.salesTotal) : "..."}
            </span>
            <div className="flex items-center gap-2 mt-2 text-xs text-slate-500 font-medium">
              <span className="font-extrabold text-slate-700">{metrics?.salesCount || 0} ventas</span>
              <span>·</span>
              <span>Ticket prom: {metrics ? formatCurrencyRD(metrics.avgTicket) : "..."}</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Margen Real Estimado */}
        <div className="glass-card rounded-3xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">
              Utilidad Bruta Estimada
            </span>
            <div className="w-10 h-10 rounded-2xl bg-blue-100/80 text-blue-800 flex items-center justify-center shadow-xs">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-700 block tracking-tight">
              {metrics ? formatCurrencyRD(metrics.estimatedGrossProfit) : "..."}
            </span>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-800 font-black">
              <span>Margen comercial: {metrics?.profitMarginPct || "0"}%</span>
            </div>
          </div>
        </div>

        {/* KPI 3: Efectivo en Caja Abierta */}
        <div className="glass-card rounded-3xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">
              Efectivo en Caja
            </span>
            <div className="w-10 h-10 rounded-2xl bg-teal-100/80 text-teal-800 flex items-center justify-center shadow-xs">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-black font-mono text-[#0B192C] block tracking-tight">
              {metrics ? formatCurrencyRD(metrics.activeCashExpected) : "..."}
            </span>
            <div className="flex items-center justify-between mt-2">
              <span className={`text-[11px] font-black ${metrics?.isCashOpen ? "text-emerald-700" : "text-amber-700"}`}>
                {metrics?.isCashOpen ? `Turno Abierto #${metrics.cashSessionNumber}` : "Caja Cerrada"}
              </span>
              <Link href="/caja" className="text-xs font-black text-slate-600 hover:text-emerald-700 flex items-center gap-0.5">
                Arqueo →
              </Link>
            </div>
          </div>
        </div>

        {/* KPI 4: Cartera por Cobrar */}
        <div className="glass-card rounded-3xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">
              Cuentas por Cobrar
            </span>
            <div className="w-10 h-10 rounded-2xl bg-amber-100/80 text-amber-800 flex items-center justify-center shadow-xs">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-black font-mono text-rose-700 block tracking-tight">
              {metrics ? formatCurrencyRD(metrics.totalDebtOwed) : "..."}
            </span>
            <div className="flex items-center justify-between mt-2 text-xs text-slate-500 font-medium">
              <span className="font-bold">{metrics?.debtorsCount || 0} clientes deudores</span>
              <Link href="/clientes" className="font-black text-slate-600 hover:text-emerald-700 flex items-center gap-0.5">
                Cobrar →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Gráfica de Tendencia y Accesos Rápidos */}
      <section className="grid gap-5 lg:grid-cols-12">
        <div aria-busy={isLoading} className="glass-panel rounded-3xl p-5 sm:p-6 lg:col-span-8 shadow-xs">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-800">Tendencia de Ingresos</p>
              <h2 className="mt-1 text-base font-black text-slate-900">Ventas de los Últimos 7 Días</h2>
              <p className="mt-1 text-xs text-slate-500 font-medium">Comparativo diario en pesos dominicanos (RD$)</p>
            </div>
            <Link
              href="/reportes"
              className="rounded-2xl border border-slate-200/90 bg-white/80 px-3.5 py-2 text-xs font-bold text-slate-600 transition hover:bg-white hover:text-emerald-800"
            >
              Ver Reportes Financieros
            </Link>
          </div>
          <div className="flex h-44 items-end gap-2 border-b border-slate-100 pb-2 sm:gap-4">
            {(data?.dailySales || []).map((day, index) => {
              const maxValue = Math.max(...(data?.dailySales || []).map((item) => Number(item.total)), 1);
              const height = Math.max(8, (Number(day.total) / maxValue) * 100);
              const isToday = index === (data?.dailySales.length || 0) - 1;
              return (
                <div key={day.date} className="group flex h-full flex-1 flex-col items-center justify-end gap-2">
                  <span
                    className="max-w-full truncate text-[9px] font-mono font-bold text-slate-500 opacity-0 transition group-hover:opacity-100"
                    title={formatCurrencyRD(day.total)}
                  >
                    {formatCurrencyRD(day.total)}
                  </span>
                  <div className="flex h-[78%] w-full items-end justify-center">
                    <div
                      className={`w-full max-w-12 rounded-t-xl transition-all duration-300 ${
                        isToday
                          ? "bg-gradient-to-t from-emerald-600 to-emerald-500 shadow-sm"
                          : "bg-slate-200/80 group-hover:bg-emerald-200"
                      }`}
                      style={{ height: `${height}%` }}
                      title={`${day.label}: ${formatCurrencyRD(day.total)}`}
                    />
                  </div>
                  <span className={`text-[10px] font-bold capitalize ${isToday ? "text-emerald-800 font-black" : "text-slate-400"}`}>
                    {day.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Accesos Rápidos Táctiles */}
        <div className="glass-panel rounded-3xl p-5 sm:p-6 lg:col-span-4 shadow-xs">
          <div className="mb-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-800">Flujo Operativo</p>
            <h2 className="mt-1 text-base font-black text-slate-900">Accesos Rápidos</h2>
            <p className="mt-1 text-xs text-slate-500 font-medium">Módulos principales del sistema</p>
          </div>
          <div className="space-y-2.5">
            {[
              { href: "/inventario", icon: Package, title: "Inventario & Cortes", description: "Productos y existencias al gramo" },
              { href: "/clientes", icon: Users, title: "Gestión de Clientes", description: "Límites de crédito, estados y cobros" },
              { href: "/caja", icon: Wallet, title: "Arqueo y Cierre Diario", description: "Denominaciones físicas y diferencias" },
              { href: "/auditoria", icon: ShieldCheck, title: "Pistas de Auditoría", description: "Registro inmutable de movimientos" },
            ].map(({ href, icon: Icon, title, description }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3.5 rounded-2xl border border-white/80 bg-white/70 p-3 transition-all hover:bg-white hover:border-emerald-200 hover:shadow-xs active:scale-98"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-black text-slate-800">{title}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-slate-500">{description}</span>
                </span>
                <ChevronRight className="h-4 w-4 text-slate-300" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Grilla 360°: Control de Cierres Diarios y Distribución de Cortes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* PANEL 1: Cierres Diarios y Flujo de Caja */}
        <div className="lg:col-span-6 glass-panel rounded-3xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-black text-slate-900 text-base">Control de Turno & Arqueo</h3>
                <p className="text-xs text-slate-500 font-medium">Garantía de cierre diario sin descuadres</p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  metrics?.isCashOpen
                    ? "bg-emerald-100/80 text-emerald-800 border border-emerald-200"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {metrics?.isCashOpen ? "Turno Activo" : "Caja Cerrada"}
              </span>
            </div>

            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-white/80 border border-slate-200/70 text-xs">
                <span className="font-bold text-slate-600">Ventas al Contado (Efectivo)</span>
                <span className="font-black font-mono text-emerald-700">
                  +{metrics ? formatCurrencyRD(metrics.cashSalesTotal) : "..."}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-2xl bg-white/80 border border-slate-200/70 text-xs">
                <span className="font-bold text-slate-600">Ventas a Crédito (Cuentas Corrientes)</span>
                <span className="font-black font-mono text-amber-700">
                  +{metrics ? formatCurrencyRD(metrics.creditSalesTotal) : "..."}
                </span>
              </div>

              {/* Caja LUMINOSA de Efectivo Físico Esperado (NO FONDO NEGRO) */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-emerald-50/80 via-white to-slate-50 border-2 border-emerald-500/30 text-xs shadow-xs">
                <div>
                  <span className="font-black text-slate-900 block text-xs">Efectivo Físico Esperado en Gaveta</span>
                  <span className="text-[11px] text-slate-500 font-medium">Monto requerido para validar en el arqueo</span>
                </div>
                <span className="text-xl sm:text-2xl font-black font-mono text-emerald-800">
                  {metrics ? formatCurrencyRD(metrics.activeCashExpected) : "..."}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Validación con billetes de RD$ 2,000 a RD$ 1</span>
            <Link
              href="/caja"
              className="text-xs font-black text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              Hacer Arqueo de Caja <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* PANEL 2: Ventas por Categoría de Carne */}
        <div className="lg:col-span-6 glass-panel rounded-3xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-black text-slate-900 text-base">Ventas por Tipo de Carne</h3>
                <p className="text-xs text-slate-500 font-medium">Volumen de los últimos 7 días</p>
              </div>
              <Link href="/inventario" className="text-xs font-bold text-slate-500 hover:text-emerald-700">
                Ver Catálogo →
              </Link>
            </div>

            <div className="space-y-3.5 pt-1">
              {data?.categorySales && data.categorySales.length > 0 ? (
                data.categorySales.map((cat, idx) => {
                  const maxVal = Math.max(...data.categorySales.map((c) => parseFloat(c.total)), 1);
                  const pct = Math.min(100, Math.round((parseFloat(cat.total) / maxVal) * 100));

                  return (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-slate-800">{cat.name}</span>
                        <span className="font-mono text-slate-900">{formatCurrencyRD(cat.total)}</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-600 to-teal-500 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs">
                  Aún no se han emitido ventas hoy.
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Aritmética decimal exacta carnicera</span>
            <span className="font-mono font-bold text-slate-700">ROUND_HALF_UP (DGII)</span>
          </div>
        </div>
      </div>

      {/* Tablas Inferiores: Últimas Ventas y Alertas de Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Últimas Ventas */}
        <div className="lg:col-span-7 glass-panel rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-slate-900 text-base">Últimas Ventas Emitidas</h3>
            <Link href="/ventas" className="text-xs font-bold text-emerald-700 hover:underline">
              Ir al POS →
            </Link>
          </div>

          {data?.recentSales && data.recentSales.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50/80 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-100">
                  <tr>
                    <th className="py-2.5 px-3">Ticket</th>
                    <th className="py-2.5 px-3">Cliente</th>
                    <th className="py-2.5 px-3">Condición</th>
                    <th className="py-2.5 px-3 text-right">Total RD$</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.recentSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-white/60">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-700">#{sale.number}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{sale.customerName}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            sale.paymentType === "CONTADO"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {sale.paymentType}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-black font-mono text-slate-900">
                        {formatCurrencyRD(sale.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-slate-400 text-xs">
              No hay ventas confirmadas recientes.
            </div>
          )}
        </div>

        {/* Alertas de Reposición */}
        <div className="lg:col-span-5 glass-panel rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Stock Crítico / Reponer
            </h3>
            <Link href="/inventario" className="text-xs font-bold text-emerald-700 hover:underline">
              Inventario →
            </Link>
          </div>

          {data?.alerts && data.alerts.length > 0 ? (
            <div className="space-y-2.5">
              {data.alerts.slice(0, 4).map((al) => (
                <div
                  key={al.productId}
                  className="p-3 rounded-2xl bg-white/80 border border-slate-200/80 flex items-center justify-between text-xs shadow-xs"
                >
                  <div>
                    <span className="font-bold text-slate-900 block">{al.productName}</span>
                    <span className="text-[11px] text-rose-600 font-bold font-mono">
                      Quedan {al.currentStock} kg (Mín: {al.minStock} kg)
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Pedir</span>
                    <span className="font-black font-mono text-emerald-700">+{al.suggestedQty} kg</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-emerald-700 text-xs font-semibold flex flex-col items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              <span>Todos los niveles de carne están sobre el mínimo</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
