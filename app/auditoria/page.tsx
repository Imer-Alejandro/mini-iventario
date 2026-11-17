"use client";

import { useState, useEffect } from "react";
import { ShieldCheck, Search, Filter, Clock, User, CheckCircle2 } from "lucide-react";

interface AuditLog {
  id: string;
  userId: string;
  action: string;
  entity: string;
  entityId?: string;
  beforeState?: unknown;
  afterState?: unknown;
  authorizedBy?: string;
  createdAt: string;
}

export default function AuditoriaPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetch("/api/audit")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setLogs(data);
      })
      .catch(() => {});
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchesEntity = selectedEntity === "ALL" || log.entity === selectedEntity;
    const matchesSearch =
      searchQuery === "" ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.userId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.entityId && log.entityId.includes(searchQuery));
    return matchesEntity && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Encabezado */}
      <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
            <ShieldCheck className="w-7 h-7 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Registro de Auditoría</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Libro inmutable · Trazabilidad de ventas, anulaciones, arqueos de caja y autorizaciones
            </p>
          </div>
        </div>

        <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Cumplimiento Sección 16: Tabla solo de inserción</span>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {["ALL", "SALE", "CASH", "CUSTOMER", "INVENTORY"].map((ent) => (
            <button
              key={ent}
              onClick={() => setSelectedEntity(ent)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedEntity === ent
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {ent === "ALL" ? "Todos los Módulos" : ent}
            </button>
          ))}
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por acción o usuario..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Lista de Registros de Auditoría */}
      <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 space-y-3">
        <h3 className="font-extrabold text-slate-900 text-sm">Eventos Registrados ({filteredLogs.length})</h3>

        {filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            No se han registrado eventos para los filtros seleccionados.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
            {filteredLogs.map((log) => (
              <div key={log.id} className="p-3.5 bg-white hover:bg-slate-50/50 flex flex-wrap items-start justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[10px] text-slate-400">
                      {new Date(log.createdAt).toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                    <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-slate-100 text-slate-800">
                      {log.entity}
                    </span>
                    <span className="font-bold text-slate-900">{log.action}</span>
                    {log.authorizedBy && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        Autorizado por {log.authorizedBy}
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-500 font-mono">
                    Usuario: <span className="font-bold text-slate-700">{log.userId}</span> · ID Entidad: {log.entityId || "N/A"}
                  </p>

                  {log.afterState !== undefined && log.afterState !== null && (
                    <pre className="text-[10px] font-mono bg-slate-50 p-2 rounded-lg text-slate-700 max-w-xl overflow-x-auto border border-slate-100">
                      {JSON.stringify(log.afterState, null, 2)}
                    </pre>
                  )}
                </div>

                <span className="text-[10px] text-slate-400 font-mono">
                  {new Date(log.createdAt).toLocaleDateString("es-DO")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
