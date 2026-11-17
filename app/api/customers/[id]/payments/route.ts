import { NextResponse } from "next/server";
import { registerCustomerPayment } from "@/server/services/credit.service";
import { store } from "@/server/services/data-store";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ledger = store.getCustomerLedger(id);
  const customer = store.getCustomerById(id);
  return NextResponse.json({ customer, ledger });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const result = await registerCustomerPayment({
      customerId: id,
      amount: body.amount,
      paymentMethod: body.paymentMethod || "EFECTIVO",
      cashSessionId: body.cashSessionId,
      note: body.note,
      userId: body.userId || "user-cajero-1",
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error registrando abono";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
