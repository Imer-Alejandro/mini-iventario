import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSale } from "@/server/services/sales.service";

export async function GET() {
  const sales = await prisma.sale.findMany({
    include: { lines: true, customer: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(sales.map(({ customer, ...sale }) => ({
    ...sale,
    total: sale.total.toFixed(2),
    customerName: customer?.name,
    lines: sale.lines.map((line) => ({
      ...line,
      quantity: line.quantity.toFixed(3),
      unitPrice: line.unitPrice.toFixed(4),
      lineTotal: line.lineTotal.toFixed(2),
    })),
  })));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sale = await createSale(body);
    return NextResponse.json(sale, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error procesando la venta";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
