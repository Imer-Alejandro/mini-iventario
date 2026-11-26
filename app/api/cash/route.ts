import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  openCashSession,
  recordCashMovement,
  closeCashSession,
  getCashSessionReport,
} from "@/server/services/cash.service";
import { requirePermission } from "@/server/services/auth.service";

export async function GET(request: Request) {
  const auth = await requirePermission(request, "CAJA.LEER");
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");

  const session = sessionId
    ? await prisma.cashSession.findUnique({ where: { id: sessionId } })
    : await prisma.cashSession.findFirst({ where: { status: "OPEN" } });

  if (!session) {
    return NextResponse.json({ active: false, session: null });
  }

  const report = await getCashSessionReport(session.id);
  const [movements, allSessions] = await Promise.all([
    prisma.cashMovement.findMany({ where: { cashSessionId: session.id }, orderBy: { createdAt: "desc" } }),
    prisma.cashSession.findMany({ orderBy: { openedAt: "desc" } }),
  ]);

  return NextResponse.json({
    active: session.status === "OPEN",
    report,
    movements: movements.map((movement) => ({
      ...movement,
      amount: movement.amount.toFixed(2),
    })),
    allSessions: allSessions.map((cashSession) => ({
      ...cashSession,
      openingAmount: cashSession.openingAmount.toFixed(2),
      expectedAmount: cashSession.expectedAmount.toFixed(2),
      countedAmount: cashSession.countedAmount?.toFixed(2) ?? null,
      difference: cashSession.difference?.toFixed(2) ?? null,
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requirePermission(request, "CAJA.OPERAR");
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "OPEN") {
      const session = await openCashSession({
        userId: auth.user.id,
        userName: auth.user.name,
        openingAmount: body.openingAmount || "5000.00",
      });
      return NextResponse.json(session, { status: 201 });
    }

    if (action === "MOVEMENT") {
      const mov = await recordCashMovement({
        cashSessionId: body.cashSessionId,
        clientOpId: body.clientOpId,
        type: body.type,
        amount: body.amount,
        reason: body.reason,
        userId: auth.user.id,
        authorizedBy: auth.user.permissions.includes("CAJA.AUTORIZAR_RETIROS") ? auth.user.id : undefined,
      });
      return NextResponse.json(mov, { status: 201 });
    }

    if (action === "CLOSE") {
      const closed = await closeCashSession({
        cashSessionId: body.cashSessionId,
        countedAmount: body.countedAmount,
        denominationCounts: body.denominationCounts,
        diffReason: body.diffReason,
        userId: auth.user.id,
      });
      return NextResponse.json(closed);
    }

    return NextResponse.json({ error: `Acción inválida: ${action}` }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error en operación de caja";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
