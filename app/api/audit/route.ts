import { NextResponse } from "next/server";
import { getAuditLogs } from "@/server/services/audit.service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const entity = searchParams.get("entity") || undefined;
  const logs = await getAuditLogs(entity);
  return NextResponse.json(logs);
}
