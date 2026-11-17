import Decimal from "decimal.js";
import { store, SaleData, SaleLineData } from "./data-store";
import {
  calculateLineTotal,
  sumLineTotals,
  validateAndParseQty,
  validateAndParsePrice,
} from "@/lib/money";
import { recordAudit } from "./audit.service";
import { recordCashMovement } from "./cash.service";
import { recordCustomerLedgerMovement, checkCustomerCredit } from "./credit.service";
import { recordInventoryMovement } from "./inventory.service";

export interface SaleItemInput {
  productId: string;
  quantity: string; // DECIMAL(14,3)
  unitPrice?: string; // Si se omite, usa el precio del producto
  locationId?: string; // Ubicación de donde sale la carne
}

export interface CreateSaleParams {
  customerId?: string;
  paymentType: "CONTADO" | "CREDITO";
  paymentMethod?: "EFECTIVO" | "TARJETA";
  lines: SaleItemInput[];
  cashSessionId?: string;
  userId: string;
  clientOpId?: string; // UUID v4 para idempotencia offline
  authorizedBy?: string; // Supervisor PIN si excede límite de crédito
}

export interface VoidSaleParams {
  saleId: string;
  voidReason: string;
  voidedBy: string;
  supervisorPin?: string;
}

/**
 * Registra una venta garantizando:
 * 1. Aritmética decimal exacta (ROUND_HALF_UP)
 * 2. Idempotencia con clientOpId
 * 3. Número consecutivo oficial sin saltos
 * 4. Descuento de inventario
 * 5. Registro en caja (si es contado/efectivo) o cuenta corriente (si es crédito)
 */
export async function createSale(params: CreateSaleParams): Promise<SaleData> {
  // 1. Idempotencia: Si ya se procesó esta operación offline, retornarla sin duplicar
  if (params.clientOpId) {
    const existing = store.getSaleByClientOpId(params.clientOpId);
    if (existing) {
      return existing;
    }
  }

  if (!params.lines || params.lines.length === 0) {
    throw new Error("La venta debe contener al menos un producto");
  }

  // 2. Procesar y calcular cada línea de venta con exactitud decimal
  const calculatedLines: SaleLineData[] = [];
  const lineTotalStrings: string[] = [];

  for (const item of params.lines) {
    const product = store.getProductById(item.productId);
    if (!product) {
      throw new Error(`Producto no encontrado: ${item.productId}`);
    }

    const price = item.unitPrice || product.price;
    const lineTotal = calculateLineTotal(item.quantity, price, product.allowsDecimals);

    calculatedLines.push({
      id: `line-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      saleId: "", // se asigna luego
      productId: product.id,
      productName: product.name,
      quantity: validateAndParseQty(item.quantity, product.allowsDecimals).toFixed(3),
      unitPrice: validateAndParsePrice(price).toFixed(4),
      lineTotal,
    });

    lineTotalStrings.push(lineTotal);
  }

  // total = Σ line_total (suma de líneas ya redondeadas)
  const totalAmount = sumLineTotals(lineTotalStrings);

  // 3. Validación de crédito si la venta es a crédito
  let customerName: string | undefined = undefined;
  if (params.paymentType === "CREDITO") {
    if (!params.customerId) {
      throw new Error("Una venta a crédito requiere especificar un cliente registrado");
    }

    const customer = store.getCustomerById(params.customerId);
    if (!customer) {
      throw new Error("Cliente no encontrado para venta a crédito");
    }
    customerName = customer.name;

    const creditCheck = await checkCustomerCredit(customer.id, totalAmount, !!params.authorizedBy);
    if (!creditCheck.allowed && !params.authorizedBy) {
      throw new Error(creditCheck.reason || "Límite de crédito excedido. Requiere autorización de supervisor.");
    }
  }

  // 4. Consecutivo oficial
  const saleNumber = store.getNextSaleNumber();
  const saleId = `sale-${Date.now()}-${saleNumber}`;

  calculatedLines.forEach((l) => (l.saleId = saleId));

  const sale: SaleData = {
    id: saleId,
    number: saleNumber,
    customerId: params.customerId,
    customerName,
    paymentType: params.paymentType,
    total: totalAmount,
    status: "CONFIRMED",
    cashSessionId: params.cashSessionId,
    clientOpId: params.clientOpId,
    userId: params.userId,
    createdAt: new Date(),
    lines: calculatedLines,
  };

  store.createSale(sale);

  // 5. Descontar inventario para cada producto vendido
  for (const item of params.lines) {
    await recordInventoryMovement({
      productId: item.productId,
      fromLocationId: item.locationId || "loc-003", // Mostrador por defecto
      type: "SALIDA",
      quantity: item.quantity,
      referenceType: "SALE",
      referenceId: sale.id,
      reason: `Venta #${sale.number}`,
      userId: params.userId,
      allowNegativeStock: true, // No frena la venta si hay desbalance transitorio
    });
  }

  // 6. Impactar Caja o Cuenta Corriente según el método de pago
  if (params.paymentType === "CONTADO" && (!params.paymentMethod || params.paymentMethod === "EFECTIVO")) {
    const cashSession = params.cashSessionId
      ? store.getCashSessions().find((s) => s.id === params.cashSessionId)
      : store.getActiveCashSession();

    if (cashSession && cashSession.status === "OPEN") {
      await recordCashMovement({
        cashSessionId: cashSession.id,
        type: "VENTA_EFECTIVO",
        amount: totalAmount,
        reason: `Venta en mostrador #${sale.number}`,
        userId: params.userId,
      });
      sale.cashSessionId = cashSession.id;
    }
  } else if (params.paymentType === "CREDITO" && params.customerId) {
    await recordCustomerLedgerMovement({
      customerId: params.customerId,
      type: "VENTA",
      amount: totalAmount,
      referenceId: sale.id,
      note: `Cargo por Venta a Crédito #${sale.number}`,
      userId: params.userId,
    });
  }

  // 7. Auditoría
  await recordAudit({
    userId: params.userId,
    action: "CREATE",
    entity: "SALE",
    entityId: sale.id,
    afterState: { number: sale.number, total: sale.total, paymentType: sale.paymentType },
    clientOpId: params.clientOpId,
    authorizedBy: params.authorizedBy,
  });

  return sale;
}

