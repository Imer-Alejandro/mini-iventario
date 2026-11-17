import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { store, AuditLogData } from "./data-store";

export interface CreateAuditLogParams {
  userId: string;
  action: string; // CREATE, UPDATE, VOID, APPROVE, LOGIN, CASH_CLOSE
  entity: string; // SALE, INVENTORY, CASH, CUSTOMER
  entityId?: string;
  beforeState?: Prisma.InputJsonObject;
  afterState?: Prisma.InputJsonObject;
  ipAddress?: string;
  clientOpId?: string;
  authorizedBy?: string;
}

/**
 * Servicio de auditoría inmutable
 * Registra cada operación sensible conforme a la sección 16 del documento técnico.
 */
export async function recordAudit(params: CreateAuditLogParams): Promise<AuditLogData> {
  // En entorno con base de datos activa se persiste en Prisma
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("localhost:26257") && process.env.NODE_ENV !== "test") {
    try {
      const record = await prisma.auditLog.create({
        data: {
          userId: params.userId,
          action: params.action,
          entity: params.entity,
          entityId: params.entityId,
          beforeState: params.beforeState ?? undefined,
          afterState: params.afterState ?? undefined,
          ipAddress: params.ipAddress ?? undefined,
          clientOpId: params.clientOpId ?? undefined,
          authorizedBy: params.authorizedBy ?? undefined,
        },
      });

      const mapped: AuditLogData = {
        id: record.id,
        userId: record.userId,
        action: record.action,
        entity: record.entity,
        entityId: record.entityId ?? undefined,
        beforeState: record.beforeState,
        afterState: record.afterState,
        ipAddress: record.ipAddress ?? undefined,
        clientOpId: record.clientOpId ?? undefined,
        authorizedBy: record.authorizedBy ?? undefined,
        createdAt: record.createdAt,
      };
      store.recordAuditLog(mapped);
      return mapped;
    } catch {
      // fallback a store
    }
  }

  // Fallback seguro a store en memoria
  return store.recordAuditLog({
    userId: params.userId,
    action: params.action,
    entity: params.entity,
    entityId: params.entityId,
    beforeState: params.beforeState,
    afterState: params.afterState,
    ipAddress: params.ipAddress,
    clientOpId: params.clientOpId,
    authorizedBy: params.authorizedBy,
  });
}


export async function getAuditLogs(entity?: string) {
  try {
    const logs = await prisma.auditLog.findMany({
      where: entity ? { entity } : undefined,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return logs;
  } catch {
    const logs = store.getAuditLogs();
    return entity ? logs.filter((l) => l.entity === entity) : logs;
  }
}
