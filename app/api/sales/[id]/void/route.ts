import { NextResponse } from "next/server";
import { voidSale } from "@/server/services/sales.service";
import { requirePermission } from "@/server/services/auth.service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, "VENTAS.ANULAR");
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const body = await request.json();
    const result = await voidSale({
      saleId: id,
      voidReason: body.voidReason,
      voidedBy: auth.user.id,
    });
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al anular la venta";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
