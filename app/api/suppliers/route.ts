import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/server/services/auth.service";

const PAYMENT_TERMS = new Set([
  "CONTADO",
  "CREDITO_7_DIAS",
  "CREDITO_15_DIAS",
  "CREDITO_30_DIAS",
  "CREDITO_45_DIAS",
  "CREDITO_60_DIAS",
  "CREDITO_90_DIAS",
]);

function readPaymentTerms(value: unknown) {
  if (typeof value !== "string" || !PAYMENT_TERMS.has(value)) return null;
  return value;
}

export async function GET(request: Request) {
  const auth = await requirePermission(request, "PROVEEDORES.LEER");
  if (!auth.ok) return auth.response;
  const suppliers = await prisma.supplier.findMany({
    include: { _count: { select: { ledger: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(suppliers.map(({ _count, ...supplier }) => ({
    ...supplier,
    balance: supplier.balance.toFixed(2),
    ledgerCount: _count.ledger,
  })));
}

export async function POST(request: Request) {
  const auth = await requirePermission(request, "PROVEEDORES.GESTIONAR");
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length < 2) {
      return NextResponse.json({ error: "El nombre del proveedor es obligatorio." }, { status: 400 });
    }
    const paymentTerms = readPaymentTerms(body.paymentTerms);
    if (!paymentTerms) {
      return NextResponse.json({ error: "Selecciona condiciones de pago válidas." }, { status: 400 });
    }
    const supplier = await prisma.supplier.create({
      data: {
        name,
        rnc: typeof body.rnc === "string" ? body.rnc.trim() || null : null,
        phone: typeof body.phone === "string" ? body.phone.trim() || null : null,
        address: typeof body.address === "string" ? body.address.trim() || null : null,
        contact: typeof body.contact === "string" ? body.contact.trim() || null : null,
        paymentTerms,
        status: body.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
      },
    });
    await prisma.auditLog.create({
      data: {
        userId: auth.user.id,
        action: "CREATE",
        entity: "SUPPLIER",
        entityId: supplier.id,
        afterState: { name, rnc: supplier.rnc, status: supplier.status },
      },
    });
    return NextResponse.json({ ...supplier, balance: supplier.balance.toFixed(2) }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "No se pudo crear el proveedor.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  const auth = await requirePermission(request, "PROVEEDORES.GESTIONAR");
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json();
    const id = typeof body.id === "string" ? body.id : "";
    const existing = id ? await prisma.supplier.findUnique({ where: { id } }) : null;
    if (!existing) return NextResponse.json({ error: "Proveedor no encontrado." }, { status: 404 });
    const name = typeof body.name === "string" ? body.name.trim() : existing.name;
    if (name.length < 2) {
      return NextResponse.json({ error: "El nombre del proveedor es obligatorio." }, { status: 400 });
    }
    const paymentTerms = readPaymentTerms(body.paymentTerms);
    if (!paymentTerms) {
      return NextResponse.json({ error: "Selecciona condiciones de pago válidas." }, { status: 400 });
    }
    const status = body.status === "INACTIVE" ? "INACTIVE" : "ACTIVE";
    const updated = await prisma.supplier.update({
      where: { id },
      data: {
        name,
        rnc: typeof body.rnc === "string" ? body.rnc.trim() || null : existing.rnc,
        phone: typeof body.phone === "string" ? body.phone.trim() || null : existing.phone,
        address: typeof body.address === "string" ? body.address.trim() || null : existing.address,
        contact: typeof body.contact === "string" ? body.contact.trim() || null : existing.contact,
        paymentTerms,
        status,
      },
    });
    await prisma.auditLog.create({
      data: {
        userId: auth.user.id,
        action: "UPDATE",
        entity: "SUPPLIER",
        entityId: id,
        afterState: { name, status },
      },
    });
    return NextResponse.json({ ...updated, balance: updated.balance.toFixed(2) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "No se pudo actualizar el proveedor.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