/**
 * Anula una venta confirmada.
 * Principio: Una venta NUNCA se borra de la base de datos.
 * Se crea un contra-movimiento para revertir stock, caja o crédito.
 */
export async function voidSale(params: VoidSaleParams): Promise<SaleData> {
  const sale = store.getSaleById(params.saleId);
  if (!sale) {
    throw new Error("Venta no encontrada");
  }

  if (sale.status === "VOIDED") {
    throw new Error(`La venta #${sale.number} ya fue anulada previamente`);
  }

  if (!params.voidReason?.trim()) {
    throw new Error("Debe proporcionar un motivo obligatorio para anular la venta");
  }

  // 1. Revertir inventario: Devolver productos al stock (movimiento DEVOLUCION)
  for (const line of sale.lines) {
    await recordInventoryMovement({
      productId: line.productId,
      toLocationId: "loc-003",
      type: "DEVOLUCION",
      quantity: line.quantity,
      referenceType: "VOID",
      referenceId: sale.id,
      reason: `Anulación de Venta #${sale.number}: ${params.voidReason}`,
      userId: params.voidedBy,
    });
  }

  // 2. Revertir saldo de cliente si fue a crédito
  if (sale.paymentType === "CREDITO" && sale.customerId) {
    await recordCustomerLedgerMovement({
      customerId: sale.customerId,
      type: "ANULACION",
      amount: `-${sale.total}`,
      referenceId: sale.id,
      note: `Reversión por Anulación de Venta #${sale.number}`,
      userId: params.voidedBy,
    });
  }

  // 3. Revertir caja si fue al contado en efectivo
  if (sale.paymentType === "CONTADO" && sale.cashSessionId) {
    const cashSession = store.getCashSessions().find((s) => s.id === sale.cashSessionId);
    if (cashSession && cashSession.status === "OPEN") {
      await recordCashMovement({
        cashSessionId: cashSession.id,
        type: "RETIRO_MANUAL",
        amount: sale.total,
        reason: `Reversión por anulación de Venta #${sale.number}: ${params.voidReason}`,
        userId: params.voidedBy,
        authorizedBy: params.voidedBy,
      });
    }
  }

  // 4. Marcar la venta como VOIDED
  store.updateSale(sale.id, {
    status: "VOIDED",
    voidReason: params.voidReason,
    voidedBy: params.voidedBy,
    voidedAt: new Date(),
  });

  await recordAudit({
    userId: params.voidedBy,
    action: "VOID",
    entity: "SALE",
    entityId: sale.id,
    afterState: { voidReason: params.voidReason, voidedAt: new Date().toISOString() },
  });

  return store.getSaleById(sale.id)!;
}
