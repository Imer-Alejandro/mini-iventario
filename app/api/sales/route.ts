import { NextResponse } from "next/server";
import { store } from "@/server/services/data-store";
import { createSale } from "@/server/services/sales.service";

export async function GET() {
  const sales = store.getSales();
  return NextResponse.json(sales);
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
