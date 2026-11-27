import Decimal from "decimal.js";
import { DEFAULT_SALES_LOCATION_ID, store, SaleData, SaleLineData } from "./data-store";
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
import { prisma } from "@/lib/db";
import { checkCreditAvailability } from "@/lib/money";

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

function mapPersistedSale(
  sale: Awaited<ReturnType<typeof prisma.sale.findUniqueOrThrow>> & { lines: Array<{ id: string; saleId: string; productId: string; productName: string; quantity: import("@prisma/client").Prisma.Decimal; unitPrice: import("@prisma/client").Prisma.Decimal; lineTotal: import("@prisma/client").Prisma.Decimal }> },
  customerName?: string,
): SaleData {
  return {
    id: sale.id,
    number: sale.number,
    customerId: sale.customerId ?? undefined,
    customerName,
    paymentType: sale.paymentType as SaleData["paymentType"],
    total: sale.total.toFixed(2),
    status: sale.status as SaleData["status"],
    cashSessionId: sale.cashSessionId ?? undefined,
    clientOpId: sale.clientOpId ?? undefined,
    userId: sale.userId,
    voidReason: sale.voidReason ?? undefined,
    voidedBy: sale.voidedBy ?? undefined,
    voidedAt: sale.voidedAt ?? undefined,
    createdAt: sale.createdAt,
    lines: sale.lines.map((line) => ({
      id: line.id,
      saleId: line.saleId,
      productId: line.productId,
      productName: line.productName,
      quantity: line.quantity.toFixed(3),
      unitPrice: line.unitPrice.toFixed(4),
      lineTotal: line.lineTotal.toFixed(2),
    })),
  };
}

