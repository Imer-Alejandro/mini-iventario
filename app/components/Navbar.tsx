"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  Activity,
  BarChart3,
  LayoutDashboard,
  Package,
  ShieldCheck,
  ShoppingCart,
  Users,
  Wallet,
  Wifi,
  WifiOff,
} from "lucide-react";

const navLinks = [
  { href: "/", label: "Inicio 360°", icon: LayoutDashboard },
  { href: "/ventas", label: "Punto de Venta", icon: ShoppingCart },
  { href: "/inventario", label: "Inventario & Cortes", icon: Package },
  { href: "/clientes", label: "Clientes & Crédito", icon: Users },
  { href: "/caja", label: "Caja & Cierres", icon: Wallet },
  { href: "/reportes", label: "Reportes & Finanzas", icon: BarChart3 },
  { href: "/auditoria", label: "Auditoría", icon: ShieldCheck },
];

export function Navbar() {
  const pathname = usePathname();
  const isOnline = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("online", onStoreChange);
      window.addEventListener("offline", onStoreChange);
      return () => {
        window.removeEventListener("online", onStoreChange);
        window.removeEventListener("offline", onStoreChange);
      };
    },
    () => navigator.onLine,
    () => true,
  );
  const [cashStatus, setCashStatus] = useState<{ active: boolean; sessionNumber?: number } | null>(null);

  useEffect(() => {
    fetch("/api/cash")
      .then((res) => res.json())
      .then((data) => {
        if (data.report) {
          setCashStatus({
            active: data.report.status === "OPEN",
            sessionNumber: data.report.sessionNumber,
          });
        }
      })
      .catch(() => {});
  }, []);

  const isActive = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(href));

  return (
    <>
      {/* Sidebar Escritorio con Acabado Glassmorphism */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col glass-panel border-r border-white/70 px-4 py-5 lg:flex shadow-xs">
        {/* Logotipo Oficial Korta Business */}
        <Link href="/" className="mb-7 flex h-12 items-center px-2 transition-transform hover:scale-[1.02]" aria-label="Korta Business, inicio">
          <div className="relative h-11 w-44">
            <Image src="/korta-logo.png" alt="Korta Business" fill priority className="object-contain object-left" />
          </div>
        </Link>

        {/* Etiqueta de Sección */}
        <div className="mb-2.5 px-3 text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">
          Gestión del Negocio
        </div>

        {/* Enlaces de Navegación */}
        <nav className="flex-1 space-y-1">
          {navLinks.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`group flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-[13px] font-semibold transition-all ${
                  active
                    ? "bg-[#0B192C] text-white shadow-md shadow-[#0B192C]/15"
                    : "text-slate-600 hover:bg-white/80 hover:text-slate-900"
                }`}
              >
                <Icon
                  className={`h-[18px] w-[18px] transition-transform group-hover:scale-110 ${
                    active ? "text-emerald-400" : "text-slate-400 group-hover:text-slate-700"
                  }`}
                />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Pie del Sidebar: Estado de Caja, Red y Usuario */}
        <div className="space-y-2.5 border-t border-slate-200/60 pt-4">
          {/* Indicador de Turno de Caja */}
          <Link
            href="/caja"
            className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
              cashStatus?.active
                ? "border-emerald-200/80 bg-emerald-50/70 text-emerald-800 hover:bg-emerald-100/60"
                : "border-amber-200/80 bg-amber-50/70 text-amber-800 hover:bg-amber-100/60"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${cashStatus?.active ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
              <span>{cashStatus?.active ? `Caja abierta · #${cashStatus.sessionNumber}` : "Caja cerrada"}</span>
            </div>
            <span className="text-[10px] font-bold text-slate-400">Ver arqueo</span>
          </Link>

          {/* Estado de Conectividad */}
          <div className="flex items-center justify-between px-2 text-[11px] font-medium text-slate-500">
            <span className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-slate-400" />
              Sincronización
            </span>
            <span className={`flex items-center gap-1.5 font-semibold ${isOnline ? "text-emerald-700" : "text-rose-600"}`}>
              {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              {isOnline ? "En línea" : "Offline"}
            </span>
          </div>

          {/* Perfil Cajero Activo */}
          <div className="flex items-center gap-3 rounded-2xl bg-white/70 border border-white/90 p-2.5 shadow-xs">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-[#0B192C] to-[#1E293B] text-xs font-bold text-white shadow-xs">
              CC
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-slate-800">Claudette C.</p>
              <p className="text-[10px] text-slate-500 font-medium">Cajera Principal</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Header Móvil con Glassmorfismo */}
      <header className="sticky top-0 z-40 glass-panel border-b border-white/70 lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/" className="relative h-9 w-36" aria-label="Korta Business, inicio">
            <Image src="/korta-logo.png" alt="Korta Business" fill priority className="object-contain object-left" />
          </Link>
          <div
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${
              isOnline ? "bg-emerald-100/70 text-emerald-800" : "bg-rose-100/70 text-rose-800"
            }`}
          >
            {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {isOnline ? "En línea" : "Offline"}
          </div>
        </div>
        <nav className="flex gap-1.5 overflow-x-auto border-t border-slate-100/80 px-3 py-2 scrollbar-none">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all ${
                isActive(href)
                  ? "bg-[#0B192C] text-white shadow-xs"
                  : "bg-white/60 text-slate-600 hover:bg-white/90"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      </header>
    </>
  );
}
