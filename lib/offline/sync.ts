import { localDB, OutboxOperation, LocalProduct, LocalCustomer, JsonValue } from "./db";
import { generateClientOpId } from "./client-op-id";

export { generateClientOpId } from "./client-op-id";

export interface SyncStatus {
  isOnline: boolean;
  pendingCount: number;
  rejectedCount: number;
  lastSyncAt: string | null;
  isSyncing: boolean;
}

/**
 * Encola una operación en el Outbox para ejecución inmediata o cuando vuelva la conexión
 */
export async function enqueueOutboxOperation(params: {
  type: "SALE" | "CUSTOMER_PAYMENT" | "CASH_MOVEMENT" | "MERMA";
  payload: Record<string, JsonValue>;
  clientOpId?: string;
  localSaleNumber?: string;
}): Promise<OutboxOperation> {
  const clientOpId = params.clientOpId || generateClientOpId();

  const op: OutboxOperation = {
    clientOpId,
    type: params.type,
    payload: {
      ...params.payload,
      clientOpId,
    },
    status: "PENDIENTE",
    localSaleNumber: params.localSaleNumber,
    createdAt: new Date().toISOString(),
  };

  try {
    const id = await localDB.outbox.add(op);
    op.id = id;
  } catch {
    // Si corre en Node/SSR sin IndexedDB
  }

  return op;
}

/**
 * Envía las operaciones pendientes del Outbox a la API central
 */
export async function pushOutbox(
  apiPushEndpoint = "/api/sync/push",
  fetcher: typeof fetch = fetch
): Promise<{ processed: number; succeeded: number; failed: number }> {
  let pending: OutboxOperation[] = [];

  try {
    pending = await localDB.outbox
      .where("status")
      .equals("PENDIENTE")
      .toArray();
  } catch {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  if (pending.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  let succeeded = 0;
  let failed = 0;

  for (const op of pending) {
    try {
      await localDB.outbox.update(op.id!, { status: "SINCRONIZANDO" });

      const response = await fetcher(apiPushEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(op),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Error HTTP ${response.status}`);
      }

      const result = await response.json() as { status?: string; clientOpId?: string; error?: string };
      if (result.status !== "CONFIRMED" || result.clientOpId !== op.clientOpId) {
        throw new Error(result.error || "El servidor no confirmó la operación enviada.");
      }
      await localDB.outbox.update(op.id!, {
        status: "CONFIRMADA",
        syncedAt: new Date().toISOString(),
      });
      succeeded++;
    } catch (error: unknown) {
      await localDB.outbox.update(op.id!, {
        status: "RECHAZADA",
        error: error instanceof Error ? error.message : "Error al sincronizar con el servidor central",
      });
      failed++;
    }
  }

  return { processed: pending.length, succeeded, failed };
}

/**
 * Descarga las actualizaciones del catálogo y clientes desde el último sync
 */
export async function pullCatalog(
  apiPullEndpoint = "/api/sync/pull",
  fetcher: typeof fetch = fetch
): Promise<{ productsCount: number; customersCount: number }> {
  try {
    const lastSync = await localDB.syncMeta.get("last_sync_at");
    const since = lastSync ? lastSync.value : "1970-01-01T00:00:00.000Z";

    const response = await fetcher(`${apiPullEndpoint}?since=${encodeURIComponent(since)}`);
    if (!response.ok) throw new Error("Fallo al descargar actualizaciones");

    const data = await response.json();

    if (data.products && Array.isArray(data.products)) {
      await localDB.products.bulkPut(data.products);
    }

    if (data.customers && Array.isArray(data.customers)) {
      await localDB.customers.bulkPut(data.customers);
    }

    await localDB.syncMeta.put({ key: "last_sync_at", value: new Date().toISOString() });

    return {
      productsCount: data.products?.length || 0,
      customersCount: data.customers?.length || 0,
    };
  } catch {
    return { productsCount: 0, customersCount: 0 };
  }
}
