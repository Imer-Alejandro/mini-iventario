import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const [storedProducts, storedCustomers] = await Promise.all([
    prisma.product.findMany(),
    prisma.customer.findMany(),
  ]);
  const products = storedProducts.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    categoryId: p.categoryId,
    unit: p.unit,
    allowsDecimals: p.allowsDecimals,
    price: p.price.toFixed(4),
    cost: p.cost.toFixed(4),
    currentStock: p.currentStock.toFixed(3),
    updatedAt: p.updatedAt.toISOString(),
  }));

  const customers = storedCustomers.map((c) => ({
    id: c.id,
    name: c.name,
    documentId: c.documentId,
    phone: c.phone,
    creditLimit: c.creditLimit.toFixed(2),
    balance: c.balance.toFixed(2),
    status: c.status,
    updatedAt: c.createdAt.toISOString(),
  }));

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    products,
    customers,
  });
}
