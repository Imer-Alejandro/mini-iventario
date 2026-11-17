import Decimal from "decimal.js";
import { store, CustomerData, CustomerLedgerData } from "./data-store";
import { checkCreditAvailability } from "@/lib/money";
import { recordAudit } from "./audit.service";
import { recordCashMovement } from "./cash.service";

export interface RecordCustomerPaymentParams {
  customerId: string;
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
  type: "VENTA" | "ABONO" | "AJUSTE" | "ANULACION";
  amount: string; // Venta (+), Abono (-), Anulación (-)
  referenceId?: string;
  note?: string;
  userId: string;
}): Promise<CustomerLedgerData> {
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
