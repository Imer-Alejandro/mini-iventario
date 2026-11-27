"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Clock,
  Search,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";
import { formatCurrencyRD } from "@/lib/money";

interface AuditLog {
  id: string;
  userId: string;
  userName?: string;
  action: string;
  entity: string;
  entityId?: string;
  beforeState?: unknown;
  afterState?: unknown;
  authorizedBy?: string;
  authorizedByName?: string;
  createdAt: string;
}

const ENTITY_LABELS: Record<string, string> = {
  SALE: "Ventas",
  CASH: "Caja",
  INVENTORY: "Inventario",
  CUSTOMER: "Clientes",
  SUPPLIER: "Proveedores",
  PRODUCT: "Productos",
  LOCATION: "Ubicaciones",
  USER: "Usuarios",
  ROLE: "Roles",
};

const ENTITY_ACTION_TITLES: Record<string, string> = {
  "SALE:CREATE": "Venta completada",
  "SALE:VOID": "Venta anulada",
  "CASH:OPEN": "Caja abierta",
  "CASH:CASH_MOVEMENT": "Movimiento de caja",
  "CASH:CASH_CLOSE": "Caja cerrada",
  "INVENTORY:INVENTORY_MOVEMENT": "Movimiento de inventario",
  "CUSTOMER:LEDGER_ENTRY": "Movimiento de cuenta del cliente",
  "SUPPLIER:PAYMENT": "Pago a proveedor",
  "USER:LOGIN": "Inicio de sesión",
  "PRODUCT:CREATE": "Producto creado",
  "PRODUCT:UPDATE": "Producto actualizado",
  "PRODUCT:DELETE": "Producto archivado",
  "CUSTOMER:DELETE": "Cliente archivado",
  "SUPPLIER:CREATE": "Proveedor creado",
  "SUPPLIER:UPDATE": "Proveedor actualizado",
  "SUPPLIER:DELETE": "Proveedor archivado",
  "LOCATION:DELETE": "Ubicación archivada",
  "USER:CREATE": "Usuario creado",
  "USER:UPDATE": "Usuario actualizado",
  "ROLE:CREATE": "Rol creado",
  "ROLE:UPDATE": "Rol actualizado",
  "ROLE:DELETE": "Rol archivado",
};

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Creación",
  UPDATE: "Actualización",
  DELETE: "Archivado",
  VOID: "Anulación",
  LOGIN: "Inicio de sesión",
  OPEN: "Apertura",
  CASH_MOVEMENT: "Movimiento de caja",
  CASH_CLOSE: "Cierre de caja",
  INVENTORY_MOVEMENT: "Movimiento de inventario",
  LEDGER_ENTRY: "Movimiento de cuenta",
  PAYMENT: "Pago",
};

const FIELD_LABELS: Record<string, string> = {
  amount: "Importe",
  counted: "Efectivo contado",
  difference: "Diferencia",
  diffReason: "Motivo de diferencia",
  email: "Correo",
  expected: "Efectivo esperado",
  name: "Nombre",
  newBalance: "Nuevo balance",
  newExpected: "Balance de caja",
  newTotal: "Existencia total",
  number: "Número de venta",
  openingAmount: "Monto inicial",
  paymentType: "Tipo de pago",
  permissions: "Permisos",
  qty: "Cantidad",
  reason: "Motivo",
  referenceId: "Referencia",
  role: "Rol",
  sessionNumber: "Número de turno",
  status: "Estado",
  total: "Total",
  type: "Tipo de movimiento",
  voidReason: "Motivo de anulación",
};

const CURRENCY_FIELDS = new Set([
  "amount",
  "counted",
  "difference",
  "expected",
  "newBalance",
  "newExpected",
  "openingAmount",
  "total",
]);

const VALUE_LABELS: Record<string, string> = {
  ACTIVE: "Activo",
  INACTIVE: "Archivado",
  CONTADO: "Contado",
  CREDITO: "Crédito",
  EFECTIVO: "Efectivo",
  TARJETA: "Tarjeta",
  VENTA_EFECTIVO: "Venta en efectivo",
  INGRESO_MANUAL: "Ingreso manual",
  RETIRO_MANUAL: "Retiro manual",
  ENTRADA: "Entrada",
  SALIDA: "Salida",
  TRASLADO: "Traslado",
  AJUSTE: "Ajuste",
  MERMA: "Merma",
  DEVOLUCION: "Devolución",
  VENTA: "Venta",
  ABONO: "Abono",
  PAGO: "Pago",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function getEntityLabel(entity: string) {
  return ENTITY_LABELS[entity] || entity.toLowerCase().replaceAll("_", " ");
}

function getEventTitle(log: AuditLog) {
  const key = `${log.entity}:${log.action}`;
  if (ENTITY_ACTION_TITLES[key]) return ENTITY_ACTION_TITLES[key];
  const entityLabel = getEntityLabel(log.entity);
  const actionLabel = ACTION_LABELS[log.action] || log.action.toLowerCase().replaceAll("_", " ");
  return `${entityLabel}: ${actionLabel}`;
}

function formatAuditValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "Sin dato";
  if (Array.isArray(value)) {
    if (key === "permissions") return `${value.length} permisos asignados`;
    return value.map((item) => String(item)).join(", ");
  }
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "number" || typeof value === "string") {
    if (CURRENCY_FIELDS.has(key) && value !== "" && Number.isFinite(Number(value))) {
      return formatCurrencyRD(String(value));
    }
    if (key.toLowerCase().endsWith("at") && typeof value === "string" && !Number.isNaN(Date.parse(value))) {
      return new Date(value).toLocaleString("es-DO", { dateStyle: "medium", timeStyle: "short" });
    }
    const text = String(value);
    return VALUE_LABELS[text] || text;
  }
  return "Ver detalle";
}

