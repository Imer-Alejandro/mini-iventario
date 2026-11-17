import { NextResponse } from "next/server";
import { store } from "@/server/services/data-store";

export async function GET() {
  const customers = store.getCustomers().map((c) => {
    const ledger = store.getCustomerLedger(c.id);
    return {
      ...c,
      ledgerCount: ledger.length,
    };
  });
  return NextResponse.json(customers);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "El nombre del cliente es obligatorio" }, { status: 400 });
    }

    const customer = store.addCustomer({
      name: body.name.trim(),
      documentId: body.documentId?.trim() || undefined,
      phone: body.phone?.trim() || undefined,
      address: body.address?.trim() || undefined,
      creditLimit: String(body.creditLimit || "0.00"),
      status: body.status === "BLOCKED" ? "BLOCKED" : "ACTIVE",
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al registrar cliente";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const customer = store.getCustomerById(body.id);
    if (!customer) {
      return NextResponse.json({ error: "No se encontró el cliente" }, { status: 404 });
    }
    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "El nombre del cliente es obligatorio" }, { status: 400 });
    }

    const updated = store.updateCustomer(customer.id, {
      name: body.name.trim(),
      documentId: body.documentId?.trim() || undefined,
      phone: body.phone?.trim() || undefined,
      address: body.address?.trim() || undefined,
      creditLimit: String(body.creditLimit ?? customer.creditLimit),
      status: body.status === "BLOCKED" ? "BLOCKED" : "ACTIVE",
    });

    return NextResponse.json(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al actualizar cliente";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
