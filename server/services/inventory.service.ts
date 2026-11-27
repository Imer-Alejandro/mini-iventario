import Decimal from "decimal.js";
import { store, InventoryMovementData } from "./data-store";
import { validateAndParseQty } from "@/lib/money";
import { recordAudit } from "./audit.service";
import { prisma } from "@/lib/db";
import { Prisma, type InventoryMovement } from "@prisma/client";

export interface RecordMovementParams {
  productId: string;
  fromLocationId?: string;
  toLocationId?: string;
  type: "ENTRADA" | "SALIDA" | "TRASLADO" | "AJUSTE" | "MERMA" | "DEVOLUCION";
  quantity: string; // DECIMAL(14,3)
  unitCost?: string;
  referenceType?: string; // SALE, RECEIPT, ADJUSTMENT, MERMA, VOID
  referenceId?: string;
  reason?: string;
  clientOpId?: string;
  userId: string;
  authorizedBy?: string;
  allowNegativeStock?: boolean;
}

export interface MermaParams {
  productId: string;
  clientOpId?: string;
  locationId: string;
  quantity: string;
  reason: string; // e.g., "Desposte / Hueso", "Exceso de grasa", "Deshidratación cámara fría", "Caducidad"
  userId: string;
  authorizedBy?: string;
}

export interface StockAlertResult {
  productId: string;
  productCode: string;
  productName: string;
  currentStock: string;
  minStock: string;
  targetStock: string;
  suggestedQty: string;
  autoPurchaseOrder: boolean;
}

