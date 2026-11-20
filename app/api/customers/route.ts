import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const customers = await prisma.customer.findMany({
    include: { _count: { select: { ledger: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(customers.map(({ _count, ...customer }) => ({
    ...customer,
    creditLimit: customer.creditLimit.toFixed(2),
    balance: customer.balance.toFixed(2),
    ledgerCount: _count.ledger,
  })));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "El nombre del cliente es obligatorio" }, { status: 400 });
    }

    const customer = await prisma.customer.create({
      data: {
        name: body.name.trim(),
        documentId: body.documentId?.trim() || null,
        phone: body.phone?.trim() || null,
        address: body.address?.trim() || null,
        creditLimit: String(body.creditLimit || "0.00"),
        status: body.status === "BLOCKED" ? "BLOCKED" : "ACTIVE",
      },
    });

    return NextResponse.json({
      ...customer,
      creditLimit: customer.creditLimit.toFixed(2),
      balance: customer.balance.toFixed(2),
    }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al registrar cliente";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const customer = typeof body.id === "string"
      ? await prisma.customer.findUnique({ where: { id: body.id } })
      : null;
    if (!customer) {
      return NextResponse.json({ error: "No se encontró el cliente" }, { status: 404 });
    }
    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "El nombre del cliente es obligatorio" }, { status: 400 });
    }

    const updated = await prisma.customer.update({
      where: { id: customer.id },
      data: {
        name: body.name.trim(),
        documentId: body.documentId?.trim() || null,
        phone: body.phone?.trim() || null,
        address: body.address?.trim() || null,
        creditLimit: String(body.creditLimit ?? customer.creditLimit),
        status: body.status === "BLOCKED" ? "BLOCKED" : "ACTIVE",
      },
    });

    return NextResponse.json({
      ...updated,
      creditLimit: updated.creditLimit.toFixed(2),
      balance: updated.balance.toFixed(2),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al actualizar cliente";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