function getSummary(log: AuditLog): string | null {
  const after = asRecord(log.afterState);
  const before = asRecord(log.beforeState);
  const state = after || before;
  if (!state) return null;

  if (log.entity === "SALE" && log.action === "CREATE") {
    const number = state.number ? `Venta #${state.number}` : "Venta";
    const paymentType = typeof state.paymentType === "string"
      ? VALUE_LABELS[state.paymentType] || state.paymentType
      : null;
    const total = state.total !== undefined ? formatCurrencyRD(String(state.total)) : null;
    return [number, paymentType, total].filter(Boolean).join(" · ");
  }
  if (log.entity === "SALE" && log.action === "VOID" && typeof state.voidReason === "string") {
    return `Motivo: ${state.voidReason}`;
  }
  if (log.entity === "INVENTORY" && state.type) {
    const movement = formatAuditValue("type", state.type);
    return state.qty !== undefined
      ? `${movement} · Cantidad registrada: ${state.qty}`
      : movement;
  }
  if (log.entity === "CASH" && log.action === "CASH_CLOSE") {
    const difference = state.difference !== undefined
      ? `Diferencia: ${formatAuditValue("difference", state.difference)}`
      : null;
    const counted = state.counted !== undefined
      ? `Contado: ${formatAuditValue("counted", state.counted)}`
      : null;
    return [counted, difference].filter(Boolean).join(" · ") || null;
  }

  const name = state.name || before?.name || state.code || before?.code || state.email || before?.email;
  return typeof name === "string" ? name : null;
}

function getVisibleDetails(log: AuditLog) {
  const before = asRecord(log.beforeState);
  const after = asRecord(log.afterState);
  const source = after && Object.keys(after).length > 0 ? after : before;
  if (!source) return [];

  return Object.entries(source)
    .filter(([key]) => !["permissions", "clientOpId"].includes(key))
    .map(([key, value]) => {
      const previousValue = before?.[key];
      const changed = previousValue !== undefined
        && JSON.stringify(previousValue) !== JSON.stringify(value);
      return {
        key,
        label: FIELD_LABELS[key] || key.replaceAll(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase()),
        value: changed
          ? `${formatAuditValue(key, previousValue)} → ${formatAuditValue(key, value)}`
          : formatAuditValue(key, value),
      };
    })
    .slice(0, 4);
}

function isToday(value: string) {
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
}

function AuditStat({
  icon,
  label,
  value,
  helper,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  helper: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
        {icon}
      </div>
      <div>
        <p className="text-[11px] font-semibold text-slate-500">{label}</p>
        <p className="text-xl font-black tracking-tight text-slate-900">{value}</p>
        <p className="text-[10px] text-slate-400">{helper}</p>
      </div>
    </div>
  );
}

