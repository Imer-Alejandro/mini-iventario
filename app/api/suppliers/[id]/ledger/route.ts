import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/server/services/auth.service";
import { recordSupplierLedgerMovement } from "@/server/services/supplier.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePermission(request, "PROVEEDORES.LEER");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const [supplier, ledger] = await Promise.all([
    prisma.supplier.findUnique({ where: { id } }),
    prisma.supplierLedger.findMany({ where: { supplierId: id }, orderBy: { createdAt: "desc" } }),
  ]);
  if (!supplier) return NextResponse.json({ error: "Proveedor no encontrado." }, { status: 404 });
  return NextResponse.json({
    supplier: { ...supplier, balance: supplier.balance.toFixed(2) },
    ledger: ledger.map((entry) => ({
      ...entry,
      amount: entry.amount.toFixed(2),
    })),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const type = body.type === "PAGO" ? "PAGO" : body.type === "AJUSTE" ? "AJUSTE" : "FACTURA";
  const permission = type === "PAGO" ? "PROVEEDORES.PAGAR" : "PROVEEDORES.GESTIONAR";
  const auth = await requirePermission(request, permission);
  if (!auth.ok) return auth.response;
  try {
    const parsedBody = body as Record<string, unknown>;
    const entry = await recordSupplierLedgerMovement({
      supplierId: id,
      clientOpId: typeof parsedBody.clientOpId === "string" ? parsedBody.clientOpId : undefined,
      type,
      amount: String(parsedBody.amount || ""),
      referenceId: typeof parsedBody.referenceId === "string" ? parsedBody.referenceId : undefined,
      note: typeof parsedBody.note === "string" ? parsedBody.note : undefined,
      userId: auth.user.id,
      paymentMethod: parsedBody.paymentMethod === "EFECTIVO" ||
        parsedBody.paymentMethod === "TRANSFERENCIA" ||
        parsedBody.paymentMethod === "TARJETA"
        ? (parsedBody.paymentMethod as "EFECTIVO" | "TRANSFERENCIA" | "TARJETA")
        : undefined,
      cashSessionId: typeof parsedBody.cashSessionId === "string" ? parsedBody.cashSessionId : undefined,
    });
    const supplier = await prisma.supplier.findUnique({ where: { id } });
    return NextResponse.json({
      entry,
      supplier: supplier ? { ...supplier, balance: supplier.balance.toFixed(2) } : null,
    }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "No se pudo registrar el movimiento.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
