import { PrismaClient } from "@prisma/client";
import { createInitialState } from "../server/services/data-store";

const prisma = new PrismaClient();

async function main() {
  if ((await prisma.category.count()) > 0) return;

  const initial = createInitialState();
  await prisma.$transaction(async (tx) => {
    await tx.category.createMany({ data: initial.categories });
    await tx.location.createMany({ data: initial.locations });
    await tx.product.createMany({
      data: initial.products.map(({ currentStock, iconId, ...product }) => ({
        ...product,
        currentStock,
        iconId,
      })),
    });
    await tx.stockByLocation.createMany({ data: initial.stockByLocations });
    await tx.customer.createMany({ data: initial.customers });
    await tx.customerLedger.createMany({ data: initial.customerLedger });
    await tx.cashSession.createMany({
      data: initial.cashSessions.map((session) => ({
        ...session,
        denominationBreakdown: session.denominationBreakdown
          ? JSON.stringify(session.denominationBreakdown)
          : null,
      })),
    });
    await tx.counter.createMany({
      data: Object.entries(initial.counters).map(([series, lastValue]) => ({
        series,
        lastValue,
      })),
    });
  });
}

main()
  .catch((error: unknown) => {
    console.error("No se pudo completar la semilla SQLite:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
