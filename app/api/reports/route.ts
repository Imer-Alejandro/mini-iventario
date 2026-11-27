import { NextResponse } from "next/server";
import Decimal from "decimal.js";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/server/services/auth.service";

const DAY_MS = 24 * 60 * 60 * 1000;

function isDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function dateKeyInZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function totalOfLines(lines: Array<{ lineTotal: { toString(): string } }>) {
  return lines.reduce(
    (total, line) => total.plus(line.lineTotal.toString()),
    new Decimal(0),
  );
}

export async function GET(request: Request) {
  const auth = await requirePermission(request, "REPORTES.LEER");
  if (!auth.ok) return auth.response;

  const searchParams = new URL(request.url).searchParams;
  const fromDate = searchParams.get("fromDate") || "";
  const toDate = searchParams.get("toDate") || "";
  const fromAt = new Date(searchParams.get("from") || "");
  const toAt = new Date(searchParams.get("to") || "");
  const paymentType = searchParams.get("paymentType") || "ALL";
  const categoryId = searchParams.get("categoryId") || "ALL";
  const productId = searchParams.get("productId") || "ALL";
  const timeZone = searchParams.get("timeZone") || "UTC";

  if (
    !isDateOnly(fromDate)
    || !isDateOnly(toDate)
    || Number.isNaN(fromAt.getTime())
    || Number.isNaN(toAt.getTime())
    || fromAt > toAt
    || fromDate > toDate
    || (Date.parse(`${toDate}T00:00:00.000Z`) - Date.parse(`${fromDate}T00:00:00.000Z`)) / DAY_MS > 365
    || !["ALL", "CONTADO", "CREDITO"].includes(paymentType)
  ) {
    return NextResponse.json({ error: "Los filtros del reporte no son válidos." }, { status: 400 });
  }

  let dateFormatter: Intl.DateTimeFormat;
  try {
    dateFormatter = new Intl.DateTimeFormat("es-DO", {
      timeZone,
      weekday: "short",
      day: "2-digit",
      month: "short",
    });
    dateKeyInZone(fromAt, timeZone);
  } catch {
    return NextResponse.json({ error: "La zona horaria seleccionada no es válida." }, { status: 400 });
  }

  const [sales, categories, products] = await Promise.all([
    prisma.sale.findMany({
      where: {
        createdAt: { gte: fromAt, lte: toAt },
        ...(paymentType === "ALL" ? {} : { paymentType }),
      },
      include: {
        customer: { select: { id: true, name: true } },
        lines: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                categoryId: true,
                iconId: true,
                category: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.category.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({
      select: { id: true, name: true, categoryId: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const scopedSales = sales
    .map((sale) => ({
      sale,
      lines: sale.lines.filter((line) =>
        (categoryId === "ALL" || line.product.categoryId === categoryId)
        && (productId === "ALL" || line.productId === productId),
      ),
    }))
    .filter(({ lines }) => lines.length > 0);
  const confirmedSales = scopedSales.filter(({ sale }) => sale.status === "CONFIRMED");
  const voidedSales = scopedSales.filter(({ sale }) => sale.status === "VOIDED");
  const salesTotal = confirmedSales.reduce(
    (total, { lines }) => total.plus(totalOfLines(lines)),
    new Decimal(0),
  );
  const cashTotal = confirmedSales
    .filter(({ sale }) => sale.paymentType === "CONTADO")
    .reduce((total, { lines }) => total.plus(totalOfLines(lines)), new Decimal(0));
  const creditTotal = confirmedSales
    .filter(({ sale }) => sale.paymentType === "CREDITO")
    .reduce((total, { lines }) => total.plus(totalOfLines(lines)), new Decimal(0));
  const voidedTotal = voidedSales.reduce(
    (total, { lines }) => total.plus(totalOfLines(lines)),
    new Decimal(0),
  );
  const lineCount = confirmedSales.reduce((count, { lines }) => count + lines.length, 0);

  const categoryTotals = new Map<string, { name: string; total: Decimal }>();
  const productTotals = new Map<string, {
    id: string;
    name: string;
    iconId?: string;
    total: Decimal;
    saleLines: number;
  }>();
  const customerTotals = new Map<string, {
    id: string;
    name: string;
    total: Decimal;
    tickets: number;
  }>();
  const dailyTotals = new Map<string, Decimal>();

  for (let cursor = new Date(`${fromDate}T12:00:00.000Z`); cursor <= new Date(`${toDate}T12:00:00.000Z`); cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const key = cursor.toISOString().slice(0, 10);
    dailyTotals.set(key, new Decimal(0));
  }

  for (const { sale, lines } of confirmedSales) {
    const saleTotal = totalOfLines(lines);
    const dayKey = dateKeyInZone(sale.createdAt, timeZone);
    if (dailyTotals.has(dayKey)) dailyTotals.set(dayKey, dailyTotals.get(dayKey)!.plus(saleTotal));

    for (const line of lines) {
      const lineTotal = new Decimal(line.lineTotal.toString());
      const categoryName = line.product.category?.name || "Sin categoría";
      const category = categoryTotals.get(categoryName) || { name: categoryName, total: new Decimal(0) };
      category.total = category.total.plus(lineTotal);
      categoryTotals.set(categoryName, category);

      const product = productTotals.get(line.productId) || {
        id: line.productId,
        name: line.productName,
        iconId: line.product.iconId ?? undefined,
        total: new Decimal(0),
        saleLines: 0,
      };
      product.total = product.total.plus(lineTotal);
      product.saleLines++;
      productTotals.set(line.productId, product);
    }

    if (sale.customer) {
      const customer = customerTotals.get(sale.customer.id) || {
        id: sale.customer.id,
        name: sale.customer.name,
        total: new Decimal(0),
        tickets: 0,
      };
      customer.total = customer.total.plus(saleTotal);
      customer.tickets++;
      customerTotals.set(sale.customer.id, customer);
    }
  }

  const dailySales = Array.from(dailyTotals, ([date, total]) => ({
    date,
    label: dateFormatter.format(new Date(`${date}T12:00:00.000Z`)).replace(".", ""),
    total: total.toFixed(2),
  }));
  const categorySales = Array.from(categoryTotals.values())
    .map(({ name, total }) => ({ name, total: total.toFixed(2) }))
    .sort((a, b) => Number(b.total) - Number(a.total));
  const topProducts = Array.from(productTotals.values())
    .map(({ total, ...product }) => ({ ...product, total: total.toFixed(2) }))
    .sort((a, b) => Number(b.total) - Number(a.total))
    .slice(0, 10);
  const topCustomers = Array.from(customerTotals.values())
    .map(({ total, ...customer }) => ({ ...customer, total: total.toFixed(2) }))
    .sort((a, b) => Number(b.total) - Number(a.total))
    .slice(0, 10);
  const recentSales = scopedSales.slice(0, 10).map(({ sale, lines }) => ({
    id: sale.id,
    number: sale.number,
    createdAt: sale.createdAt,
    customerName: sale.customer?.name || "Cliente Mostrador",
    paymentType: sale.paymentType,
    status: sale.status,
    total: totalOfLines(lines).toFixed(2),
    lineCount: lines.length,
  }));

  return NextResponse.json({
    filters: { fromDate, toDate, paymentType, categoryId, productId },
    metrics: {
      salesTotal: salesTotal.toFixed(2),
      salesCount: confirmedSales.length,
      averageTicket: confirmedSales.length
        ? salesTotal.div(confirmedSales.length).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2)
        : "0.00",
      lineCount,
      cashTotal: cashTotal.toFixed(2),
      creditTotal: creditTotal.toFixed(2),
      voidedCount: voidedSales.length,
      voidedTotal: voidedTotal.toFixed(2),
    },
    dailySales,
    categorySales,
    topProducts,
    topCustomers,
    recentSales,
    categories,
    products,
    updatedAt: new Date().toISOString(),
  });
}