export default function AuditoriaPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [selectedEntity, setSelectedEntity] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    fetch("/api/audit")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No se pudo cargar la auditoría.");
        if (!Array.isArray(data)) throw new Error("El servidor devolvió un formato de auditoría no válido.");
        if (active) {
          setLogs(data);
          setLoadError(null);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadError(error instanceof Error ? error.message : "No se pudo cargar la auditoría.");
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [refreshKey]);

  const entityOptions = [
    "ALL",
    ...Array.from(new Set(logs.map((log) => log.entity))).sort((a, b) => getEntityLabel(a).localeCompare(getEntityLabel(b), "es")),
  ];
  const query = searchQuery.trim().toLocaleLowerCase("es");
  const filteredLogs = logs.filter((log) => {
    if (selectedEntity !== "ALL" && log.entity !== selectedEntity) return false;
    if (!query) return true;
    const searchText = [
      log.entity,
      getEntityLabel(log.entity),
      log.action,
      getEventTitle(log),
      getSummary(log) || "",
      log.userName || "",
      log.userId,
      log.entityId || "",
      JSON.stringify(log.beforeState ?? {}),
      JSON.stringify(log.afterState ?? {}),
    ].join(" ").toLocaleLowerCase("es");
    return searchText.includes(query);
  });

  const todayCount = logs.filter((log) => isToday(log.createdAt)).length;
  const actorCount = new Set(logs.map((log) => log.userName || log.userId)).size;

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs sm:p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-emerald-400">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Auditoría</h1>
            <p className="mt-1 max-w-2xl text-xs text-slate-500">
              Actividad importante del negocio, presentada en un registro de solo lectura.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          Registro protegido
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <AuditStat
          icon={<Activity className="h-5 w-5" />}
          label="Eventos recientes"
          value={logs.length}
          helper="Últimos registros disponibles"
        />
        <AuditStat
          icon={<Clock className="h-5 w-5" />}
          label="Actividad de hoy"
          value={todayCount}
          helper="Desde la medianoche"
        />
        <AuditStat
          icon={<Users className="h-5 w-5" />}
          label="Usuarios involucrados"
          value={actorCount}
          helper="En los eventos recientes"
        />
      </section>

      <section className="space-y-4 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
            <Boxes className="h-4 w-4 text-emerald-700" />
            Actividad registrada
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
              {filteredLogs.length} eventos
            </span>
          </div>
          <label className="relative min-w-[240px] flex-1 sm:max-w-sm">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Buscar acción, usuario o detalle..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-3 text-xs outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
            />
          </label>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {entityOptions.map((entity) => (
            <button
              key={entity}
              type="button"
              onClick={() => setSelectedEntity(entity)}
              className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold transition ${
                selectedEntity === entity
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {entity === "ALL" ? "Todos" : getEntityLabel(entity)}
            </button>
          ))}
        </div>

        {loadError && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
            <span>{loadError}</span>
            <button
              type="button"
              onClick={() => {
                setIsLoading(true);
                setRefreshKey((current) => current + 1);
              }}
              className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 font-bold hover:bg-rose-100"
            >
              Reintentar
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-12 text-center">
            <Activity className="mx-auto h-6 w-6 animate-pulse text-emerald-600" />
            <p className="mt-2 text-xs font-semibold text-slate-500">Cargando actividad...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-12 text-center">
            <Search className="mx-auto h-6 w-6 text-slate-300" />
            <p className="mt-2 text-sm font-bold text-slate-700">
              {logs.length ? "No encontramos eventos con esos filtros." : "Todavía no hay eventos registrados."}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Prueba otra búsqueda o selecciona un módulo diferente.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredLogs.map((log) => {
              const details = getVisibleDetails(log);
              const summary = getSummary(log);
              const hasTechnicalDetails = log.beforeState != null || log.afterState != null || log.entityId;
              const actorName = log.userName || (log.userId === "system" ? "Sistema" : "Usuario no disponible");
              const createdAt = new Date(log.createdAt);

              return (
                <article key={log.id} className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-xs sm:p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                      <Activity className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-extrabold text-slate-900">{getEventTitle(log)}</h2>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                          {getEntityLabel(log.entity)}
                        </span>
                      </div>

                      {summary && <p className="mt-1 text-xs font-medium text-slate-600">{summary}</p>}

                      {details.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {details.map((detail) => (
                            <span key={detail.key} className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-[11px]">
                              <span className="font-semibold text-slate-500">{detail.label}:</span>
                              <span className="break-all font-bold text-slate-800">{detail.value}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                        <span className="inline-flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5" />
                          <span className="font-semibold text-slate-700">{actorName}</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          {createdAt.toLocaleString("es-DO", { dateStyle: "medium", timeStyle: "short" })}
                        </span>
                        {log.authorizedBy && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 font-semibold text-amber-800">
                            Autorizó: {log.authorizedByName || "Supervisor"}
                          </span>
                        )}
                      </div>

                      {hasTechnicalDetails && (
                        <details className="group mt-3 border-t border-slate-100 pt-2.5">
                          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11px] font-bold text-emerald-800 hover:text-emerald-950">
                            Ver datos completos
                            <ArrowRight className="h-3 w-3 transition group-open:rotate-90" />
                          </summary>
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            {log.beforeState != null && (
                              <div>
                                <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Antes</p>
                                <pre className="max-h-48 overflow-auto rounded-xl bg-slate-950 p-3 text-[10px] leading-relaxed text-slate-100">
                                  {JSON.stringify(log.beforeState, null, 2)}
                                </pre>
                              </div>
                            )}
                            {log.afterState != null && (
                              <div>
                                <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Después</p>
                                <pre className="max-h-48 overflow-auto rounded-xl bg-slate-950 p-3 text-[10px] leading-relaxed text-slate-100">
                                  {JSON.stringify(log.afterState, null, 2)}
                                </pre>
                              </div>
                            )}
                            <div className="flex flex-wrap gap-2 text-[10px] text-slate-500 sm:col-span-2">
                              <span className="rounded bg-slate-100 px-2 py-1">Módulo: {log.entity}</span>
                              <span className="rounded bg-slate-100 px-2 py-1">Acción: {log.action}</span>
                              {log.entityId && <span className="break-all rounded bg-slate-100 px-2 py-1">ID: {log.entityId}</span>}
                              <span className="break-all rounded bg-slate-100 px-2 py-1">Usuario ID: {log.userId}</span>
                              {log.authorizedBy && <span className="break-all rounded bg-slate-100 px-2 py-1">Autorizador ID: {log.authorizedBy}</span>}
                            </div>
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <p className="flex items-center justify-center gap-1.5 pb-2 text-[11px] text-slate-400">
        <ShieldCheck className="h-3.5 w-3.5" />
        Se muestran los últimos 100 eventos guardados en el registro inmutable.
      </p>
    </div>
  );
}
