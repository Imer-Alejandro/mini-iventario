import Decimal from "decimal.js";
import { prisma } from "@/lib/db";
import { validateAndParseAmount } from "@/lib/money";

export interface SupplierLedgerParams {
  supplierId: string;
  clientOpId?: string;
  type: "FACTURA" | "PAGO" | "AJUSTE";
  amount: string;
  referenceId?: string;
  note?: string;
  userId: string;
  paymentMethod?: "EFECTIVO" | "TRANSFERENCIA" | "TARJETA";
  cashSessionId?: string;
}

export async function registerSupplierCharge(params: Omit<SupplierLedgerParams, "type"> & { amount: string }) {
  return recordSupplierLedgerMovement({ ...params, type: "FACTURA" });
}

export async function registerSupplierPayment(params: Omit<SupplierLedgerParams, "type"> & { amount: string }) {
  return recordSupplierLedgerMovement({ ...params, type: "PAGO" });
}

export async function recordSupplierLedgerMovement(params: SupplierLedgerParams) {
  const amount = validateAndParseAmount(params.amount);
  if (amount.isZero() || amount.isNegative()) {
    throw new Error("El monto debe ser un número positivo mayor que cero");
  }
  const amountStr = amount.toFixed(2);

  return prisma.$transaction(async (tx) => {
    if (params.clientOpId) {
      const existing = await tx.supplierLedger.findUnique({
        where: { clientOpId: params.clientOpId },
      });
      if (existing) {
        return {
          id: existing.id,
          supplierId: existing.supplierId,
          type: existing.type,
          amount: existing.amount.toFixed(2),
          referenceId: existing.referenceId,
          note: existing.note,
          userId: existing.userId,
          createdAt: existing.createdAt,
        };
      }
    }

    const supplier = await tx.supplier.findUnique({ where: { id: params.supplierId } });
    if (!supplier) throw new Error("Proveedor no encontrado");
    if (supplier.status !== "ACTIVE") throw new Error("No se pueden registrar movimientos en un proveedor inactivo");

    const signedAmount = params.type === "PAGO"
      ? amount.negated()
      : params.type === "FACTURA"
        ? amount
        : amount;
    const currentBalance = new Decimal(supplier.balance.toString());
    const nextBalance = currentBalance.plus(signedAmount);
    if (nextBalance.isNegative()) {
      throw new Error("El pago supera el saldo pendiente del proveedor");
    }
    let availableSession: Awaited<ReturnType<typeof tx.cashSession.findUnique>> = null;
    if (params.type === "PAGO" && params.paymentMethod === "EFECTIVO") {
      if (!params.cashSessionId) throw new Error("El pago en efectivo requiere una caja abierta");
      availableSession = await tx.cashSession.findUnique({ where: { id: params.cashSessionId } });
      if (!availableSession || availableSession.status !== "OPEN") {
        throw new Error("El pago en efectivo requiere una caja abierta");
      }
      if (new Decimal(availableSession.expectedAmount.toString()).minus(amount).isNegative()) {
        throw new Error("El pago supera el efectivo disponible en caja");
      }
    }

    const entry = await tx.supplierLedger.create({
      data: {
        supplierId: supplier.id,
        type: params.type,
        amount: amountStr,
        clientOpId: params.clientOpId,
        referenceId: params.referenceId,
        note: params.note,
        userId: params.userId,
      },
    });
    await tx.supplier.update({
      where: { id: supplier.id },
      data: { balance: nextBalance.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2) },
    });

    if (params.type === "PAGO" && params.paymentMethod === "EFECTIVO" && availableSession) {
      const available = new Decimal(availableSession.expectedAmount.toString());
      await tx.cashMovement.create({
        data: {
          cashSessionId: availableSession.id,
          type: "RETIRO_MANUAL",
          amount: amountStr,
          reason: `Pago a proveedor ${supplier.name}${params.referenceId ? ` · Ref. ${params.referenceId}` : ""}`,
          userId: params.userId,
        },
      });
      await tx.cashSession.update({
        where: { id: availableSession.id },
        data: { expectedAmount: available.minus(amount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2) },
      });
    }

    await tx.auditLog.create({
      data: {
        userId: params.userId,
        action: params.type === "PAGO" ? "PAYMENT" : "UPDATE",
        entity: "SUPPLIER",
        entityId: supplier.id,
        afterState: {
          type: params.type,
          amount: amountStr,
          referenceId: params.referenceId,
          newBalance: nextBalance.toFixed(2),
        },
        clientOpId: params.clientOpId,
      },
    });

    return {
      id: entry.id,
      supplierId: entry.supplierId,
      type: entry.type,
      amount: entry.amount.toFixed(2),
      referenceId: entry.referenceId,
      note: entry.note,
      userId: entry.userId,
      createdAt: entry.createdAt,
      supplierBalance: nextBalance.toFixed(2),
    };
  });
}
