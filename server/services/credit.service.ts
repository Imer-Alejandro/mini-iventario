import Decimal from "decimal.js";
import { store, CustomerData, CustomerLedgerData } from "./data-store";
import { checkCreditAvailability } from "@/lib/money";
import { recordAudit } from "./audit.service";
import { recordCashMovement } from "./cash.service";
import { prisma } from "@/lib/db";

export interface RecordCustomerPaymentParams {
  customerId: string;
  clientOpId?: string;
  amount: string; // DECIMAL(16,2)
  paymentMethod: "EFECTIVO" | "TRANSFERENCIA" | "TARJETA";
  cashSessionId?: string; // Si es en efectivo, se enlaza a la caja activa
  note?: string;
  userId: string;
}

export interface CreditCheckResult {
  allowed: boolean;
  requiresSupervisorAuth: boolean;
  customerName: string;
  currentBalance: string;
  creditLimit: string;
  saleAmount: string;
  newBalance: string;
  availableCredit: string;
  exceededAmount: string;
  reason?: string;
}

/**
 * Valida la disponibilidad de crédito antes de autorizar una venta
 */
export async function checkCustomerCredit(
  customerId: string,
  saleAmountStr: string,
  allowExcess = false
): Promise<CreditCheckResult> {
  if (process.env.NODE_ENV !== "test") {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new Error("Cliente no encontrado");
    const balance = customer.balance.toFixed(2);
    const creditLimit = customer.creditLimit.toFixed(2);
    if (customer.status === "BLOCKED") {
      return {
        allowed: false,
        requiresSupervisorAuth: true,
        customerName: customer.name,
        currentBalance: balance,
        creditLimit,
        saleAmount: saleAmountStr,
        newBalance: balance,
        availableCredit: "0.00",
        exceededAmount: saleAmountStr,
        reason: "El cliente está BLOQUEADO por morosidad o límite excedido.",
      };
    }
    const check = checkCreditAvailability(balance, creditLimit, saleAmountStr);
    if (!check.allowed && !allowExcess) {
      return {
        allowed: false,
        requiresSupervisorAuth: true,
        customerName: customer.name,
        currentBalance: balance,
        creditLimit,
        saleAmount: saleAmountStr,
        newBalance: check.newBalance,
        availableCredit: check.availableCredit,
        exceededAmount: check.exceededAmount,
        reason: `La venta excede el límite de crédito en RD$ ${check.exceededAmount}. Requiere autorización de supervisor.`,
      };
    }
    return {
      allowed: true,
      requiresSupervisorAuth: false,
      customerName: customer.name,
      currentBalance: balance,
      creditLimit,
      saleAmount: saleAmountStr,
      newBalance: check.newBalance,
      availableCredit: check.availableCredit,
      exceededAmount: check.exceededAmount,
    };
  }

  const customer = store.getCustomerById(customerId);
  if (!customer) {
    throw new Error("Cliente no encontrado");
  }

  if (customer.status === "BLOCKED") {
    return {
      allowed: false,
      requiresSupervisorAuth: true,
      customerName: customer.name,
      currentBalance: customer.balance,
      creditLimit: customer.creditLimit,
      saleAmount: saleAmountStr,
      newBalance: customer.balance,
      availableCredit: "0.00",
      exceededAmount: saleAmountStr,
      reason: "El cliente está BLOQUEADO por morosidad o límite excedido.",
    };
  }

  const check = checkCreditAvailability(customer.balance, customer.creditLimit, saleAmountStr);

  if (!check.allowed && !allowExcess) {
    return {
      allowed: false,
      requiresSupervisorAuth: true,
      customerName: customer.name,
      currentBalance: customer.balance,
      creditLimit: customer.creditLimit,
      saleAmount: saleAmountStr,
      newBalance: check.newBalance,
      availableCredit: check.availableCredit,
      exceededAmount: check.exceededAmount,
      reason: `La venta excede el límite de crédito en RD$ ${check.exceededAmount}. Requiere autorización de supervisor.`,
    };
  }

  return {
    allowed: true,
    requiresSupervisorAuth: false,
    customerName: customer.name,
    currentBalance: customer.balance,
    creditLimit: customer.creditLimit,
    saleAmount: saleAmountStr,
    newBalance: check.newBalance,
    availableCredit: check.availableCredit,
    exceededAmount: check.exceededAmount,
  };
}

/**
 * Registra un movimiento en la cuenta corriente del cliente y actualiza su saldo en caché
 */
