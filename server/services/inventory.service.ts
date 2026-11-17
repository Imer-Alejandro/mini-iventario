import Decimal from "decimal.js";
import { store, InventoryMovementData, ProductData } from "./data-store";
import { validateAndParseQty } from "@/lib/money";
import { recordAudit } from "./audit.service";

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

/**
 * Registra un movimiento de inventario garantizando trazabilidad y actualización de stock
 */
export async function recordInventoryMovement(params: RecordMovementParams): Promise<InventoryMovementData> {
  const product = store.getProductById(params.productId);
  if (!product) {
    throw new Error(`Producto no encontrado: ${params.productId}`);
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
  const products = store.getProducts();
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
        currentStock: p.currentStock,
        minStock: p.minStock,
        targetStock: p.targetStock,
        suggestedQty: suggested.toFixed(3),
        autoPurchaseOrder: p.autoPurchaseOrder,
      });
    }
  }

  return alerts;
}
