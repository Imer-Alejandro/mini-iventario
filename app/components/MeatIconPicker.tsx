"use client";

import { useState } from "react";
import { MEAT_ICONS, MeatBadge, getMeatIcon } from "@/lib/icons/meat-icons";
import { Check } from "lucide-react";

interface MeatIconPickerProps {
  selectedIconId: string;
  onSelect: (iconId: string) => void;
}

export function MeatIconPicker({ selectedIconId, onSelect }: MeatIconPickerProps) {
  const [filterCat, setFilterCat] = useState<string>("ALL");

  const filteredIcons = MEAT_ICONS.filter(
    (icon) => filterCat === "ALL" || icon.category === filterCat
  );

  const selectedDef = getMeatIcon(selectedIconId);

  return (
    <div className="space-y-3">
      {/* Icono Actualmente Seleccionado */}
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
        <MeatBadge iconId={selectedIconId} size="lg" />
        <div>
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Ícono asignado al corte
          </span>
          <span className="text-sm font-bold text-slate-900">{selectedDef.name}</span>
          <p className="text-[11px] text-slate-500">Identificador visual que aparecerá en el catálogo y en el punto de venta.</p>
        </div>
      </div>

      {/* Filtros de Categoría */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: "ALL", label: "Todos" },
          { id: "res", label: "Res" },
          { id: "cerdo", label: "Cerdo" },
          { id: "pollo", label: "Pollo" },
          { id: "embutidos", label: "Embutidos" },
          { id: "otros", label: "Otros" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilterCat(tab.id)}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
              filterCat === tab.id
                ? "bg-[#176b5d] text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Muestra de Íconos */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1">
        {filteredIcons.map((icon) => {
          const isSelected = icon.id === selectedIconId;
          return (
            <button
              key={icon.id}
              type="button"
              onClick={() => onSelect(icon.id)}
              className={`relative flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-left transition-all ${
                isSelected
                  ? "border-emerald-600 bg-emerald-50 shadow-sm ring-2 ring-emerald-600/15"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              {isSelected && (
                <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </div>
              )}
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-2xl shadow-sm">{icon.emoji}</span>
              <span className="line-clamp-2 text-center text-[10px] font-semibold leading-tight text-slate-800">
                {icon.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
