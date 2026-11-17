import Decimal from "decimal.js";

// Configuración global para operaciones financieras y pesaje comercial
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

// Expresión regular para cantidades: hasta 11 enteros y hasta 3 decimales (gramos)
export const QTY_RE = /^\d{1,11}(\.\d{1,3})?$/;

// Expresión regular para precios unitarios: hasta 11 enteros y hasta 4 decimales
export const PRICE_RE = /^\d{1,11}(\.\d{1,4})?$/;

// Expresión regular para importes: hasta 14 enteros y hasta 2 decimales
export const AMOUNT_RE = /^\d{1,14}(\.\d{1,2})?$/;

/**
 * Valida y normaliza una cantidad en string. Rechaza comas o formatos fuera de regla.
 * @throws Error si no cumple con el formato DECIMAL(14,3)
 */
export function validateAndParseQty(raw: string, allowsDecimals = true): Decimal {
  const trimmed = raw.trim();
  if (!QTY_RE.test(trimmed)) {
    throw new Error(`Cantidad inválida "${raw}": debe tener como máximo 3 decimales y usar punto (.)`);
  }
  const d = new Decimal(trimmed);
  if (!allowsDecimals && !d.isInteger()) {
    throw new Error(`Este producto no permite cantidades fraccionadas (debe ser entero)`);
  }
  return d;
}

/**
 * Valida y parsea un precio unitario DECIMAL(14,4)
 */
export function validateAndParsePrice(raw: string): Decimal {
  const trimmed = raw.trim();
  if (!PRICE_RE.test(trimmed)) {
    throw new Error(`Precio unitario inválido "${raw}": debe usar punto (.) y máximo 4 decimales`);
  }
  return new Decimal(trimmed);
}

/**
 * Calcula el importe de línea redondeado a 2 decimales (estándar comercial ROUND_HALF_UP):
 * line_total = round(qty * unit_price, 2)
 */
export function calculateLineTotal(qtyStr: string, unitPriceStr: string, allowsDecimals = true): string {
  const q = validateAndParseQty(qtyStr, allowsDecimals);
  const p = validateAndParsePrice(unitPriceStr);
  return q.mul(p).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

/**
 * Suma una lista de importes ya redondeados por línea:
 * total = Σ line_total (garantiza que el ticket impreso cuadre al centavo exacto)
 */
export function sumLineTotals(lineTotals: string[]): string {
  const total = lineTotals.reduce((acc, curr) => {
    return acc.plus(new Decimal(curr));
  }, new Decimal(0));

  return total.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

/**
 * Suma o resta movimientos de libro mayor (ledger)
 */
export function calculateLedgerBalance(movements: { amount: string; type: "INCREMENT" | "DECREMENT" }[]): string {
  const balance = movements.reduce((acc, mov) => {
    const val = new Decimal(mov.amount);
    return mov.type === "INCREMENT" ? acc.plus(val) : acc.minus(val);
  }, new Decimal(0));

  return balance.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

/**
 * Formato de presentación visual para el usuario dominicano (RD$).
 * NOTA: Usar ÚNICAMENTE para renderizado final en pantalla o ticket, NUNCA para cálculos.
 */
export function formatCurrencyRD(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num).replace("DOP", "RD$");
}

/**
 * Formato de visualización de peso/cantidad
 */
export function formatQuantity(qtyStr: string, unit: string): string {
  return `${qtyStr} ${unit}`;
}

/**
 * Calcula el cambio / devuelta en una venta en efectivo
 */
export function calculateChange(
  paidAmountStr: string,
  totalAmountStr: string
): { change: string; isSufficient: boolean; remainingDue: string } {
  const paid = new Decimal(paidAmountStr || "0");
  const total = new Decimal(totalAmountStr || "0");
  const diff = paid.minus(total);

  if (diff.isNegative()) {
    return {
      change: "0.00",
      isSufficient: false,
      remainingDue: diff.abs().toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
    };
  }

  return {
    change: diff.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
    isSufficient: true,
    remainingDue: "0.00",
  };
}

/**
 * Denominaciones oficiales de curso legal en República Dominicana (RD$)
 */
export const DOP_DENOMINATIONS = [
  { value: "2000.00", label: "RD$ 2,000", type: "BILLETE" },
  { value: "1000.00", label: "RD$ 1,000", type: "BILLETE" },
  { value: "500.00", label: "RD$ 500", type: "BILLETE" },
  { value: "200.00", label: "RD$ 200", type: "BILLETE" },
  { value: "100.00", label: "RD$ 100", type: "BILLETE" },
  { value: "50.00", label: "RD$ 50", type: "BILLETE" },
  { value: "25.00", label: "RD$ 25", type: "MONEDA" },
  { value: "10.00", label: "RD$ 10", type: "MONEDA" },
  { value: "5.00", label: "RD$ 5", type: "MONEDA" },
  { value: "1.00", label: "RD$ 1", type: "MONEDA" },
] as const;

/**
 * Calcula el total en efectivo contado a partir de un desglose de denominaciones
 */
export function calculateCountedCash(counts: Record<string, number>): string {
  let total = new Decimal(0);
  for (const denom of DOP_DENOMINATIONS) {
    const qty = counts[denom.value] || 0;
    if (qty > 0) {
      total = total.plus(new Decimal(denom.value).mul(qty));
    }
  }
  return total.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

/**
 * Verifica la disponibilidad de crédito para un cliente según su límite y deuda actual
 */
export function checkCreditAvailability(
  currentBalanceStr: string,
  creditLimitStr: string,
  newSaleAmountStr: string
): {
  allowed: boolean;
  newBalance: string;
  availableCredit: string;
  exceededAmount: string;
} {
  const current = new Decimal(currentBalanceStr || "0");
  const limit = new Decimal(creditLimitStr || "0");
  const sale = new Decimal(newSaleAmountStr || "0");

  const newBalance = current.plus(sale);
  const diff = limit.minus(newBalance);

  if (diff.isNegative()) {
    return {
      allowed: false,
      newBalance: newBalance.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
      availableCredit: "0.00",
      exceededAmount: diff.abs().toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
    };
  }

  return {
    allowed: true,
    newBalance: newBalance.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
    availableCredit: diff.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
    exceededAmount: "0.00",
  };
}

