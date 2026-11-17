import Decimal from "decimal.js";
import { prisma } from "@/lib/db";
import {
  AMOUNT_RE,
  DOP_DENOMINATIONS,
  calculateCountedCash,
  formatCurrencyRD,
} from "@/lib/money";
import { store, CashSessionData, CashMovementData } from "./data-store";
import { recordAudit } from "./audit.service";

export interface OpenSessionParams {
  userId: string;
  userName: string;
  openingAmount: string; // DECIMAL(16,2)
}

export interface RecordCashMovementParams {
  cashSessionId: string;
  type: "VENTA_EFECTIVO" | "ABONO_EFECTIVO" | "INGRESO_MANUAL" | "RETIRO_MANUAL";
  amount: string; // DECIMAL(16,2)
  reason?: string;
  userId: string;
  authorizedBy?: string;
}

export interface CloseSessionParams {
  cashSessionId: string;
  countedAmount?: string; // Total contado directamente
  denominationCounts?: Record<string, number>; // O conteo por billetes/monedas
  diffReason?: string;
  userId: string;
}

export interface CashSessionReport {
  sessionId: string;
  sessionNumber: number;
  userName: string;
  status: "OPEN" | "CLOSED";
  openingAmount: string;
  cashSales: string;
  customerAbonos: string;
  manualIngresos: string;
  manualRetiros: string;
  expectedAmount: string;
  countedAmount: string | null;
  difference: string | null;
  diffReason: string | null;
  openedAt: Date;
  closedAt: Date | null;
  isBalanced: boolean;
}

/**
 * Abre un turno de caja con fondo inicial.
 * Regla: Solo una caja abierta simultáneamente por estación/cajero.
 */
export async function openCashSession(params: OpenSessionParams): Promise<CashSessionData> {
  const openingDec = new Decimal(params.openingAmount || "0");
  if (openingDec.isNegative()) {
    throw new Error("El fondo de apertura no puede ser negativo");
  }

  // Verificar si ya existe una sesión abierta
  const activeSession = store.getActiveCashSession();
  if (activeSession) {
    throw new Error(`Ya existe una caja abierta (#${activeSession.sessionNumber}) a nombre de ${activeSession.userName}. Debe cerrarla antes de abrir una nueva.`);
  }

  const openingStr = openingDec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);

  const session = store.createCashSession({
    userId: params.userId,
    userName: params.userName,
    openingAmount: openingStr,
    expectedAmount: openingStr,
    status: "OPEN",
  });

  await recordAudit({
    userId: params.userId,
    action: "OPEN",
    entity: "CASH",
    entityId: session.id,
    afterState: { openingAmount: openingStr, sessionNumber: session.sessionNumber },
  });

  return session;
}

/**
 * Registra un movimiento de caja (Venta, Abono, Ingreso, Retiro)
 */
export async function recordCashMovement(params: RecordCashMovementParams): Promise<CashMovementData> {
  const session = store.getCashSessions().find((s) => s.id === params.cashSessionId);
  if (!session) {
    throw new Error("La sesión de caja especificada no existe");
  }
  if (session.status !== "OPEN") {
    throw new Error("No se pueden registrar movimientos en una caja ya cerrada");
  }

  const amountDec = new Decimal(params.amount);
  if (amountDec.isZero() || amountDec.isNegative()) {
    throw new Error("El monto del movimiento debe ser un número positivo mayor que cero");
  }

  const amountStr = amountDec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);

  // Retiros o Ingresos manuales exigen motivo
  if ((params.type === "RETIRO_MANUAL" || params.type === "INGRESO_MANUAL") && !params.reason?.trim()) {
    throw new Error(`Los retiros e ingresos manuales exigen un motivo obligatorio`);
  }

  // Si es un retiro manual que supera RD$ 1,000.00 exige autorización de supervisor
  if (params.type === "RETIRO_MANUAL" && amountDec.greaterThan(1000) && !params.authorizedBy) {
    throw new Error("Los retiros mayores a RD$ 1,000.00 requieren autorización de supervisor");
  }

  // Recalcular saldo esperado de la caja
  const currentExpected = new Decimal(session.expectedAmount);
  let newExpected: Decimal;

  if (params.type === "VENTA_EFECTIVO" || params.type === "ABONO_EFECTIVO" || params.type === "INGRESO_MANUAL") {
    newExpected = currentExpected.plus(amountDec);
  } else {
    // RETIRO_MANUAL
    newExpected = currentExpected.minus(amountDec);
    if (newExpected.isNegative()) {
      throw new Error(`Retiro denegado: el monto (RD$ ${amountStr}) supera el efectivo disponible en caja (RD$ ${session.expectedAmount})`);
    }
  }

  const mov = store.recordCashMovement({
    cashSessionId: session.id,
    type: params.type,
    amount: amountStr,
    reason: params.reason,
    userId: params.userId,
    authorizedBy: params.authorizedBy,
  });

  store.updateCashSession(session.id, {
    expectedAmount: newExpected.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
  });

  await recordAudit({
    userId: params.userId,
    action: "CASH_MOVEMENT",
    entity: "CASH",
    entityId: mov.id,
    afterState: { type: mov.type, amount: mov.amount, newExpected: newExpected.toFixed(2) },
    authorizedBy: params.authorizedBy,
  });

  return mov;
}

