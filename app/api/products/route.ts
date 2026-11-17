import { NextResponse } from "next/server";
import { store } from "@/server/services/data-store";
import { getStockAlerts } from "@/server/services/inventory.service";

export async function GET() {
  const products = store.getProducts();
  const categories = store.getCategories();
  const locations = store.getLocations();
  const alerts = await getStockAlerts();

  return NextResponse.json({
    products,
    categories,
    locations,
    alerts,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "El nombre del producto es obligatorio" }, { status: 400 });
    }
    if (!body.code?.trim()) {
      return NextResponse.json({ error: "El código del producto es obligatorio" }, { status: 400 });
    }

    const newProd = store.addProduct({
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
      iconId: body.iconId || "beef-cut",
    });

    return NextResponse.json(newProd, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al registrar producto";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const product = store.getProductById(body.id);
    if (!product) {
      return NextResponse.json({ error: "No se encontró el producto" }, { status: 404 });
    }
    if (!body.name?.trim() || !body.code?.trim()) {
      return NextResponse.json({ error: "El nombre y el código son obligatorios" }, { status: 400 });
    }
    const code = body.code.trim().toUpperCase();
    const duplicate = store.getProductByCode(code);
    if (duplicate && duplicate.id !== product.id) {
      return NextResponse.json({ error: "Ya existe un producto con ese código" }, { status: 400 });
    }

    const updated = store.updateProduct(product.id, {
      code,
      name: body.name.trim(),
      categoryId: body.categoryId || undefined,
      unit: body.unit || "kg",
      allowsDecimals: body.allowsDecimals !== false,
      price: String(body.price ?? product.price),
      cost: String(body.cost ?? product.cost),
      minStock: String(body.minStock ?? product.minStock),
      targetStock: String(body.targetStock ?? product.targetStock),
      autoPurchaseOrder: Boolean(body.autoPurchaseOrder),
      iconId: body.iconId || "beef-cut",
    });

    return NextResponse.json(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al actualizar producto";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
