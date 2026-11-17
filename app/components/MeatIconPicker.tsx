"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Search, X } from "lucide-react";
import {
  DEFAULT_MEAT_ICON_ID,
  MEAT_ICON_CATEGORIES,
  MEAT_ICONS,
  MeatBadge,
  getMeatIcon,
  type MeatIconCategory,
} from "@/lib/icons/meat-icons";

interface MeatIconPickerProps {
  selectedIconId: string;
  onSelect: (iconId: string) => void;
  productName?: string;
}

export function MeatIconPicker({ selectedIconId, onSelect, productName }: MeatIconPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selected = getMeatIcon(selectedIconId);

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5">
        <div className="flex items-center gap-3">
          <MeatBadge iconId={selectedIconId} size="lg" />
          <div className="min-w-0 flex-1">
            <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              Icono del producto
            </span>
            <span className="block truncate text-sm font-bold text-slate-900">{selected.name}</span>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
              Se verá en inventario, ventas y reportes.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="shrink-0 rounded-xl bg-[#176b5d] px-3.5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#12584d]"
          >
            Elegir icono
          </button>
        </div>
      </div>

      {isOpen && (
        <MeatIconPickerModal
          selectedIconId={selectedIconId}
          productName={productName}
          onClose={() => setIsOpen(false)}
          onSelect={(iconId) => {
            onSelect(iconId);
            setIsOpen(false);
          }}
        />
      )}
    </>
  );
}

interface MeatIconPickerModalProps {
  selectedIconId: string;
  onSelect: (iconId: string) => void;
  onClose: () => void;
  productName?: string;
}

export function MeatIconPickerModal({
  selectedIconId,
  onSelect,
  onClose,
  productName,
}: MeatIconPickerModalProps) {
  const [filterCat, setFilterCat] = useState<"ALL" | MeatIconCategory>("ALL");
  const [query, setQuery] = useState("");
  const [draftId, setDraftId] = useState(selectedIconId || DEFAULT_MEAT_ICON_ID);

  useEffect(() => {
    setDraftId(selectedIconId || DEFAULT_MEAT_ICON_ID);
  }, [selectedIconId]);

  const filteredIcons = useMemo(() => {
    const term = query.trim().toLowerCase();
    return MEAT_ICONS.filter((icon) => {
      const matchesCategory = filterCat === "ALL" || icon.category === filterCat;
      const matchesQuery = !term || icon.name.toLowerCase().includes(term) || icon.id.toLowerCase().includes(term);
      return matchesCategory && matchesQuery;
    });
  }, [filterCat, query]);

  const draftIcon = getMeatIcon(draftId);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#0B192C]/45 p-3 backdrop-blur-md">
      <div className="glass-modal flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-white/70 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <MeatBadge iconId={draftId} size="lg" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">Galería de iconos</p>
              <h2 className="text-lg font-black tracking-tight text-slate-900">Asignar icono al corte</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {productName ? `Producto: ${productName}` : "Elige una ilustración de la carpeta de productos."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 border-b border-slate-100 bg-white/50 px-5 py-3 sm:px-6">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar costilla, queso, pollo..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {MEAT_ICON_CATEGORIES.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterCat(tab.id)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  filterCat === tab.id
                    ? "bg-[#176b5d] text-white shadow-sm"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {filteredIcons.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center text-center text-slate-400">
              <p className="text-sm font-bold text-slate-600">No hay iconos para esa búsqueda</p>
              <p className="mt-1 text-xs">Prueba con otra categoría o un nombre más corto.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5">
              {filteredIcons.map((icon) => {
                const isSelected = icon.id === draftId;
                return (
                  <button
                    key={icon.id}
                    type="button"
                    onClick={() => setDraftId(icon.id)}
                    onDoubleClick={() => onSelect(icon.id)}
                    className={`relative flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition-all ${
                      isSelected
                        ? "border-emerald-600 bg-emerald-50 shadow-sm ring-2 ring-emerald-600/15"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white">
                        <Check className="h-3 w-3 stroke-[3]" />
                      </span>
                    )}
                    <span className={`flex h-16 w-16 items-center justify-center rounded-2xl border ${icon.bgClass} ${icon.borderClass}`}>
                      <img src={icon.src} alt="" className="h-11 w-11 object-contain" draggable={false} />
                    </span>
                    <span className="line-clamp-2 min-h-[2rem] text-[11px] font-semibold leading-tight text-slate-800">
                      {icon.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-white/80 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-2.5 text-xs text-slate-500">
            <MeatBadge iconId={draftId} size="sm" />
            <span>
              Seleccionado: <strong className="text-slate-800">{draftIcon.name}</strong>
            </span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => onSelect(draftId)}
              className="rounded-xl bg-[#176b5d] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#12584d]"
            >
              Usar este icono
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
