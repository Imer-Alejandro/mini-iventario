"use client";

import { useState } from "react";
import Decimal from "decimal.js";
import { Scale, X, Check, Sparkles } from "lucide-react";
import { TactileNumpad } from "./TactileNumpad";
import { calculateLineTotal, formatCurrencyRD, QTY_RE, validateAndParseQty } from "@/lib/money";
import { MeatBadge } from "@/lib/icons/meat-icons";

interface WeightInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuantity?: string;
  locationName: string;
  product: {
    id: string;
    code: string;
    name: string;
    unit: string;
    price: string;
    allowsDecimals: boolean;
    currentStock: string;
    iconId?: string;
  } | null;
  onConfirm: (quantity: string, unit: string) => void;
}

export function WeightInputModal({
  isOpen,
  onClose,
  initialQuantity,
  locationName,
  product,
  onConfirm,
}: WeightInputModalProps) {
  const [weight, setWeight] = useState(initialQuantity || (product?.allowsDecimals ? "1.000" : "1"));
  const [unit, setUnit] = useState(product?.unit || "kg");

  if (!isOpen || !product) return null;

  // Cálculo en vivo del subtotal de la línea con exactitud decimal ROUND_HALF_UP
  let lineTotalPreview = "0.00";
  const isValidWeight = QTY_RE.test(weight) && (product.allowsDecimals || !weight.includes("."));
  const exceedsAvailable = isValidWeight
    && validateAndParseQty(weight, product.allowsDecimals).greaterThan(new Decimal(product.currentStock));
  if (isValidWeight && validateAndParseQty(weight, product.allowsDecimals).gt(0)) {
    lineTotalPreview = calculateLineTotal(weight, product.price, product.allowsDecimals);
  }

  const handleConfirm = () => {
    if (!isValidWeight || !validateAndParseQty(weight, product.allowsDecimals).gt(0) || exceedsAvailable) return;
    onConfirm(weight, unit);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#0B192C]/40 backdrop-blur-md animate-in fade-in duration-200">
      <div className="glass-modal rounded-3xl w-full max-w-md overflow-hidden flex flex-col border border-white/90 shadow-2xl">
        {/* Cabecera con Icono Cárnico Amigable y Datos del Producto */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white/70">
          <div className="flex items-center gap-3">
            <MeatBadge iconId={product.iconId} size="md" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-extrabold text-slate-400 tracking-wider">
                  {product.code}
                </span>
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded-md">
                  Disponible en {locationName}: {product.currentStock} {product.unit}
                </span>
              </div>
              <h3 className="font-extrabold text-slate-900 text-base leading-tight">
                {product.name}
              </h3>
              <p className="text-xs text-emerald-700 font-bold mt-0.5">
                {formatCurrencyRD(product.price)} por {product.unit}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {exceedsAvailable && (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
            Solo hay {product.currentStock} {product.unit} disponibles en {locationName}.
          </p>
        )}

        {/* Cuerpo del Modal de Pesaje */}
        <div className="p-5 flex flex-col gap-3.5">
          {/* Display LUMINOSO Digital de la Balanza (Estilo Fintech / Balanza Moderna, CERO fondos negros agresivos) */}
          <div className="bg-gradient-to-br from-emerald-50/70 via-white to-slate-50 border-2 border-emerald-500/30 rounded-2xl p-4 shadow-sm flex items-center justify-between relative overflow-hidden">
            <div className="flex-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 flex items-center gap-1 mb-1">
                <Scale className="w-3.5 h-3.5 text-emerald-600" />
                Lectura de Balanza ({unit})
              </span>
              <div className="flex items-baseline gap-1.5">
                <input
                  type="text"
                  inputMode={product.allowsDecimals ? "decimal" : "numeric"}
                  aria-label={`Cantidad de ${product.name}`}
                  autoComplete="off"
                  maxLength={product.allowsDecimals ? 15 : 11}
                  placeholder={product.allowsDecimals ? "0.000" : "0"}
                  value={weight}
                  onFocus={(event) => event.currentTarget.select()}
                  onChange={(event) => {
                    const enteredValue = event.currentTarget.value.replace(",", ".");
                    const nextValue = enteredValue.startsWith(".") ? `0${enteredValue}` : enteredValue;
                    const pattern = product.allowsDecimals
                      ? /^\d{0,11}(?:\.\d{0,3})?$/
                      : /^\d{0,11}$/;
                    if (nextValue === "" || pattern.test(nextValue)) setWeight(nextValue);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleConfirm();
                    }
                  }}
                  className="w-full min-w-0 bg-transparent text-4xl sm:text-5xl font-black font-mono text-slate-900 tracking-tight outline-none"
                />
                <span className="text-lg text-emerald-700 font-bold">{unit}</span>
              </div>
            </div>

            <div className="text-right border-l border-emerald-200/60 pl-4">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
                Subtotal
              </span>
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-700">
                {formatCurrencyRD(lineTotalPreview)}
              </span>
            </div>
          </div>

          {/* Selector de Unidad de Medida (kg / lb) si el corte se vende por peso */}
          {product.allowsDecimals && (
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100/80 rounded-xl">
              <button
                type="button"
                onClick={() => setUnit("kg")}
                className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                  unit === "kg"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Kilogramos (kg)
              </button>
              <button
                type="button"
                onClick={() => setUnit("lb")}
                className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                  unit === "lb"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Libras (lb)
              </button>
            </div>
          )}

          {/* Teclado Táctil con Chips Rápidos */}
          <TactileNumpad
            value={weight}
            onChange={setWeight}
            maxDecimals={product.allowsDecimals ? 3 : 0}
            maxIntegerDigits={11}
            quickAmounts={
              product.allowsDecimals
                ? ["0.250", "0.500", "1.000", "1.500", "2.000", "5.000"]
                : ["1", "2", "3", "5", "10"]
            }
            onQuickAmountSelect={(val) => setWeight(val)}
          />

          {/* Botón Principal de Agregar al Carrito */}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isValidWeight || !validateAndParseQty(weight, product.allowsDecimals).gt(0) || exceedsAvailable}
            className="w-full py-4 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 active:scale-98 disabled:opacity-40 text-white font-black rounded-2xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 text-base cursor-pointer"
          >
            <Check className="w-5 h-5 stroke-[2.5]" />
            Agregar al Carrito • {formatCurrencyRD(lineTotalPreview)}
          </button>
        </div>
      </div>
    </div>
  );
}
