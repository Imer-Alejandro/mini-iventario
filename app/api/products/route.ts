import { NextResponse } from "next/server";
import Decimal from "decimal.js";
import { prisma } from "@/lib/db";
import { getStockAlerts } from "@/server/services/inventory.service";
import { requirePermission } from "@/server/services/auth.service";
import { DEFAULT_SALES_LOCATION_ID } from "@/server/services/data-store";

export async function GET(request: Request) {
  const auth = await requirePermission(request, "INVENTARIO.LEER");
  if (!auth.ok) return auth.response;
  const [products, categories, locations, stockByLocation] = await Promise.all([
    prisma.product.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.location.findMany({ orderBy: { name: "asc" } }),
    prisma.stockByLocation.findMany(),
  ]);
  const alerts = await getStockAlerts();

  return NextResponse.json({
    products: products.map((product) => ({
      ...product,
      price: product.price.toFixed(4),
      cost: product.cost.toFixed(4),
      minStock: product.minStock.toFixed(3),
      targetStock: product.targetStock.toFixed(3),
      currentStock: product.currentStock.toFixed(3),
    })),
    categories,
    locations,
    salesLocationId: DEFAULT_SALES_LOCATION_ID,
    stockByLocation: stockByLocation.map((stock) => ({
      ...stock,
      quantity: stock.quantity.toFixed(3),
    })),
    alerts,
  });
}

export async function POST(request: Request) {
  const auth = await requirePermission(request, "INVENTARIO.GESTIONAR");
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json();
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "El nombre del producto es obligatorio" }, { status: 400 });
    }
    if (!body.code?.trim()) {
      return NextResponse.json({ error: "El código del producto es obligatorio" }, { status: 400 });
    }

    const newProd = await prisma.product.create({
      data: {
        code: body.code.trim().toUpperCase(),
        name: body.name.trim(),
        categoryId: body.categoryId || "cat-res",
        unit: body.unit || "kg",
        allowsDecimals: body.allowsDecimals !== false,
        price: body.price || "0.0000",
        cost: body.cost || "0.0000",
        minStock: body.minStock || "10.000",
        targetStock: body.targetStock || "30.000",
        autoPurchaseOrder: Boolean(body.autoPurchaseOrder),
        status: "ACTIVE",
        currentStock: body.initialStock || "0.000",
        iconId: body.iconId || "carne",
      },
    });

    return NextResponse.json({
      ...newProd,
      price: newProd.price.toFixed(4),
      cost: newProd.cost.toFixed(4),
      minStock: newProd.minStock.toFixed(3),
      targetStock: newProd.targetStock.toFixed(3),
      currentStock: newProd.currentStock.toFixed(3),
    }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al registrar producto";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  const auth = await requirePermission(request, "INVENTARIO.GESTIONAR");
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json();
    const product = typeof body.id === "string"
      ? await prisma.product.findUnique({ where: { id: body.id } })
      : null;
    if (!product) {
      return NextResponse.json({ error: "No se encontró el producto" }, { status: 404 });
    }
    if (!body.name?.trim() || !body.code?.trim()) {
      return NextResponse.json({ error: "El nombre y el código son obligatorios" }, { status: 400 });
    }
    if (body.status !== undefined && body.status !== "ACTIVE" && body.status !== "INACTIVE") {
      return NextResponse.json({ error: "El estado del producto no es válido" }, { status: 400 });
    }
    if (body.status === "INACTIVE" && product.status !== "INACTIVE") {
      return NextResponse.json({ error: "Usa la acción Eliminar para archivar el producto de forma segura." }, { status: 409 });
    }
    const code = body.code.trim().toUpperCase();
    const duplicate = await prisma.product.findUnique({ where: { code } });
    if (duplicate && duplicate.id !== product.id) {
      return NextResponse.json({ error: "Ya existe un producto con ese código" }, { status: 400 });
    }

    const updated = await prisma.product.update({
      where: { id: product.id },
      data: {
        code,
        name: body.name.trim(),
        categoryId: body.categoryId ?? product.categoryId,
        unit: body.unit || "kg",
        allowsDecimals: body.allowsDecimals !== false,
        price: String(body.price ?? product.price),
        cost: String(body.cost ?? product.cost),
        minStock: String(body.minStock ?? product.minStock),
        targetStock: String(body.targetStock ?? product.targetStock),
        autoPurchaseOrder: Boolean(body.autoPurchaseOrder),
        iconId: body.iconId || "carne",
        status: body.status ?? product.status,
      },
    });

    return NextResponse.json({
      ...updated,
      price: updated.price.toFixed(4),
      cost: updated.cost.toFixed(4),
      minStock: updated.minStock.toFixed(3),
      targetStock: updated.targetStock.toFixed(3),
      currentStock: updated.currentStock.toFixed(3),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al actualizar producto";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requirePermission(request, "INVENTARIO.GESTIONAR");
  if (!auth.ok) return auth.response;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Indica el producto que deseas archivar." }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id } });
      if (!product) return { error: "No se encontró el producto.", statusCode: 404 };
      if (product.status === "INACTIVE") return { status: "INACTIVE" };

      const stockByLocation = await tx.stockByLocation.findMany({ where: { productId: id } });
      const hasStock = !new Decimal(product.currentStock.toString()).isZero()
        || stockByLocation.some((stock) => !new Decimal(stock.quantity.toString()).isZero());
      if (hasStock) {
        return {
          error: "No se puede archivar un producto con existencias. Ajusta o traslada el inventario primero.",
          statusCode: 409,
        };
      }

      await tx.product.update({ where: { id }, data: { status: "INACTIVE" } });
      await tx.auditLog.create({
        data: {
          userId: auth.user.id,
          action: "DELETE",
          entity: "PRODUCT",
          entityId: id,
          beforeState: { name: product.name, code: product.code, status: product.status },
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
    const message = error instanceof Error ? error.message : "No se pudo archivar el producto.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