async function recordPersistedInventoryMovement(
  params: RecordMovementParams,
): Promise<InventoryMovementData> {
  const qtyDec = validateAndParseQty(params.quantity, true);
  if (qtyDec.isZero() || qtyDec.isNegative()) {
    throw new Error("La cantidad del movimiento debe ser un valor positivo mayor a cero");
  }

  const mapMovement = (movement: InventoryMovement): InventoryMovementData => ({
    ...movement,
    type: movement.type as InventoryMovementData["type"],
    quantity: movement.quantity.toFixed(3),
    unitCost: movement.unitCost?.toFixed(4),
    referenceType: movement.referenceType ?? undefined,
    fromLocationId: movement.fromLocationId ?? undefined,
    toLocationId: movement.toLocationId ?? undefined,
    referenceId: movement.referenceId ?? undefined,
    reason: movement.reason ?? undefined,
    clientOpId: movement.clientOpId ?? undefined,
    authorizedBy: movement.authorizedBy ?? undefined,
  });

  try {
    return await prisma.$transaction(async (tx) => {
    if (params.clientOpId) {
      const existing = await tx.inventoryMovement.findUnique({
        where: { clientOpId: params.clientOpId },
      });
      if (existing) return mapMovement(existing);
    }

    const product = await tx.product.findUnique({ where: { id: params.productId } });
    if (!product) throw new Error(`Producto no encontrado: ${params.productId}`);
    if (product.status !== "ACTIVE" && params.referenceType !== "VOID") {
      throw new Error(`El producto ${product.name} está inactivo.`);
    }

    const quantity = validateAndParseQty(params.quantity, product.allowsDecimals);
    if (quantity.isZero() || quantity.isNegative()) {
      throw new Error("La cantidad del movimiento debe ser un valor positivo mayor a cero");
    }

    if (params.type === "TRASLADO") {
      for (const locationId of [params.fromLocationId, params.toLocationId]) {
        if (!locationId) continue;
        const location = await tx.location.findUnique({ where: { id: locationId } });
        if (!location) throw new Error(`Ubicación no encontrada: ${locationId}`);
        if (location.status !== "ACTIVE") throw new Error(`La ubicación ${location.name} está inactiva`);
      }
    }

    const currentTotal = new Decimal(product.currentStock.toString());
    let newTotal: Decimal;

    switch (params.type) {
      case "ENTRADA":
      case "DEVOLUCION": {
        newTotal = currentTotal.plus(quantity);
        if (params.toLocationId) {
          const current = await tx.stockByLocation.findUnique({
            where: { productId_locationId: { productId: product.id, locationId: params.toLocationId } },
          });
          await tx.stockByLocation.upsert({
            where: { productId_locationId: { productId: product.id, locationId: params.toLocationId } },
            create: { productId: product.id, locationId: params.toLocationId, quantity: quantity.toFixed(3) },
            update: { quantity: new Decimal(current?.quantity.toString() ?? "0").plus(quantity).toFixed(3) },
          });
        }
        break;
      }
      case "SALIDA":
      case "MERMA": {
        newTotal = currentTotal.minus(quantity);
        if (newTotal.isNegative() && !params.allowNegativeStock) {
          throw new Error(`Stock insuficiente para ${product.name}. Stock actual: ${product.currentStock} ${product.unit}, solicitado: ${params.quantity} ${product.unit}`);
        }
        if (params.fromLocationId) {
          const current = await tx.stockByLocation.findUnique({
            where: { productId_locationId: { productId: product.id, locationId: params.fromLocationId } },
          });
          const currentQuantity = new Decimal(current?.quantity.toString() ?? "0");
          if (currentQuantity.minus(quantity).isNegative() && !params.allowNegativeStock) {
            throw new Error("Stock insuficiente en la ubicación de origen");
          }
          await tx.stockByLocation.upsert({
            where: { productId_locationId: { productId: product.id, locationId: params.fromLocationId } },
            create: { productId: product.id, locationId: params.fromLocationId, quantity: quantity.negated().toFixed(3) },
            update: { quantity: currentQuantity.minus(quantity).toFixed(3) },
          });
        }
        break;
      }
      case "TRASLADO": {
        if (!params.fromLocationId || !params.toLocationId) {
          throw new Error("Un traslado requiere ubicación de origen y destino");
        }
        if (params.fromLocationId === params.toLocationId) {
          throw new Error("La ubicación de origen y destino no pueden ser la misma");
        }
        const [from, to] = await Promise.all([
          tx.stockByLocation.findUnique({
            where: { productId_locationId: { productId: product.id, locationId: params.fromLocationId } },
          }),
          tx.stockByLocation.findUnique({
            where: { productId_locationId: { productId: product.id, locationId: params.toLocationId } },
          }),
        ]);
        const fromQuantity = new Decimal(from?.quantity.toString() ?? "0");
        const toQuantity = new Decimal(to?.quantity.toString() ?? "0");
        if (fromQuantity.minus(quantity).isNegative() && !params.allowNegativeStock) {
          throw new Error("Stock insuficiente en la ubicación de origen");
        }
        await tx.stockByLocation.upsert({
          where: { productId_locationId: { productId: product.id, locationId: params.fromLocationId } },
          create: { productId: product.id, locationId: params.fromLocationId, quantity: quantity.negated().toFixed(3) },
          update: { quantity: fromQuantity.minus(quantity).toFixed(3) },
        });
        await tx.stockByLocation.upsert({
          where: { productId_locationId: { productId: product.id, locationId: params.toLocationId } },
          create: { productId: product.id, locationId: params.toLocationId, quantity: quantity.toFixed(3) },
          update: { quantity: toQuantity.plus(quantity).toFixed(3) },
        });
        newTotal = currentTotal;
        break;
      }
      case "AJUSTE":
        if (!params.reason?.trim()) throw new Error("Los ajustes de inventario exigen un motivo obligatorio");
        newTotal = quantity;
        break;
      default:
        throw new Error(`Tipo de movimiento no soportado: ${params.type}`);
    }

    await tx.product.update({
      where: { id: product.id },
      data: { currentStock: newTotal.toFixed(3) },
    });

    const movement = await tx.inventoryMovement.create({
      data: {
        productId: product.id,
        fromLocationId: params.fromLocationId,
        toLocationId: params.toLocationId,
        type: params.type,
        quantity: quantity.toFixed(3),
        unitCost: params.unitCost,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        reason: params.reason,
        clientOpId: params.clientOpId,
        userId: params.userId,
        authorizedBy: params.authorizedBy,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: params.userId,
        action: "INVENTORY_MOVEMENT",
        entity: "INVENTORY",
        entityId: product.id,
        afterState: { type: params.type, qty: params.quantity, newTotal: newTotal.toFixed(3) },
        clientOpId: params.clientOpId,
        authorizedBy: params.authorizedBy,
      },
    });

    return mapMovement(movement);
    });
  } catch (error) {
    if (params.clientOpId && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.inventoryMovement.findUnique({
        where: { clientOpId: params.clientOpId },
      });
      if (existing) return mapMovement(existing);
    }
    throw error;
  }
}

