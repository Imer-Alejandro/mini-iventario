import { NextResponse } from "next/server";
import { getAuditLogs } from "@/server/services/audit.service";
import { requirePermission } from "@/server/services/auth.service";

export async function GET(request: Request) {
  const auth = await requirePermission(request, "AUDITORIA.LEER");
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(request.url);
  const entity = searchParams.get("entity") || undefined;
  const logs = await getAuditLogs(entity);
  return NextResponse.json(logs);
}
