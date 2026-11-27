"use client";

import { AlertTriangle, X } from "lucide-react";
import { useState } from "react";

interface ArchiveConfirmModalProps {
  title: string;
  entityLabel: string;
  entityName: string;
  description: string;
  confirmLabel?: string;
  blockedReason?: string;
  error?: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ArchiveConfirmModal({
  title,
  entityLabel,
  entityName,
  description,
  confirmLabel = "Confirmar archivado",
  blockedReason,
  error,
  isSubmitting,
  onClose,
  onConfirm,
}: ArchiveConfirmModalProps) {
  const [confirmation, setConfirmation] = useState("");
  const matchesName = confirmation.trim() === entityName;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="archive-confirm-title"
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-start gap-4 border-b border-rose-100 bg-rose-50/80 p-5 sm:p-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-rose-700">Confirmación requerida</p>
            <h2 id="archive-confirm-title" className="mt-1 text-lg font-black text-slate-900">{title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-xl p-2 text-slate-400 hover:bg-white hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-4 p-5 sm:p-6">
          <p className="text-sm leading-relaxed text-slate-600">{description}</p>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{entityLabel}</p>
            <p className="mt-1 break-words font-bold text-slate-900">{entityName}</p>
          </div>

          {blockedReason && (
            <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-medium leading-relaxed text-amber-900">
              {blockedReason}
            </p>
          )}
          {error && (
            <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm font-semibold leading-relaxed text-rose-800">
              {error}
            </p>
          )}

          <label className="block space-y-1.5 text-xs font-bold text-slate-700">
            Escribe <span className="select-all rounded bg-slate-100 px-1.5 py-0.5 font-mono">{entityName}</span> para confirmar
            <input
              autoFocus
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && matchesName && !blockedReason && !isSubmitting) onConfirm();
              }}
              disabled={isSubmitting}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 disabled:bg-slate-50"
            />
          </label>

          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={!matchesName || Boolean(blockedReason) || isSubmitting}
              className="rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSubmitting ? "Procesando..." : confirmLabel}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
