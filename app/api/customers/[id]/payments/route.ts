import { NextResponse } from "next/server";
import { registerCustomerPayment } from "@/server/services/credit.service";
import { prisma } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const [ledger, customer] = await Promise.all([
    prisma.customerLedger.findMany({ where: { customerId: id }, orderBy: { createdAt: "desc" } }),
    prisma.customer.findUnique({ where: { id } }),
  ]);
  return NextResponse.json({
    customer: customer && {
      ...customer,
      creditLimit: customer.creditLimit.toFixed(2),
      balance: customer.balance.toFixed(2),
    },
    ledger: ledger.map((entry) => ({
      ...entry,
      amount: entry.amount.toFixed(2),
    })),
  });
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
      clientOpId: body.clientOpId,
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
