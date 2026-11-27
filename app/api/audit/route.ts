import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuditLogs } from "@/server/services/audit.service";
import { requirePermission } from "@/server/services/auth.service";

export async function GET(request: Request) {
  const auth = await requirePermission(request, "AUDITORIA.LEER");
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(request.url);
  const entity = searchParams.get("entity") || undefined;
  const logs = await getAuditLogs(entity);
  const userIds = [...new Set(logs.flatMap((log) =>
    [log.userId, log.authorizedBy].filter((id): id is string => typeof id === "string"),
  ))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  });
  const namesById = new Map(users.map((user) => [user.id, user.name]));

  return NextResponse.json(logs.map((log) => ({
    ...log,
    userName: namesById.get(log.userId),
    authorizedByName: log.authorizedBy ? namesById.get(log.authorizedBy) : undefined,
  })));
}
