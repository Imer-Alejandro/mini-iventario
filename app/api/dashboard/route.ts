import { NextResponse } from "next/server";
import Decimal from "decimal.js";
import { prisma } from "@/lib/db";
import { getCashSessionReport } from "@/server/services/cash.service";
import { getStockAlerts } from "@/server/services/inventory.service";
import { requirePermission } from "@/server/services/auth.service";

export async function GET(request: Request) {
  const auth = await requirePermission(request, "DASHBOARD.LEER");
  if (!auth.ok) return auth.response;
  const [sales, activeCash, customers, products] = await Promise.all([
    prisma.sale.findMany({
      include: { lines: true, customer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.cashSession.findFirst({ where: { status: "OPEN" } }),
    prisma.customer.findMany(),
    prisma.product.findMany({ include: { category: true } }),
  ]);
  const productsById = new Map(products.map((product) => [product.id, product]));
  const alerts = await getStockAlerts();

  // 1. Métricas de Ventas
  let totalSalesDay = new Decimal(0);
  let totalCashSales = new Decimal(0);
  let totalCreditSales = new Decimal(0);
  let totalEstimatedCost = new Decimal(0);

  const confirmedSales = sales.filter((s) => s.status === "CONFIRMED");
  const today = new Date();
  const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
  const isToday = (value: Date) =>
    value.getFullYear() === today.getFullYear() &&
    value.getMonth() === today.getMonth() &&
    value.getDate() === today.getDate();
  const todaySales = confirmedSales.filter((sale) => isToday(new Date(sale.createdAt)));
  const reportSales = confirmedSales.filter((sale) => {
    const saleDate = new Date(sale.createdAt);
    return saleDate >= weekStart && saleDate <= today;
  });

  for (const s of todaySales) {
    const saleTot = new Decimal(s.total.toString());
    totalSalesDay = totalSalesDay.plus(saleTot);

    if (s.paymentType === "CONTADO") {
      totalCashSales = totalCashSales.plus(saleTot);
    } else {
      totalCreditSales = totalCreditSales.plus(saleTot);
    }

    for (const l of s.lines) {
      const prod = productsById.get(l.productId);
      if (prod) {
        const costDec = new Decimal(prod.cost.toString());
        const qtyDec = new Decimal(l.quantity.toString());
        totalEstimatedCost = totalEstimatedCost.plus(costDec.mul(qtyDec));
      }
    }
  }

  const grossProfit = totalSalesDay.minus(totalEstimatedCost);
  const avgTicket = todaySales.length > 0
    ? totalSalesDay.div(todaySales.length).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2)
    : "0.00";

  // 2. Métricas de Crédito
  let totalDebtOwed = new Decimal(0);
  let totalCreditLimit = new Decimal(0);
  let debtorsCount = 0;

  for (const c of customers) {
    const bal = new Decimal(c.balance.toString());
    totalDebtOwed = totalDebtOwed.plus(bal);
    totalCreditLimit = totalCreditLimit.plus(new Decimal(c.creditLimit.toString()));
    if (bal.greaterThan(0)) {
      debtorsCount++;
    }
  }

  // 3. Métricas de Caja
  let cashReport = null;
  if (activeCash) {
    cashReport = await getCashSessionReport(activeCash.id);
  }

  // 4. Ventas por Categoría (para gráficas)
  const categorySalesMap: Record<string, Decimal> = {};
  for (const s of reportSales) {
    for (const line of s.lines) {
      const prod = productsById.get(line.productId);
      const catName = prod?.categoryId
        ? prod.category?.name || "Otros"
        : "Otros";
      categorySalesMap[catName] = (categorySalesMap[catName] || new Decimal(0)).plus(new Decimal(line.lineTotal.toString()));
    }
  }

  const categorySales = Object.entries(categorySalesMap).map(([name, total]) => ({
    name,
    total: total.toFixed(2),
  }));

  const dailySalesMap = new Map<string, Decimal>();
  const dailySales = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (6 - index));
    const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    dailySalesMap.set(dateKey, new Decimal(0));
    return {
      date: date.toISOString(),
      label: new Intl.DateTimeFormat("es-DO", { weekday: "short" }).format(date).replace(".", ""),
      total: "0.00",
      dateKey,
    };
  });
  for (const sale of reportSales) {
    const saleDate = new Date(sale.createdAt);
    const dateKey = `${saleDate.getFullYear()}-${saleDate.getMonth()}-${saleDate.getDate()}`;
    const current = dailySalesMap.get(dateKey);
    if (current) dailySalesMap.set(dateKey, current.plus(new Decimal(sale.total.toString())));
  }
  const dailySalesData = dailySales.map((day) => ({
    date: day.date,
    label: day.label,
    total: (dailySalesMap.get(day.dateKey) || new Decimal(0)).toFixed(2),
  }));

  const productSales = new Map<string, { name: string; unit: string; iconId?: string; quantity: Decimal; total: Decimal }>();
  for (const sale of reportSales) {
    for (const line of sale.lines) {
      const product = productsById.get(line.productId);
      if (!product) continue;
      const current = productSales.get(product.id) || {
        name: product.name,
        unit: product.unit,
        iconId: product.iconId ?? undefined,
        quantity: new Decimal(0),
        total: new Decimal(0),
      };
      current.quantity = current.quantity.plus(new Decimal(line.quantity.toString()));
      current.total = current.total.plus(new Decimal(line.lineTotal.toString()));
      productSales.set(product.id, current);
    }
  }
  const topProducts = Array.from(productSales.entries())
    .map(([id, product]) => ({
      id,
      name: product.name,
      unit: product.unit,
      iconId: product.iconId,
      quantity: product.quantity.toFixed(3),
      total: product.total.toFixed(2),
    }))
    .sort((a, b) => Number(b.total) - Number(a.total))
    .slice(0, 5);

  // 5. Historial reciente
  const recentSales = confirmedSales.slice(0, 10).map((s) => ({
    id: s.id,
    number: s.number,
    customerName: s.customer?.name || "Cliente Mostrador",
    total: s.total.toString(),
    paymentType: s.paymentType,
    itemsCount: s.lines.length,
    createdAt: s.createdAt,
  }));

  return NextResponse.json({
    metrics: {
      salesTotal: totalSalesDay.toFixed(2),
      salesCount: todaySales.length,
      avgTicket,
      cashSalesTotal: totalCashSales.toFixed(2),
      creditSalesTotal: totalCreditSales.toFixed(2),
      estimatedGrossProfit: grossProfit.toFixed(2),
      profitMarginPct: totalSalesDay.greaterThan(0)
        ? grossProfit.div(totalSalesDay).mul(100).toFixed(1)
        : "0.0",
      totalDebtOwed: totalDebtOwed.toFixed(2),
      debtorsCount,
      activeCashExpected: cashReport ? cashReport.expectedAmount : "0.00",
      isCashOpen: !!activeCash,
      cashSessionNumber: activeCash ? activeCash.sessionNumber : null,
      lowStockAlertsCount: alerts.length,
    },
    categorySales,
    dailySales: dailySalesData,
    topProducts,
    recentSales,
    alerts,
    updatedAt: new Date().toISOString(),
  });
}