export async function recordCustomerLedgerMovement(params: {
  customerId: string;
  clientOpId?: string;
  type: "VENTA" | "ABONO" | "AJUSTE" | "ANULACION";
  amount: string; // Venta (+), Abono (-), Anulación (-)
  referenceId?: string;
  note?: string;
  userId: string;
}): Promise<CustomerLedgerData> {
  if (process.env.NODE_ENV !== "test") {
    return prisma.$transaction(async (tx) => {
      if (params.clientOpId) {
        const existing = await tx.customerLedger.findUnique({ where: { clientOpId: params.clientOpId } });
        if (existing) {
          return {
            ...existing,
            type: existing.type as CustomerLedgerData["type"],
            amount: existing.amount.toFixed(2),
            referenceId: existing.referenceId ?? undefined,
            note: existing.note ?? undefined,
          };
        }
      }
      const customer = await tx.customer.findUnique({ where: { id: params.customerId } });
      if (!customer) throw new Error("Cliente no encontrado");
      const amount = new Decimal(params.amount);
      const current = new Decimal(customer.balance.toString());
      const balance = params.type === "VENTA"
        ? current.plus(amount.abs())
        : params.type === "ABONO" || params.type === "ANULACION"
          ? current.minus(amount.abs())
          : current.plus(amount);
      const entry = await tx.customerLedger.create({
        data: {
          customerId: customer.id,
          type: params.type,
          clientOpId: params.clientOpId,
          amount: amount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
          referenceId: params.referenceId,
          note: params.note,
          userId: params.userId,
        },
      });
      await tx.customer.update({
        where: { id: customer.id },
        data: { balance: balance.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2) },
      });
      await tx.auditLog.create({
        data: {
          userId: params.userId,
          action: "LEDGER_ENTRY",
          entity: "CUSTOMER",
          entityId: customer.id,
          afterState: { type: params.type, amount: params.amount, newBalance: balance.toFixed(2) },
        },
      });
      return {
        ...entry,
        type: entry.type as CustomerLedgerData["type"],
        amount: entry.amount.toFixed(2),
        referenceId: entry.referenceId ?? undefined,
        note: entry.note ?? undefined,
      };
    });
  }

  const customer = store.getCustomerById(params.customerId);
  if (!customer) {
    throw new Error("Cliente no encontrado");
  }

  const amountDec = new Decimal(params.amount);
  const currentBalanceDec = new Decimal(customer.balance);
  let newBalanceDec: Decimal;

  switch (params.type) {
    case "VENTA":
      newBalanceDec = currentBalanceDec.plus(amountDec.abs());
      break;
    case "ABONO":
    case "ANULACION":
      newBalanceDec = currentBalanceDec.minus(amountDec.abs());
      break;
    case "AJUSTE":
      newBalanceDec = currentBalanceDec.plus(amountDec);
      break;
  }

  const newBalanceStr = newBalanceDec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);

  const entry = store.recordCustomerLedgerEntry({
    customerId: customer.id,
    type: params.type,
    amount: amountDec.toFixed(2),
    referenceId: params.referenceId,
    note: params.note,
    userId: params.userId,
  });

  store.updateCustomerBalance(customer.id, newBalanceStr);

  await recordAudit({
    userId: params.userId,
    action: "LEDGER_ENTRY",
    entity: "CUSTOMER",
    entityId: customer.id,
    afterState: { type: params.type, amount: params.amount, newBalance: newBalanceStr },
  });

  return entry;
}

/**
 * Registra un pago/abono de un cliente para amortizar su deuda
 * Si el pago es en efectivo, impacta la caja registradora en la misma transacción lógica
 */