/**
 * Obtiene el reporte y estado financiero en vivo de la caja
 */
export async function getCashSessionReport(sessionId: string): Promise<CashSessionReport> {
  const session = store.getCashSessions().find((s) => s.id === sessionId);
  if (!session) {
    throw new Error("Sesión de caja no encontrada");
  }

  const movements = store.getCashMovements(session.id);

  let cashSales = new Decimal(0);
  let customerAbonos = new Decimal(0);
  let manualIngresos = new Decimal(0);
  let manualRetiros = new Decimal(0);

  for (const m of movements) {
    const amt = new Decimal(m.amount);
    switch (m.type) {
      case "VENTA_EFECTIVO":
        cashSales = cashSales.plus(amt);
        break;
      case "ABONO_EFECTIVO":
        customerAbonos = customerAbonos.plus(amt);
        break;
      case "INGRESO_MANUAL":
        manualIngresos = manualIngresos.plus(amt);
        break;
      case "RETIRO_MANUAL":
        manualRetiros = manualRetiros.plus(amt);
        break;
    }
  }

  const opening = new Decimal(session.openingAmount);
  const expected = opening.plus(cashSales).plus(customerAbonos).plus(manualIngresos).minus(manualRetiros);

  const diffDec = session.difference ? new Decimal(session.difference) : null;
  const isBalanced = diffDec !== null ? diffDec.isZero() : false;

  return {
    sessionId: session.id,
    sessionNumber: session.sessionNumber,
    userName: session.userName,
    status: session.status,
    openingAmount: opening.toFixed(2),
    cashSales: cashSales.toFixed(2),
    customerAbonos: customerAbonos.toFixed(2),
    manualIngresos: manualIngresos.toFixed(2),
    manualRetiros: manualRetiros.toFixed(2),
    expectedAmount: expected.toFixed(2),
    countedAmount: session.countedAmount ?? null,
    difference: session.difference ?? null,
    diffReason: session.diffReason ?? null,
    openedAt: session.openedAt,
    closedAt: session.closedAt ?? null,
    isBalanced,
  };
}

/**
 * Cierre de caja diario con arqueo de efectivo físico
 * - Conteo físico de dinero
 * - Cálculo exacto de diferencia: countedAmount - expectedAmount
 * - Exige justificación si diferencia != 0 (faltante o sobrante)
 * - Congela la sesión en estado CLOSED (inmutable)
 */
export async function closeCashSession(params: CloseSessionParams): Promise<CashSessionReport> {
  const session = store.getCashSessions().find((s) => s.id === params.cashSessionId);
  if (!session) {
    throw new Error("Sesión de caja no encontrada");
  }
  if (session.status === "CLOSED") {
    throw new Error("Esta caja ya se encuentra cerrada e inmutable");
  }

  let finalCounted: Decimal;
  if (params.denominationCounts) {
    finalCounted = new Decimal(calculateCountedCash(params.denominationCounts));
  } else if (params.countedAmount !== undefined) {
    finalCounted = new Decimal(params.countedAmount);
  } else {
    throw new Error("Debe ingresar el efectivo contado o el desglose de billetes/monedas");
  }

  if (finalCounted.isNegative()) {
    throw new Error("El efectivo contado no puede ser negativo");
  }

  // Calcular el total esperado actual
  const report = await getCashSessionReport(session.id);
  const expectedDec = new Decimal(report.expectedAmount);
  const differenceDec = finalCounted.minus(expectedDec);

  const differenceStr = differenceDec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
  const countedStr = finalCounted.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);

  // Si hay descuadre (diferencia no es cero), la justificación es obligatoria
  if (!differenceDec.isZero()) {
    if (!params.diffReason?.trim()) {
      const tipo = differenceDec.isNegative() ? "Faltante" : "Sobrante";
      throw new Error(`Hay una diferencia de ${tipo} de RD$ ${Math.abs(differenceDec.toNumber()).toFixed(2)}. Debe ingresar una justificación obligatoria del descuadre.`);
    }
  }

  store.updateCashSession(session.id, {
    status: "CLOSED",
    countedAmount: countedStr,
    difference: differenceStr,
    diffReason: params.diffReason?.trim() || undefined,
    closedAt: new Date(),
    denominationBreakdown: params.denominationCounts,
  });


  await recordAudit({
    userId: params.userId,
    action: "CASH_CLOSE",
    entity: "CASH",
    entityId: session.id,
    afterState: {
      expected: report.expectedAmount,
      counted: countedStr,
      difference: differenceStr,
      reason: params.diffReason,
    },
  });

  return getCashSessionReport(session.id);
}
