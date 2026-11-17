import { NextResponse } from "next/server";
import { store } from "@/server/services/data-store";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const since = searchParams.get("since");

  const products = store.getProducts().map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    categoryId: p.categoryId,
    unit: p.unit,
    allowsDecimals: p.allowsDecimals,
    price: p.price,
    cost: p.cost,
    currentStock: p.currentStock,
    updatedAt: p.updatedAt.toISOString(),
  }));

  const customers = store.getCustomers().map((c) => ({
    id: c.id,
    name: c.name,
    documentId: c.documentId,
    phone: c.phone,
    creditLimit: c.creditLimit,
    balance: c.balance,
    status: c.status,
    updatedAt: c.createdAt.toISOString(),
  }));

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    products,
    customers,
  });
}
