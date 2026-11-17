import { NextResponse } from "next/server";
import { voidSale } from "@/server/services/sales.service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const result = await voidSale({
      saleId: id,
      voidReason: body.voidReason,
      voidedBy: body.voidedBy || "user-supervisor-1",
      supervisorPin: body.supervisorPin,
    });
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al anular la venta";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
