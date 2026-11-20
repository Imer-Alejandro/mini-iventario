import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { InventoryMovementData } from "@/server/services/data-store";
import { recordInventoryMovement, recordMerma } from "@/server/services/inventory.service";

export async function GET() {
  const movements = await prisma.inventoryMovement.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(movements.map((movement) => ({
    ...movement,
    quantity: movement.quantity.toFixed(3),
    unitCost: movement.unitCost?.toFixed(4) ?? null,
  })));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let result: InventoryMovementData;

    if (body.type === "MERMA") {
      result = await recordMerma({
        productId: body.productId,
        clientOpId: body.clientOpId,
        locationId: body.locationId || "loc-003",
        quantity: body.quantity,
        reason: body.reason,
        userId: body.userId || "user-cajero-1",
        authorizedBy: body.authorizedBy,
      });
    } else {
      result = await recordInventoryMovement({
        productId: body.productId,
        clientOpId: body.clientOpId,
        fromLocationId: body.fromLocationId,
        toLocationId: body.toLocationId,
        type: body.type,
        quantity: body.quantity,
        unitCost: body.unitCost,
        reason: body.reason,
        userId: body.userId || "user-cajero-1",
        authorizedBy: body.authorizedBy,
      });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error registrando movimiento de stock";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