export async function registerCustomerPayment(params: RecordCustomerPaymentParams) {
  if (process.env.NODE_ENV !== "test") {
    const payment = new Decimal(params.amount);
    if (payment.isZero() || payment.isNegative()) throw new Error("El monto del abono debe ser mayor a cero");
    const paymentStr = payment.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
    return prisma.$transaction(async (tx) => {
      if (params.clientOpId) {
        const existing = await tx.customerLedger.findUnique({ where: { clientOpId: params.clientOpId } });
        if (existing) {
          const customer = await tx.customer.findUniqueOrThrow({ where: { id: existing.customerId } });
          return {
            ledgerEntry: {
              ...existing,
              type: existing.type as CustomerLedgerData["type"],
              amount: existing.amount.toFixed(2),
              referenceId: existing.referenceId ?? undefined,
              note: existing.note ?? undefined,
            },
            customer: {
              ...customer,
              balance: customer.balance.toFixed(2),
              creditLimit: customer.creditLimit.toFixed(2),
              status: customer.status as CustomerData["status"],
            },
          };
        }
      }
      const customer = await tx.customer.findUnique({ where: { id: params.customerId } });
      if (!customer) throw new Error("Cliente no encontrado");
      const entry = await tx.customerLedger.create({
        data: {
          customerId: customer.id,
          type: "ABONO",
          clientOpId: params.clientOpId,
          amount: `-${paymentStr}`,
          note: params.note || `Abono mediante ${params.paymentMethod}`,
          userId: params.userId,
        },
      });
      await tx.customer.update({
        where: { id: customer.id },
        data: { balance: new Decimal(customer.balance.toString()).minus(payment).toFixed(2) },
      });

      if (params.paymentMethod === "EFECTIVO") {
        const session = params.cashSessionId
          ? await tx.cashSession.findUnique({ where: { id: params.cashSessionId } })
          : await tx.cashSession.findFirst({ where: { status: "OPEN" } });
        if (session?.status === "OPEN") {
          const expected = new Decimal(session.expectedAmount.toString()).plus(payment);
          await tx.cashMovement.create({
            data: {
              cashSessionId: session.id,
              type: "ABONO_EFECTIVO",
              amount: paymentStr,
              reason: `Abono de cliente ${customer.name}`,
              userId: params.userId,
            },
          });
          await tx.cashSession.update({
            where: { id: session.id },
            data: { expectedAmount: expected.toFixed(2) },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          userId: params.userId,
          action: "LEDGER_ENTRY",
          entity: "CUSTOMER",
          entityId: customer.id,
          afterState: { type: "ABONO", amount: `-${paymentStr}` },
        },
      });
      return {
        ledgerEntry: {
          ...entry,
          type: "ABONO" as const,
          amount: entry.amount.toFixed(2),
          referenceId: entry.referenceId ?? undefined,
          note: entry.note ?? undefined,
        },
        customer: {
          ...customer,
          balance: new Decimal(customer.balance.toString()).minus(payment).toFixed(2),
          creditLimit: customer.creditLimit.toFixed(2),
          status: customer.status as CustomerData["status"],
        },
      };
    });
  }

  const customer = store.getCustomerById(params.customerId);
  if (!customer) {
    throw new Error("Cliente no encontrado");
  }

  const paymentDec = new Decimal(params.amount);
  if (paymentDec.isZero() || paymentDec.isNegative()) {
    throw new Error("El monto del abono debe ser mayor a cero");
  }

  const paymentStr = paymentDec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);

  // 1. Registrar movimiento en la cuenta corriente (- deuda)
  const ledgerEntry = await recordCustomerLedgerMovement({
    customerId: customer.id,
    type: "ABONO",
    amount: `-${paymentStr}`,
    note: params.note || `Abono mediante ${params.paymentMethod}`,
    userId: params.userId,
  });

  // 2. Si el abono es en EFECTIVO, ingresa a la caja
  if (params.paymentMethod === "EFECTIVO") {
    const session = params.cashSessionId
      ? store.getCashSessions().find((s) => s.id === params.cashSessionId)
      : store.getActiveCashSession();

    if (session && session.status === "OPEN") {
      await recordCashMovement({
        cashSessionId: session.id,
        type: "ABONO_EFECTIVO",
        amount: paymentStr,
        reason: `Abono de cliente ${customer.name}`,
        userId: params.userId,
      });
    }
  }

  return {
    ledgerEntry,
    customer: store.getCustomerById(customer.id),
  };
}

/**
 * Calcula la antigüedad de la deuda del cliente (aging report)
 */
export async function getCustomerAging(customerId: string) {
  if (process.env.NODE_ENV !== "test") {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: { ledger: true },
    });
    if (!customer) throw new Error("Cliente no encontrado");
    const now = Date.now();
    const buckets = [new Decimal(0), new Decimal(0), new Decimal(0), new Decimal(0)];
    for (const entry of customer.ledger) {
      if (entry.type !== "VENTA") continue;
      const days = Math.floor((now - entry.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      const index = days <= 0 ? 0 : days <= 30 ? 1 : days <= 60 ? 2 : 3;
      buckets[index] = buckets[index].plus(entry.amount.toString());
    }
    return {
      customerName: customer.name,
      totalBalance: customer.balance.toString(),
      creditLimit: customer.creditLimit.toString(),
      corriente: buckets[0].toFixed(2),
      d1a30: buckets[1].toFixed(2),
      d31a60: buckets[2].toFixed(2),
      d60plus: buckets[3].toFixed(2),
    };
  }

  const customer = store.getCustomerById(customerId);
  if (!customer) {
    throw new Error("Cliente no encontrado");
  }

  const ledger = store.getCustomerLedger(customer.id);
  const now = Date.now();

  let corriente = new Decimal(0);
  let d1a30 = new Decimal(0);
  let d31a60 = new Decimal(0);
  let d60plus = new Decimal(0);

  for (const entry of ledger) {
    if (entry.type === "VENTA") {
      const days = Math.floor((now - entry.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      const amt = new Decimal(entry.amount);

      if (days <= 0) {
        corriente = corriente.plus(amt);
      } else if (days <= 30) {
        d1a30 = d1a30.plus(amt);
      } else if (days <= 60) {
        d31a60 = d31a60.plus(amt);
      } else {
        d60plus = d60plus.plus(amt);
      }
    }
  }

  return {
    customerName: customer.name,
    totalBalance: customer.balance,
    creditLimit: customer.creditLimit,
    corriente: corriente.toFixed(2),
    d1a30: d1a30.toFixed(2),
    d31a60: d31a60.toFixed(2),
    d60plus: d60plus.toFixed(2),
  };
}