/**
 * Registra un movimiento de inventario garantizando trazabilidad y actualización de stock
 */
export async function recordInventoryMovement(params: RecordMovementParams): Promise<InventoryMovementData> {
  if (process.env.NODE_ENV !== "test") return recordPersistedInventoryMovement(params);

  const product = store.getProductById(params.productId);
  if (!product) {
    throw new Error(`Producto no encontrado: ${params.productId}`);
  }
  if (product.status !== "ACTIVE" && params.referenceType !== "VOID") {
    throw new Error(`El producto ${product.name} está inactivo.`);
  }

  if (params.type === "TRASLADO") {
    for (const locationId of [params.fromLocationId, params.toLocationId]) {
      if (!locationId) continue;
      const location = store.getLocationById(locationId);
      if (!location) {
        throw new Error(`Ubicación no encontrada: ${locationId}`);
      }
      if (location.status !== "ACTIVE") {
        throw new Error(`La ubicación ${location.name} está inactiva`);
      }
    }
  }

  // Validar cantidad decimal según las reglas del producto
  const qtyDec = validateAndParseQty(params.quantity, product.allowsDecimals);
  if (qtyDec.isZero() || qtyDec.isNegative()) {
    throw new Error("La cantidad del movimiento debe ser un valor positivo mayor a cero");
  }

  const currentTotal = new Decimal(product.currentStock);
  let newTotal: Decimal;

  // Manejar el stock por ubicación y el total del producto
  switch (params.type) {
    case "ENTRADA":
    case "DEVOLUCION": {
      newTotal = currentTotal.plus(qtyDec);
      if (params.toLocationId) {
        const locStock = store.getStockByLocation(product.id, params.toLocationId);
        const curLocQty = locStock ? new Decimal(locStock.quantity) : new Decimal(0);
        store.setStockByLocation(product.id, params.toLocationId, curLocQty.plus(qtyDec).toFixed(3));
      }
      break;
    }

    case "SALIDA":
    case "MERMA": {
      newTotal = currentTotal.minus(qtyDec);
      if (newTotal.isNegative() && !params.allowNegativeStock) {
        throw new Error(`Stock insuficiente para ${product.name}. Stock actual: ${product.currentStock} ${product.unit}, solicitado: ${params.quantity} ${product.unit}`);
      }

      if (params.fromLocationId) {
        const locStock = store.getStockByLocation(product.id, params.fromLocationId);
        const curLocQty = locStock ? new Decimal(locStock.quantity) : new Decimal(0);
        store.setStockByLocation(product.id, params.fromLocationId, curLocQty.minus(qtyDec).toFixed(3));
      }
      break;
    }

    case "TRASLADO": {
      if (!params.fromLocationId || !params.toLocationId) {
        throw new Error("Un traslado requiere ubicación de origen y destino");
      }
      if (params.fromLocationId === params.toLocationId) {
        throw new Error("La ubicación de origen y destino no pueden ser la misma");
      }

      const fromStock = store.getStockByLocation(product.id, params.fromLocationId);
      const curFromQty = fromStock ? new Decimal(fromStock.quantity) : new Decimal(0);
      if (curFromQty.minus(qtyDec).isNegative() && !params.allowNegativeStock) {
        throw new Error(`Stock insuficiente en la ubicación de origen`);
      }

      const toStock = store.getStockByLocation(product.id, params.toLocationId);
      const curToQty = toStock ? new Decimal(toStock.quantity) : new Decimal(0);

      store.setStockByLocation(product.id, params.fromLocationId, curFromQty.minus(qtyDec).toFixed(3));
      store.setStockByLocation(product.id, params.toLocationId, curToQty.plus(qtyDec).toFixed(3));

      // El total general del producto se mantiene igual en un traslado entre ubicaciones
      newTotal = currentTotal;
      break;
    }

    case "AJUSTE": {
      if (!params.reason?.trim()) {
        throw new Error("Los ajustes de inventario exigen un motivo obligatorio");
      }
      // Ajuste con cantidad especificada directamente
      newTotal = qtyDec;
      break;
    }

    default:
      throw new Error(`Tipo de movimiento no soportado: ${params.type}`);
  }

  // Actualizar stock total del producto en caché
  store.updateProductStock(product.id, newTotal.toFixed(3));

  const mov = store.recordInventoryMovement({
    productId: product.id,
    fromLocationId: params.fromLocationId,
    toLocationId: params.toLocationId,
    type: params.type,
    quantity: qtyDec.toFixed(3),
    unitCost: params.unitCost,
    referenceType: params.referenceType,
    referenceId: params.referenceId,
    reason: params.reason,
    clientOpId: params.clientOpId,
    userId: params.userId,
    authorizedBy: params.authorizedBy,
  });

  await recordAudit({
    userId: params.userId,
    action: "INVENTORY_MOVEMENT",
    entity: "INVENTORY",
    entityId: product.id,
    afterState: { type: params.type, qty: params.quantity, newTotal: newTotal.toFixed(3) },
    clientOpId: params.clientOpId,
    authorizedBy: params.authorizedBy,
  });

  return mov;
}

