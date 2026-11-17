import { NextResponse } from "next/server";
import { store } from "@/server/services/data-store";
import {
  openCashSession,
  recordCashMovement,
  closeCashSession,
  getCashSessionReport,
} from "@/server/services/cash.service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");

  const session = sessionId
    ? store.getCashSessions().find((s) => s.id === sessionId)
    : store.getActiveCashSession();

  if (!session) {
    return NextResponse.json({ active: false, session: null });
  }

  const report = await getCashSessionReport(session.id);
  const movements = store.getCashMovements(session.id);

  return NextResponse.json({
    active: session.status === "OPEN",
    report,
    movements,
    allSessions: store.getCashSessions(),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "OPEN") {
      const session = await openCashSession({
        userId: body.userId || "user-cajero-1",
        userName: body.userName || "Claudette Colbert (Cajera Principal)",
        openingAmount: body.openingAmount || "5000.00",
      });
      return NextResponse.json(session, { status: 201 });
    }

    if (action === "MOVEMENT") {
      const mov = await recordCashMovement({
        cashSessionId: body.cashSessionId,
        type: body.type,
        amount: body.amount,
        reason: body.reason,
        userId: body.userId || "user-cajero-1",
        authorizedBy: body.authorizedBy,
      });
      return NextResponse.json(mov, { status: 201 });
    }

    if (action === "CLOSE") {
      const closed = await closeCashSession({
        cashSessionId: body.cashSessionId,
        countedAmount: body.countedAmount,
        denominationCounts: body.denominationCounts,
        diffReason: body.diffReason,
        userId: body.userId || "user-cajero-1",
      });
      return NextResponse.json(closed);
    }

    return NextResponse.json({ error: `Acción inválida: ${action}` }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error en operación de caja";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
