import { NextResponse } from "next/server";
import { createSale } from "@/server/services/sales.service";
import { registerCustomerPayment } from "@/server/services/credit.service";
import { recordCashMovement } from "@/server/services/cash.service";
import { recordMerma } from "@/server/services/inventory.service";
import { type PermissionCode, requirePermission } from "@/server/services/auth.service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { clientOpId, type, payload } = body;

    if (!clientOpId) {
      return NextResponse.json({ error: "clientOpId es obligatorio para idempotencia" }, { status: 400 });
    }

    const requiredPermissions: Record<string, PermissionCode> = {
      SALE: "VENTAS.CREAR",
      CUSTOMER_PAYMENT: "CREDITO.COBRAR",
      CASH_MOVEMENT: "CAJA.OPERAR",
      MERMA: "INVENTARIO.GESTIONAR",
    };
    const requiredPermission = requiredPermissions[type];
    if (!requiredPermission) {
      return NextResponse.json({ error: `Tipo de operación desconocida: ${type}` }, { status: 400 });
    }
    const auth = await requirePermission(request, requiredPermission);
    if (!auth.ok) return auth.response;

    let result: unknown;

    switch (type) {
      case "SALE": {
        result = await createSale({
          ...payload,
          clientOpId,
          userId: auth.user.id,
          authorizedBy: auth.user.permissions.includes("CREDITO.EXCEDER_LIMITE") ? auth.user.id : undefined,
        });
        break;
      }

      case "CUSTOMER_PAYMENT": {
        result = await registerCustomerPayment({
          ...payload,
          clientOpId,
          userId: auth.user.id,
        });
        break;
      }

      case "CASH_MOVEMENT": {
        result = await recordCashMovement({
          ...payload,
          clientOpId,
          userId: auth.user.id,
          authorizedBy: auth.user.permissions.includes("CAJA.AUTORIZAR_RETIROS") ? auth.user.id : undefined,
        });
        break;
      }

      case "MERMA": {
        result = await recordMerma({
          ...payload,
          clientOpId,
          userId: auth.user.id,
        });
        break;
      }

      default:
        return NextResponse.json({ error: `Tipo de operación desconocida: ${type}` }, { status: 400 });
    }

    return NextResponse.json({
      status: "CONFIRMED",
      clientOpId,
      result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error procesando operación";
    return NextResponse.json(
      {
        status: "RECHAZADA",
        error: message,
      },
      { status: 422 }
    );
  }
}
