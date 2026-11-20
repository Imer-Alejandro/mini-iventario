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
  if (process.env.NODE_ENV === "test") {
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

  return {
    ...record,
    entityId: record.entityId ?? undefined,
    clientOpId: record.clientOpId ?? undefined,
    authorizedBy: record.authorizedBy ?? undefined,
    ipAddress: record.ipAddress ?? undefined,
  };
}


export async function getAuditLogs(entity?: string) {
  if (process.env.NODE_ENV === "test") {
    const logs = store.getAuditLogs();
    return entity ? logs.filter((log) => log.entity === entity) : logs;
  }

  return prisma.auditLog.findMany({
      where: entity ? { entity } : undefined,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
}
