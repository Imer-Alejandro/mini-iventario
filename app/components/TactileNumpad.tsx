"use client";

import { Delete } from "lucide-react";

interface TactileNumpadProps {
  value: string;
  onChange: (newValue: string) => void;
  quickAmounts?: string[];
  onQuickAmountSelect?: (amount: string) => void;
  maxDecimals?: number;
  className?: string;
  prefix?: string;
}

export function TactileNumpad({
  value,
  onChange,
  quickAmounts,
  onQuickAmountSelect,
  maxDecimals = 3,
  className = "",
  prefix = "",
}: TactileNumpadProps) {
  const handleDigit = (digit: string) => {
    if (digit === ".") {
      if (value.includes(".")) return;
      onChange(value === "" ? "0." : `${value}.`);
      return;
    }

    if (value === "0") {
      onChange(digit);
      return;
    }

    // Comprobar límite de decimales
    if (value.includes(".")) {
      const parts = value.split(".");
      if (parts[1] && parts[1].length >= maxDecimals) {
        return; // No permite exceder los decimales permitidos
      }
    }

    onChange(`${value}${digit}`);
  };

  const handleBackspace = () => {
    if (value.length <= 1) {
      onChange("");
    } else {
      onChange(value.slice(0, -1));
    }
  };

  const handleClear = () => {
    onChange("");
  };

  return (
    <div className={`flex flex-col gap-2.5 select-none ${className}`}>
      {/* Botones de sugerencias rápidas (chips táctiles) */}
      {quickAmounts && quickAmounts.length > 0 && (
        <div className="grid grid-cols-4 gap-1.5">
          {quickAmounts.map((amt) => {
            const isExact = amt === "Exacto";
            return (
              <button
                key={amt}
                type="button"
                onClick={() => onQuickAmountSelect && onQuickAmountSelect(amt)}
                className={`py-2 px-1 text-xs font-bold rounded-xl border transition-all active:scale-95 shadow-xs text-center ${
                  isExact
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                    : "border-slate-200/90 bg-white/80 hover:bg-white text-slate-800"
                }`}
              >
                {isExact ? "Exacto" : `${prefix}${amt}`}
              </button>
            );
          })}
        </div>
      )}

      {/* Matriz Numérica Táctil 3x4 */}
      <div className="grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
          <button
            key={num}
            type="button"
            onClick={() => handleDigit(num)}
            className="h-13 sm:h-14 text-2xl font-bold font-mono rounded-2xl border border-slate-200/80 bg-white/85 text-slate-800 shadow-xs hover:bg-white hover:border-slate-300 active:bg-slate-100 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
          >
            {num}
          </button>
        ))}

        {/* Punto Decimal */}
        <button
          type="button"
          onClick={() => handleDigit(".")}
          className="h-13 sm:h-14 text-2xl font-bold font-mono rounded-2xl border border-slate-200/80 bg-slate-50/80 text-slate-700 hover:bg-white active:scale-95 transition-all flex items-center justify-center cursor-pointer"
        >
          .
        </button>

        {/* Cero */}
        <button
          type="button"
          onClick={() => handleDigit("0")}
          className="h-13 sm:h-14 text-2xl font-bold font-mono rounded-2xl border border-slate-200/80 bg-white/85 text-slate-800 shadow-xs hover:bg-white active:scale-95 transition-all flex items-center justify-center cursor-pointer"
        >
          0
        </button>

        {/* Retroceso / Borrar dígito */}
        <button
          type="button"
          onClick={handleBackspace}
          className="h-13 sm:h-14 text-slate-600 rounded-2xl border border-slate-200/80 bg-slate-100/80 hover:bg-slate-200/80 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
          title="Borrar último dígito"
        >
          <Delete className="w-5 h-5 text-slate-600" />
        </button>
      </div>

      {/* Limpiar entrada completa */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleClear}
          className="text-[11px] text-slate-400 hover:text-rose-600 font-semibold transition-colors py-0.5"
        >
          Limpiar valor
        </button>
      </div>
    </div>
  );
}