async function createPersistedSale(params: CreateSaleParams): Promise<SaleData> {
  if (!params.lines?.length) throw new Error("La venta debe contener al menos un producto");

  try {
    return await prisma.$transaction(async (tx) => {
      if (params.clientOpId) {
        const existing = await tx.sale.findUnique({
          where: { clientOpId: params.clientOpId },
          include: { lines: true, customer: true },
        });
        if (existing) return mapPersistedSale(existing, existing.customer?.name);
      }

      const items = await Promise.all(params.lines.map(async (item) => {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product) throw new Error(`Producto no encontrado: ${item.productId}`);
        if (product.status !== "ACTIVE") throw new Error(`El producto ${product.name} está inactivo.`);
        const price = item.unitPrice || product.price.toString();
        return {
          ...item,
          product,
          price: validateAndParsePrice(price).toFixed(4),
          quantity: validateAndParseQty(item.quantity, product.allowsDecimals).toFixed(3),
          lineTotal: calculateLineTotal(item.quantity, price, product.allowsDecimals),
        };
      }));
      const total = sumLineTotals(items.map((item) => item.lineTotal));

      const locationRequirements = new Map<string, { productName: string; unit: string; quantity: Decimal }>();
      for (const item of items) {
        const locationId = item.locationId || DEFAULT_SALES_LOCATION_ID;
        const key = `${item.product.id}:${locationId}`;
        const current = locationRequirements.get(key);
        locationRequirements.set(key, {
          productName: item.product.name,
          unit: item.product.unit,
          quantity: (current?.quantity ?? new Decimal(0)).plus(item.quantity),
        });
      }
      for (const [key, requirement] of locationRequirements) {
        const [productId, locationId] = key.split(":");
        const stock = await tx.stockByLocation.findUnique({
          where: { productId_locationId: { productId, locationId } },
        });
        const available = new Decimal(stock?.quantity.toString() ?? "0");
        if (requirement.quantity.greaterThan(available)) {
          const location = await tx.location.findUnique({
            where: { id: locationId },
            select: { name: true },
          });
          throw new Error(`Stock insuficiente en ${location?.name || "la ubicación de venta"} para ${requirement.productName}. Disponible: ${available.toFixed(3)} ${requirement.unit}, solicitado: ${requirement.quantity.toFixed(3)} ${requirement.unit}. Traslada existencias a esta ubicación antes de cobrar.`);
        }
      }
      const productRequirements = new Map<string, { productName: string; unit: string; quantity: Decimal; available: Decimal }>();
      for (const item of items) {
        const current = productRequirements.get(item.product.id);
        productRequirements.set(item.product.id, {
          productName: item.product.name,
          unit: item.product.unit,
          quantity: (current?.quantity ?? new Decimal(0)).plus(item.quantity),
          available: new Decimal(item.product.currentStock.toString()),
        });
      }
      for (const requirement of productRequirements.values()) {
        if (requirement.quantity.greaterThan(requirement.available)) {
          throw new Error(`Stock insuficiente para ${requirement.productName}. Disponible: ${requirement.available.toFixed(3)} ${requirement.unit}, solicitado: ${requirement.quantity.toFixed(3)} ${requirement.unit}`);
        }
      }

      let customer: Awaited<ReturnType<typeof tx.customer.findUnique>> = null;
      if (params.paymentType === "CREDITO") {
        if (!params.customerId) throw new Error("Una venta a crédito requiere especificar un cliente registrado");
        customer = await tx.customer.findUnique({ where: { id: params.customerId } });
        if (!customer) throw new Error("Cliente no encontrado para venta a crédito");
        if (customer.status === "INACTIVE") throw new Error("El cliente está inactivo y no puede realizar compras.");
        const check = checkCreditAvailability(customer.balance.toString(), customer.creditLimit.toString(), total);
        if ((customer.status === "BLOCKED" || !check.allowed) && !params.authorizedBy) {
          throw new Error(customer.status === "BLOCKED"
            ? "El cliente está BLOQUEADO por morosidad o límite excedido."
            : `La venta excede el límite de crédito en RD$ ${check.exceededAmount}. Requiere autorización de supervisor.`);
        }
      } else if (params.customerId) {
        customer = await tx.customer.findUnique({ where: { id: params.customerId } });
        if (customer?.status === "INACTIVE") throw new Error("El cliente está inactivo y no puede realizar compras.");
      }

      const counter = await tx.counter.upsert({
        where: { series: "SALES" },
        create: { series: "SALES", lastValue: 155 },
        update: { lastValue: { increment: 1 } },
      });
      const sale = await tx.sale.create({
        data: {
          number: counter.lastValue,
          customerId: customer?.id,
          paymentType: params.paymentType,
          total,
          clientOpId: params.clientOpId,
          userId: params.userId,
          lines: {
            create: items.map((item) => ({
              productId: item.product.id,
              productName: item.product.name,
              quantity: item.quantity,
              unitPrice: item.price,
              lineTotal: item.lineTotal,
            })),
          },
        },
        include: { lines: true },
      });

      for (const item of items) {
        const quantity = new Decimal(item.quantity);
        const productStockUpdate = await tx.product.updateMany({
          where: { id: item.product.id, currentStock: { gte: quantity } },
          data: { currentStock: { decrement: quantity } },
        });
        if (productStockUpdate.count === 0) {
          throw new Error(`Stock insuficiente para ${item.product.name}`);
        }

        const locationId = item.locationId || DEFAULT_SALES_LOCATION_ID;
        const locationStockUpdate = await tx.stockByLocation.updateMany({
          where: {
            productId: item.product.id,
            locationId,
            quantity: { gte: quantity },
          },
          data: { quantity: { decrement: quantity } },
        });
        if (locationStockUpdate.count === 0) {
          throw new Error(`Stock insuficiente en la ubicación para ${item.product.name}`);
        }
        await tx.inventoryMovement.create({
          data: {
            productId: item.product.id,
            fromLocationId: locationId,
            type: "SALIDA",
            quantity: item.quantity,
            referenceType: "SALE",
            referenceId: sale.id,
            reason: `Venta #${sale.number}`,
            userId: params.userId,
          },
        });
      }

      let cashSessionId = params.cashSessionId;
      if (params.paymentType === "CONTADO" && (!params.paymentMethod || params.paymentMethod === "EFECTIVO")) {
        const cashSession = cashSessionId
          ? await tx.cashSession.findUnique({ where: { id: cashSessionId } })
          : await tx.cashSession.findFirst({ where: { status: "OPEN" } });
        if (cashSession?.status === "OPEN") {
          cashSessionId = cashSession.id;
          await tx.cashMovement.create({
            data: {
              cashSessionId,
              type: "VENTA_EFECTIVO",
              amount: total,
              reason: `Venta en mostrador #${sale.number}`,
              userId: params.userId,
            },
          });
          await tx.cashSession.update({
            where: { id: cashSessionId },
            data: { expectedAmount: new Decimal(cashSession.expectedAmount.toString()).plus(total).toFixed(2) },
          });
        }
      } else if (params.paymentType === "CREDITO" && customer) {
        await tx.customerLedger.create({
          data: {
            customerId: customer.id,
            type: "VENTA",
            amount: total,
            referenceId: sale.id,
            note: `Cargo por Venta a Crédito #${sale.number}`,
            userId: params.userId,
          },
        });
        await tx.customer.update({
          where: { id: customer.id },
          data: { balance: new Decimal(customer.balance.toString()).plus(total).toFixed(2) },
        });
      }

      const savedSale = cashSessionId
        ? await tx.sale.update({ where: { id: sale.id }, data: { cashSessionId }, include: { lines: true } })
        : sale;

      await tx.auditLog.create({
        data: {
          userId: params.userId,
          action: "CREATE",
          entity: "SALE",
          entityId: sale.id,
          afterState: { number: sale.number, total, paymentType: params.paymentType },
          clientOpId: params.clientOpId,
          authorizedBy: params.authorizedBy,
        },
      });

      return mapPersistedSale(savedSale, customer?.name);
    });
  } catch (error) {
    if (params.clientOpId && error instanceof Error && "code" in error && error.code === "P2002") {
      const existing = await prisma.sale.findUnique({
        where: { clientOpId: params.clientOpId },
        include: { lines: true, customer: true },
      });
      if (existing) return mapPersistedSale(existing, existing.customer?.name);
    }
    throw error;
  }
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
  if (process.env.NODE_ENV !== "test") return createPersistedSale(params);

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
    if (product.status !== "ACTIVE") throw new Error(`El producto ${product.name} está inactivo.`);

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

  if (params.customerId) {
    const customer = store.getCustomerById(params.customerId);
    if (customer?.status === "INACTIVE") throw new Error("El cliente está inactivo y no puede realizar compras.");
  }

  const requestedByProduct = new Map<string, Decimal>();
  const requestedByLocation = new Map<string, Decimal>();
  for (const item of params.lines) {
    const quantity = validateAndParseQty(item.quantity);
    const locationId = item.locationId || DEFAULT_SALES_LOCATION_ID;
    const locationKey = `${item.productId}:${locationId}`;
    requestedByProduct.set(
      item.productId,
      (requestedByProduct.get(item.productId) || new Decimal(0)).plus(quantity),
    );
    requestedByLocation.set(
      locationKey,
      (requestedByLocation.get(locationKey) || new Decimal(0)).plus(quantity),
    );
  }
  for (const [productId, requested] of requestedByProduct) {
    const product = store.getProductById(productId);
    if (!product) continue;
    const available = new Decimal(product.currentStock);
    if (requested.greaterThan(available)) {
      throw new Error(`Stock insuficiente para ${product.name}. Disponible: ${available.toFixed(3)} ${product.unit}, solicitado: ${requested.toFixed(3)} ${product.unit}`);
    }
  }
  for (const [key, requested] of requestedByLocation) {
    const [productId, locationId] = key.split(":");
    const product = store.getProductById(productId);
    if (!product) continue;
    const available = new Decimal(store.getStockByLocation(productId, locationId)?.quantity || "0");
    if (requested.greaterThan(available)) {
      const locationName = store.getLocationById(locationId)?.name || "la ubicación de venta";
      throw new Error(`Stock insuficiente en ${locationName} para ${product.name}. Disponible: ${available.toFixed(3)} ${product.unit}, solicitado: ${requested.toFixed(3)} ${product.unit}. Traslada existencias a esta ubicación antes de cobrar.`);
    }
  }

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
      fromLocationId: item.locationId || DEFAULT_SALES_LOCATION_ID, // Mostrador por defecto
      type: "SALIDA",
      quantity: item.quantity,
      referenceType: "SALE",
      referenceId: sale.id,
      reason: `Venta #${sale.number}`,
      userId: params.userId,
      allowNegativeStock: false,
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
  if (process.env.NODE_ENV !== "test") {
    return prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id: params.saleId },
        include: { lines: true, customer: true },
      });
      if (!sale) throw new Error("Venta no encontrada");
      if (sale.status === "VOIDED") throw new Error(`La venta #${sale.number} ya fue anulada previamente`);
      if (!params.voidReason?.trim()) throw new Error("Debe proporcionar un motivo obligatorio para anular la venta");

      for (const line of sale.lines) {
        const product = await tx.product.findUniqueOrThrow({ where: { id: line.productId } });
        const quantity = new Decimal(line.quantity.toString());
        await tx.product.update({
          where: { id: product.id },
          data: { currentStock: new Decimal(product.currentStock.toString()).plus(quantity).toFixed(3) },
        });
        const stock = await tx.stockByLocation.findUnique({
          where: { productId_locationId: { productId: product.id, locationId: DEFAULT_SALES_LOCATION_ID } },
        });
        await tx.stockByLocation.upsert({
          where: { productId_locationId: { productId: product.id, locationId: DEFAULT_SALES_LOCATION_ID } },
          create: { productId: product.id, locationId: DEFAULT_SALES_LOCATION_ID, quantity: quantity.toFixed(3) },
          update: { quantity: new Decimal(stock?.quantity.toString() ?? "0").plus(quantity).toFixed(3) },
        });
        await tx.inventoryMovement.create({
          data: {
            productId: product.id,
            toLocationId: DEFAULT_SALES_LOCATION_ID,
            type: "DEVOLUCION",
            quantity: quantity.toFixed(3),
            referenceType: "VOID",
            referenceId: sale.id,
            reason: `Anulación de Venta #${sale.number}: ${params.voidReason}`,
            userId: params.voidedBy,
          },
        });
      }

      if (sale.paymentType === "CREDITO" && sale.customerId) {
        const customer = await tx.customer.findUniqueOrThrow({ where: { id: sale.customerId } });
        await tx.customerLedger.create({
          data: {
            customerId: customer.id,
            type: "ANULACION",
            amount: new Decimal(sale.total.toString()).negated().toFixed(2),
            referenceId: sale.id,
            note: `Reversión por Anulación de Venta #${sale.number}`,
            userId: params.voidedBy,
          },
        });
        await tx.customer.update({
          where: { id: customer.id },
          data: { balance: new Decimal(customer.balance.toString()).minus(sale.total.toString()).toFixed(2) },
        });
      }

      if (sale.paymentType === "CONTADO" && sale.cashSessionId) {
        const session = await tx.cashSession.findUnique({ where: { id: sale.cashSessionId } });
        if (session?.status === "OPEN") {
          await tx.cashMovement.create({
            data: {
              cashSessionId: session.id,
              type: "RETIRO_MANUAL",
              amount: sale.total.toString(),
              reason: `Reversión por anulación de Venta #${sale.number}: ${params.voidReason}`,
              userId: params.voidedBy,
              authorizedBy: params.voidedBy,
            },
          });
          await tx.cashSession.update({
            where: { id: session.id },
            data: { expectedAmount: new Decimal(session.expectedAmount.toString()).minus(sale.total.toString()).toFixed(2) },
          });
        }
      }

      const updated = await tx.sale.update({
        where: { id: sale.id },
        data: { status: "VOIDED", voidReason: params.voidReason, voidedBy: params.voidedBy, voidedAt: new Date() },
        include: { lines: true },
      });
      await tx.auditLog.create({
        data: {
          userId: params.voidedBy,
          action: "VOID",
          entity: "SALE",
          entityId: sale.id,
          afterState: { voidReason: params.voidReason, voidedAt: updated.voidedAt?.toISOString() },
        },
      });
      return mapPersistedSale(updated, sale.customer?.name);
    });
  }

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
      toLocationId: DEFAULT_SALES_LOCATION_ID,
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
