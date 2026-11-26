import Decimal from "decimal.js";
import { validateAndParseAmount } from "@/lib/money";
import { prisma } from "@/lib/db";
import {
  calculateCountedCash,
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
  clientOpId?: string;
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

type PersistedSessionFields = {
  userName?: string;
  denominationBreakdown?: string | null;
};

function getPersistedUserName(session: object): string {
  return "userName" in session && typeof session.userName === "string"
    ? session.userName
    : "";
}

function mapPersistedCashSession(
  session: NonNullable<Awaited<ReturnType<typeof prisma.cashSession.findUnique>>> & PersistedSessionFields,
): CashSessionData {
  return {
    id: session.id,
    sessionNumber: session.sessionNumber,
    userId: session.userId,
    userName: getPersistedUserName(session),
    openingAmount: session.openingAmount.toFixed(2),
    expectedAmount: session.expectedAmount.toFixed(2),
    countedAmount: session.countedAmount?.toFixed(2),
    difference: session.difference?.toFixed(2),
    diffReason: session.diffReason ?? undefined,
    status: session.status as CashSessionData["status"],
    openedAt: session.openedAt,
    closedAt: session.closedAt ?? undefined,
    denominationBreakdown: session.denominationBreakdown
      ? JSON.parse(session.denominationBreakdown) as Record<string, number>
      : undefined,
  };
}

/**
 * Abre un turno de caja con fondo inicial.
 * Regla: Solo una caja abierta simultáneamente por estación/cajero.
 */
export async function openCashSession(params: OpenSessionParams): Promise<CashSessionData> {
  const opening = validateAndParseAmount(params.openingAmount || "0");
  if (opening.isNegative()) throw new Error("El fondo de apertura no puede ser negativo");
  if (process.env.NODE_ENV !== "test") {
    return prisma.$transaction(async (tx) => {
      const active = await tx.cashSession.findFirst({ where: { status: "OPEN" } });
      if (active) {
        throw new Error(`Ya existe una caja abierta (#${active.sessionNumber}) a nombre de ${getPersistedUserName(active)}. Debe cerrarla antes de abrir una nueva.`);
      }
      const counter = await tx.counter.upsert({
        where: { series: "CASH_SESSIONS" },
        create: { series: "CASH_SESSIONS", lastValue: 1 },
        update: { lastValue: { increment: 1 } },
      });
      const amount = opening.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
      const session = await tx.cashSession.create({
        data: {
          sessionNumber: counter.lastValue,
          userId: params.userId,
          userName: params.userName,
          openingAmount: amount,
          expectedAmount: amount,
          status: "OPEN",
        },
      });
      await tx.auditLog.create({
        data: {
          userId: params.userId,
          action: "OPEN",
          entity: "CASH",
          entityId: session.id,
          afterState: { openingAmount: amount, sessionNumber: session.sessionNumber },
        },
      });
      return mapPersistedCashSession(session);
    });
  }

  // Verificar si ya existe una sesión abierta
  const activeSession = store.getActiveCashSession();
  if (activeSession) {
    throw new Error(`Ya existe una caja abierta (#${activeSession.sessionNumber}) a nombre de ${activeSession.userName}. Debe cerrarla antes de abrir una nueva.`);
  }

  const openingStr = opening.toFixed(2);

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
  const amount = validateAndParseAmount(params.amount);
  if (amount.isZero() || amount.isNegative()) throw new Error("El monto del movimiento debe ser un número positivo mayor que cero");
  if (process.env.NODE_ENV !== "test") {
    if ((params.type === "RETIRO_MANUAL" || params.type === "INGRESO_MANUAL") && !params.reason?.trim()) {
      throw new Error("Los retiros e ingresos manuales exigen un motivo obligatorio");
    }
    if (params.type === "RETIRO_MANUAL" && amount.greaterThan(1000) && !params.authorizedBy) {
      throw new Error("Los retiros mayores a RD$ 1,000.00 requieren autorización de supervisor");
    }

    return prisma.$transaction(async (tx) => {
      if (params.clientOpId) {
        const existing = await tx.cashMovement.findFirst({ where: { clientOpId: params.clientOpId } });
        if (existing) {
          return {
            ...existing,
            type: existing.type as CashMovementData["type"],
            amount: existing.amount.toFixed(2),
            reason: existing.reason ?? undefined,
            authorizedBy: existing.authorizedBy ?? undefined,
          };
        }
      }
      const session = await tx.cashSession.findUnique({ where: { id: params.cashSessionId } });
      if (!session) throw new Error("La sesión de caja especificada no existe");
      if (session.status !== "OPEN") throw new Error("No se pueden registrar movimientos en una caja ya cerrada");
      const amountStr = amount.toFixed(2);
      const current = new Decimal(session.expectedAmount.toString());
      const next = ["VENTA_EFECTIVO", "ABONO_EFECTIVO", "INGRESO_MANUAL"].includes(params.type)
        ? current.plus(amount)
        : current.minus(amount);
      if (next.isNegative()) {
        throw new Error(`Retiro denegado: el monto (RD$ ${amountStr}) supera el efectivo disponible en caja (RD$ ${session.expectedAmount})`);
      }

      const movement = await tx.cashMovement.create({
        data: {
          cashSessionId: session.id,
          type: params.type,
          amount: amountStr,
          clientOpId: params.clientOpId,
          reason: params.reason,
          userId: params.userId,
          authorizedBy: params.authorizedBy,
        },
      });
      await tx.cashSession.update({
        where: { id: session.id },
        data: { expectedAmount: next.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2) },
      });
      await tx.auditLog.create({
        data: {
          userId: params.userId,
          action: "CASH_MOVEMENT",
          entity: "CASH",
          entityId: movement.id,
          afterState: { type: movement.type, amount: amountStr, newExpected: next.toFixed(2) },
          authorizedBy: params.authorizedBy,
        },
      });
      return {
        ...movement,
        type: movement.type as CashMovementData["type"],
        amount: movement.amount.toFixed(2),
        reason: movement.reason ?? undefined,
        authorizedBy: movement.authorizedBy ?? undefined,
      };
    });
  }

  const session = store.getCashSessions().find((s) => s.id === params.cashSessionId);
  if (!session) {
    throw new Error("La sesión de caja especificada no existe");
  }
  if (session.status !== "OPEN") {
    throw new Error("No se pueden registrar movimientos en una caja ya cerrada");
  }

  const amountStr = amount.toFixed(2);

  // Retiros o Ingresos manuales exigen motivo
  if ((params.type === "RETIRO_MANUAL" || params.type === "INGRESO_MANUAL") && !params.reason?.trim()) {
    throw new Error(`Los retiros e ingresos manuales exigen un motivo obligatorio`);
  }

  // Si es un retiro manual que supera RD$ 1,000.00 exige autorización de supervisor
  if (params.type === "RETIRO_MANUAL" && amount.greaterThan(1000) && !params.authorizedBy) {
    throw new Error("Los retiros mayores a RD$ 1,000.00 requieren autorización de supervisor");
  }

  // Recalcular saldo esperado de la caja
  const currentExpected = new Decimal(session.expectedAmount);
  let newExpected: Decimal;

  if (params.type === "VENTA_EFECTIVO" || params.type === "ABONO_EFECTIVO" || params.type === "INGRESO_MANUAL") {
    newExpected = currentExpected.plus(amount);
  } else {
    // RETIRO_MANUAL
    newExpected = currentExpected.minus(amount);
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
  if (process.env.NODE_ENV !== "test") {
    const session = await prisma.cashSession.findUnique({
      where: { id: sessionId },
      include: { movements: true },
    });
    if (!session) throw new Error("Sesión de caja no encontrada");

    const totals = {
      cashSales: new Decimal(0),
      customerAbonos: new Decimal(0),
      manualIngresos: new Decimal(0),
      manualRetiros: new Decimal(0),
    };
    for (const movement of session.movements) {
      const amount = new Decimal(movement.amount.toString());
      switch (movement.type) {
        case "VENTA_EFECTIVO": totals.cashSales = totals.cashSales.plus(amount); break;
        case "ABONO_EFECTIVO": totals.customerAbonos = totals.customerAbonos.plus(amount); break;
        case "INGRESO_MANUAL": totals.manualIngresos = totals.manualIngresos.plus(amount); break;
        case "RETIRO_MANUAL": totals.manualRetiros = totals.manualRetiros.plus(amount); break;
      }
    }
    const opening = new Decimal(session.openingAmount.toString());
    const expected = opening.plus(totals.cashSales).plus(totals.customerAbonos)
      .plus(totals.manualIngresos).minus(totals.manualRetiros);
    const difference = session.difference === null
      ? null
      : new Decimal(session.difference.toString());
    return {
      sessionId: session.id,
      sessionNumber: session.sessionNumber,
      userName: session.userName,
      status: session.status as CashSessionReport["status"],
      openingAmount: opening.toFixed(2),
      cashSales: totals.cashSales.toFixed(2),
      customerAbonos: totals.customerAbonos.toFixed(2),
      manualIngresos: totals.manualIngresos.toFixed(2),
      manualRetiros: totals.manualRetiros.toFixed(2),
      expectedAmount: expected.toFixed(2),
      countedAmount: session.countedAmount?.toFixed(2) ?? null,
      difference: difference?.toFixed(2) ?? null,
      diffReason: session.diffReason ?? null,
      openedAt: session.openedAt,
      closedAt: session.closedAt,
      isBalanced: difference?.isZero() ?? false,
    };
  }

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
  if (process.env.NODE_ENV !== "test") {
    return prisma.$transaction(async (tx) => {
      const session = await tx.cashSession.findUnique({ where: { id: params.cashSessionId } });
      if (!session) throw new Error("Sesión de caja no encontrada");
      if (session.status === "CLOSED") throw new Error("Esta caja ya se encuentra cerrada e inmutable");
      let counted: Decimal;
      if (params.denominationCounts) {
        counted = new Decimal(calculateCountedCash(params.denominationCounts));
      } else if (params.countedAmount !== undefined) {
        counted = validateAndParseAmount(params.countedAmount, true);
      } else {
        throw new Error("Debe ingresar el efectivo contado o el desglose de billetes/monedas");
      }
      if (counted.isNegative()) throw new Error("El efectivo contado no puede ser negativo");
      const movements = await tx.cashMovement.findMany({ where: { cashSessionId: session.id } });
      const total = movements.reduce((value, movement) => {
        const amount = new Decimal(movement.amount.toString());
        return ["RETIRO_MANUAL"].includes(movement.type)
          ? value.minus(amount)
          : value.plus(amount);
      }, new Decimal(session.openingAmount.toString()));
      const difference = counted.minus(total);
      if (!difference.isZero() && !params.diffReason?.trim()) {
        const tipo = difference.isNegative() ? "Faltante" : "Sobrante";
        throw new Error(`Hay una diferencia de ${tipo} de RD$ ${Math.abs(difference.toNumber()).toFixed(2)}. Debe ingresar una justificación obligatoria del descuadre.`);
      }
      const countedAmount = counted.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
      const differenceAmount = difference.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
      await tx.cashSession.update({
        where: { id: session.id },
        data: {
          status: "CLOSED",
          countedAmount,
          difference: differenceAmount,
          diffReason: params.diffReason?.trim() || null,
          closedAt: new Date(),
          denominationBreakdown: params.denominationCounts ? JSON.stringify(params.denominationCounts) : null,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: params.userId,
          action: "CASH_CLOSE",
          entity: "CASH",
          entityId: session.id,
          afterState: {
            expected: total.toFixed(2),
            counted: countedAmount,
            difference: differenceAmount,
            reason: params.diffReason,
          },
        },
      });
      const finalSession = await tx.cashSession.findUniqueOrThrow({
        where: { id: session.id },
        include: { movements: true },
      });
      const finalExpected = new Decimal(finalSession.openingAmount.toString()).plus(
        finalSession.movements.reduce((value, movement) => {
          const amount = new Decimal(movement.amount.toString());
          return movement.type === "RETIRO_MANUAL" ? value.minus(amount) : value.plus(amount);
        }, new Decimal(0)),
      );
      return {
        sessionId: session.id,
        sessionNumber: session.sessionNumber,
        userName: session.userName,
        status: "CLOSED",
        openingAmount: session.openingAmount.toFixed(2),
        cashSales: movements.filter((item) => item.type === "VENTA_EFECTIVO").reduce((v, item) => v.plus(item.amount.toString()), new Decimal(0)).toFixed(2),
        customerAbonos: movements.filter((item) => item.type === "ABONO_EFECTIVO").reduce((v, item) => v.plus(item.amount.toString()), new Decimal(0)).toFixed(2),
        manualIngresos: movements.filter((item) => item.type === "INGRESO_MANUAL").reduce((v, item) => v.plus(item.amount.toString()), new Decimal(0)).toFixed(2),
        manualRetiros: movements.filter((item) => item.type === "RETIRO_MANUAL").reduce((v, item) => v.plus(item.amount.toString()), new Decimal(0)).toFixed(2),
        expectedAmount: finalExpected.toFixed(2),
        countedAmount,
        difference: differenceAmount,
        diffReason: params.diffReason?.trim() || null,
        openedAt: session.openedAt,
        closedAt: finalSession.closedAt,
        isBalanced: difference.isZero(),
      };
    });
  }

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
    finalCounted = validateAndParseAmount(params.countedAmount, true);
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
