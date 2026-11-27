import { NextResponse } from "next/server";
import Decimal from "decimal.js";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/server/services/auth.service";
import { validateAndParseAmount } from "@/lib/money";

export async function GET(request: Request) {
  const auth = await requirePermission(request, "CLIENTES.LEER");
  if (!auth.ok) return auth.response;
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
  const auth = await requirePermission(request, "CLIENTES.GESTIONAR");
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json();
    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "El nombre del cliente es obligatorio" }, { status: 400 });
    }
    if (body.status !== undefined && !["ACTIVE", "BLOCKED"].includes(body.status)) {
      return NextResponse.json({ error: "El estado del cliente no es válido" }, { status: 400 });
    }
    const creditLimit = validateAndParseAmount(String(body.creditLimit ?? "0.00"));

    const customer = await prisma.customer.create({
      data: {
        name: body.name.trim(),
        documentId: body.documentId?.trim() || null,
        phone: body.phone?.trim() || null,
        address: body.address?.trim() || null,
        creditLimit: creditLimit.toFixed(2),
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
  const auth = await requirePermission(request, "CLIENTES.GESTIONAR");
  if (!auth.ok) return auth.response;
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
    if (body.status !== undefined && !["ACTIVE", "BLOCKED", "INACTIVE"].includes(body.status)) {
      return NextResponse.json({ error: "El estado del cliente no es válido" }, { status: 400 });
    }
    const creditLimit = validateAndParseAmount(String(body.creditLimit ?? customer.creditLimit));
    const status = body.status ?? customer.status;
    if (status === "INACTIVE" && customer.status !== "INACTIVE") {
      return NextResponse.json({ error: "Usa la acción Eliminar para archivar el cliente de forma segura." }, { status: 409 });
    }
    if (status === "INACTIVE" && !new Decimal(customer.balance.toString()).isZero()) {
      return NextResponse.json({ error: "No se puede archivar un cliente con saldo pendiente." }, { status: 409 });
    }

    const updated = await prisma.customer.update({
      where: { id: customer.id },
      data: {
        name: body.name.trim(),
        documentId: body.documentId?.trim() || null,
        phone: body.phone?.trim() || null,
        address: body.address?.trim() || null,
        creditLimit: creditLimit.toFixed(2),
        status,
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

export async function DELETE(request: Request) {
  const auth = await requirePermission(request, "CLIENTES.GESTIONAR");
  if (!auth.ok) return auth.response;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Indica el cliente que deseas archivar." }, { status: 400 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({ where: { id } });
      if (!customer) return { error: "No se encontró el cliente.", statusCode: 404 };
      if (customer.status === "INACTIVE") return { status: "INACTIVE" };
      if (!new Decimal(customer.balance.toString()).isZero()) {
        return { error: "No se puede archivar un cliente con saldo pendiente.", statusCode: 409 };
      }

      await tx.customer.update({ where: { id }, data: { status: "INACTIVE" } });
      await tx.auditLog.create({
        data: {
          userId: auth.user.id,
          action: "DELETE",
          entity: "CUSTOMER",
          entityId: id,
          beforeState: { name: customer.name, status: customer.status },
          afterState: { status: "INACTIVE" },
        },
      });
      return { status: "INACTIVE" };
    });
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.statusCode });
    }
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "No se pudo archivar el cliente.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
