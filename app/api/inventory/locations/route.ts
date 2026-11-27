import { NextResponse } from "next/server";
import Decimal from "decimal.js";
import { DEFAULT_SALES_LOCATION_ID, store } from "@/server/services/data-store";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/server/services/auth.service";

export async function GET(request: Request) {
  const auth = await requirePermission(request, "INVENTARIO.LEER");
  if (!auth.ok) return auth.response;
  const [locations, stockByLocation] = await Promise.all([
    prisma.location.findMany({ orderBy: { name: "asc" } }),
    prisma.stockByLocation.findMany(),
  ]);
  return NextResponse.json({
    locations,
    stockByLocation: stockByLocation.map((stock) => ({
      ...stock,
      quantity: stock.quantity.toFixed(3),
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requirePermission(request, "INVENTARIO.GESTIONAR");
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "El nombre de la ubicación es obligatorio." }, { status: 400 });
    }

    if (process.env.NODE_ENV === "test") {
      const duplicate = store.getLocations().some((location) => location.name.toLowerCase() === name.toLowerCase());
      if (duplicate) {
        return NextResponse.json({ error: "Ya existe una ubicación con ese nombre." }, { status: 409 });
      }
      return NextResponse.json(store.addLocation(name), { status: 201 });
    }

    const duplicate = (await prisma.location.findMany({ select: { name: true } }))
      .some((location) => location.name.toLowerCase() === name.toLowerCase());
    if (duplicate) {
      return NextResponse.json({ error: "Ya existe una ubicación con ese nombre." }, { status: 409 });
    }

    const location = await prisma.location.create({ data: { name, status: "ACTIVE" } });
    return NextResponse.json(location, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "No se pudo crear la ubicación.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  const auth = await requirePermission(request, "INVENTARIO.GESTIONAR");
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json();
    if (process.env.NODE_ENV === "test") {
      const testLocation = typeof body.id === "string" ? store.getLocationById(body.id) : undefined;
      if (!testLocation) {
        return NextResponse.json({ error: "No se encontró la ubicación." }, { status: 404 });
      }
      const testName = typeof body.name === "string" ? body.name.trim() : "";
      if (!testName) {
        return NextResponse.json({ error: "El nombre de la ubicación es obligatorio." }, { status: 400 });
      }
      if (body.status !== "ACTIVE" && body.status !== "INACTIVE") {
        return NextResponse.json({ error: "El estado de la ubicación no es válido." }, { status: 400 });
      }
      const duplicate = store.getLocations().some(
        (candidate) => candidate.id !== testLocation.id && candidate.name.toLowerCase() === testName.toLowerCase(),
      );
      if (duplicate) {
        return NextResponse.json({ error: "Ya existe una ubicación con ese nombre." }, { status: 409 });
      }
      if (body.status === "INACTIVE" && testLocation.id === DEFAULT_SALES_LOCATION_ID) {
        return NextResponse.json(
          { error: "La ubicación predeterminada de ventas no se puede desactivar." },
          { status: 409 },
        );
      }
      if (
        body.status === "INACTIVE" &&
        store.getStockByLocations().some(
          (stock) => stock.locationId === testLocation.id && !new Decimal(stock.quantity).isZero(),
        )
      ) {
        return NextResponse.json(
          { error: "No se puede desactivar una ubicación que todavía tiene existencias. Traslada el stock primero." },
          { status: 409 },
        );
      }
      return NextResponse.json(store.updateLocation(testLocation.id, { name: testName, status: body.status }));
    }

    const location = typeof body.id === "string"
      ? await prisma.location.findUnique({ where: { id: body.id } })
      : null;
    if (!location) {
      return NextResponse.json({ error: "No se encontró la ubicación." }, { status: 404 });
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "El nombre de la ubicación es obligatorio." }, { status: 400 });
    }
    if (body.status !== "ACTIVE" && body.status !== "INACTIVE") {
      return NextResponse.json({ error: "El estado de la ubicación no es válido." }, { status: 400 });
    }

    const duplicate = (await prisma.location.findMany({ select: { id: true, name: true } })).some(
      (candidate) => candidate.id !== location.id && candidate.name.toLowerCase() === name.toLowerCase(),
    );
    if (duplicate) {
      return NextResponse.json({ error: "Ya existe una ubicación con ese nombre." }, { status: 409 });
    }

    if (body.status === "INACTIVE" && location.id === DEFAULT_SALES_LOCATION_ID) {
      return NextResponse.json(
        { error: "La ubicación predeterminada de ventas no se puede desactivar." },
        { status: 409 },
      );
    }

    if (
      body.status === "INACTIVE" &&
      (await prisma.stockByLocation.findMany({ where: { locationId: location.id } }))
        .some((stock) => !new Decimal(stock.quantity.toString()).isZero())
    ) {
      return NextResponse.json(
        { error: "No se puede desactivar una ubicación que todavía tiene existencias. Traslada el stock primero." },
        { status: 409 },
      );
    }

    const updated = await prisma.location.update({
      where: { id: location.id },
      data: { name, status: body.status },
    });
    return NextResponse.json(updated);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "No se pudo actualizar la ubicación.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requirePermission(request, "INVENTARIO.GESTIONAR");
  if (!auth.ok) return auth.response;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Indica la ubicación que deseas archivar." }, { status: 400 });

  try {
    if (process.env.NODE_ENV === "test") {
      const location = store.getLocationById(id);
      if (!location) return NextResponse.json({ error: "No se encontró la ubicación." }, { status: 404 });
      if (location.id === DEFAULT_SALES_LOCATION_ID) {
        return NextResponse.json({ error: "La ubicación predeterminada de ventas no se puede archivar." }, { status: 409 });
      }
      if (store.getStockByLocations().some(
        (stock) => stock.locationId === id && !new Decimal(stock.quantity).isZero(),
      )) {
        return NextResponse.json(
          { error: "Esta ubicación todavía tiene existencias. Trasládalas antes de archivarla." },
          { status: 409 },
        );
      }
      if (location.status === "INACTIVE") return NextResponse.json({ status: "INACTIVE" });
      store.updateLocation(id, { status: "INACTIVE" });
      return NextResponse.json({ status: "INACTIVE" });
    }

    const result = await prisma.$transaction(async (tx) => {
      const location = await tx.location.findUnique({ where: { id } });
      if (!location) return { error: "No se encontró la ubicación.", statusCode: 404 };
      if (location.id === DEFAULT_SALES_LOCATION_ID) {
        return { error: "La ubicación predeterminada de ventas no se puede archivar.", statusCode: 409 };
      }
      if (location.status === "INACTIVE") return { status: "INACTIVE" };

      const stocks = await tx.stockByLocation.findMany({ where: { locationId: id } });
      if (stocks.some((stock) => !new Decimal(stock.quantity.toString()).isZero())) {
        return {
          error: "Esta ubicación todavía tiene existencias. Trasládalas antes de archivarla.",
          statusCode: 409,
        };
      }

      await tx.location.update({ where: { id }, data: { status: "INACTIVE" } });
      await tx.auditLog.create({
        data: {
          userId: auth.user.id,
          action: "DELETE",
          entity: "LOCATION",
          entityId: id,
          beforeState: { name: location.name, status: location.status },
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
    const message = error instanceof Error ? error.message : "No se pudo archivar la ubicación.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