/**
 * Registra una pérdida o merma (desposte, recorte, deshidratación) específica de carnicería
 */
export async function recordMerma(params: MermaParams): Promise<InventoryMovementData> {
  if (!params.reason?.trim()) {
    throw new Error("Debe especificar la causa o motivo de la merma");
  }

  return recordInventoryMovement({
    productId: params.productId,
    clientOpId: params.clientOpId,
    fromLocationId: params.locationId,
    type: "MERMA",
    quantity: params.quantity,
    reason: params.reason,
    referenceType: "MERMA",
    userId: params.userId,
    authorizedBy: params.authorizedBy,
    allowNegativeStock: true,
  });
}

/**
 * Verifica alertas de stock bajo y calcula las cantidades sugeridas de reposición
 */
export async function getStockAlerts(): Promise<StockAlertResult[]> {
  const products =
    process.env.NODE_ENV === "test"
      ? store.getProducts()
      : await prisma.product.findMany();
  const alerts: StockAlertResult[] = [];

  for (const p of products) {
    const curStock = new Decimal(p.currentStock);
    const minStock = new Decimal(p.minStock);
    const targetStock = new Decimal(p.targetStock);

    if (curStock.lessThanOrEqualTo(minStock)) {
      // cantidad_sugerida = stock_objetivo - stock_actual
      const suggested = Decimal.max(0, targetStock.minus(curStock));

      alerts.push({
        productId: p.id,
        productCode: p.code,
        productName: p.name,
        currentStock: curStock.toFixed(3),
        minStock: minStock.toFixed(3),
        targetStock: targetStock.toFixed(3),
        suggestedQty: suggested.toFixed(3),
        autoPurchaseOrder: p.autoPurchaseOrder,
      });
    }
  }

  return alerts;
}
