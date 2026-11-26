import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { recordCashMovement } from "../server/services/cash.service";
import { registerCustomerPayment } from "../server/services/credit.service";
import { recordInventoryMovement } from "../server/services/inventory.service";
import { createSale } from "../server/services/sales.service";

const operationId = process.env.SQLITE_TEST_RUN_ID;
if (!operationId) throw new Error("SQLITE_TEST_RUN_ID es obligatorio.");

async function writeOperations() {
  const saleParams = {
    paymentType: "CONTADO" as const,
    userId: "user-cajero-1",
    clientOpId: `${operationId}-sale`,
    lines: [{ productId: "prod-pollo-01", quantity: "1.275", unitPrice: "180.00" }],
  };
  const sale = await createSale(saleParams);
  const duplicateSale = await createSale(saleParams);
  assert.equal(sale.id, duplicateSale.id);
  assert.equal(sale.total, "229.50");

  const [productBeforeRollback, counterBeforeRollback, salesBeforeRollback] = await Promise.all([
    prisma.product.findUniqueOrThrow({ where: { id: "prod-res-01" } }),
    prisma.counter.findUniqueOrThrow({ where: { series: "SALES" } }),
    prisma.sale.count(),
  ]);
  await assert.rejects(createSale({
    paymentType: "CONTADO",
    userId: "user-cajero-1",
    cashSessionId: "missing-cash-session",
    clientOpId: `${operationId}-rollback`,
    lines: [{ productId: "prod-res-01", quantity: "0.500", unitPrice: "300.00" }],
  }));
  const [productAfterRollback, counterAfterRollback, salesAfterRollback] = await Promise.all([
    prisma.product.findUniqueOrThrow({ where: { id: "prod-res-01" } }),
    prisma.counter.findUniqueOrThrow({ where: { series: "SALES" } }),
    prisma.sale.count(),
  ]);
  assert.equal(productAfterRollback.currentStock.toFixed(3), productBeforeRollback.currentStock.toFixed(3));
  assert.equal(counterAfterRollback.lastValue, counterBeforeRollback.lastValue);
  assert.equal(salesAfterRollback, salesBeforeRollback);

  await assert.rejects(createSale({
    paymentType: "CONTADO",
    userId: "user-cajero-1",
    clientOpId: `${operationId}-oversell`,
    lines: [{ productId: "prod-res-01", quantity: "999.000" }],
  }), /Stock insuficiente/);
  assert.equal(
    (await prisma.product.findUniqueOrThrow({ where: { id: "prod-res-01" } })).currentStock.toFixed(3),
    productBeforeRollback.currentStock.toFixed(3),
  );
  assert.equal(await prisma.sale.count(), salesBeforeRollback);

  const session = await prisma.cashSession.findFirstOrThrow({ where: { status: "OPEN" } });
  const cashParams = {
    cashSessionId: session.id,
    clientOpId: `${operationId}-cash`,
    type: "INGRESO_MANUAL" as const,
    amount: "10.00",
    reason: "Prueba de persistencia",
    userId: "user-cajero-1",
  };
  const cash = await recordCashMovement(cashParams);
  const duplicateCash = await recordCashMovement(cashParams);
  assert.equal(cash.id, duplicateCash.id);

  const paymentParams = {
    customerId: "cust-001",
    clientOpId: `${operationId}-payment`,
    amount: "100.00",
    paymentMethod: "TRANSFERENCIA" as const,
    userId: "user-cajero-1",
  };
  const payment = await registerCustomerPayment(paymentParams);
  const duplicatePayment = await registerCustomerPayment(paymentParams);
  assert.equal(payment.ledgerEntry.id, duplicatePayment.ledgerEntry.id);
  const [customerBeforeOverpayment, ledgerCountBeforeOverpayment] = await Promise.all([
    prisma.customer.findUniqueOrThrow({ where: { id: "cust-001" } }),
    prisma.customerLedger.count({ where: { customerId: "cust-001" } }),
  ]);
  await assert.rejects(registerCustomerPayment({
    customerId: "cust-001",
    clientOpId: `${operationId}-overpayment`,
    amount: "5000.00",
    paymentMethod: "TRANSFERENCIA",
    userId: "user-cajero-1",
  }), /no puede superar la deuda/);
  const [customerAfterOverpayment, ledgerCountAfterOverpayment] = await Promise.all([
    prisma.customer.findUniqueOrThrow({ where: { id: "cust-001" } }),
    prisma.customerLedger.count({ where: { customerId: "cust-001" } }),
  ]);
  assert.equal(customerAfterOverpayment.balance.toFixed(2), customerBeforeOverpayment.balance.toFixed(2));
  assert.equal(ledgerCountAfterOverpayment, ledgerCountBeforeOverpayment);

  const movementParams = {
    productId: "prod-res-01",
    clientOpId: `${operationId}-inventory`,
    type: "ENTRADA" as const,
    toLocationId: "loc-003",
    quantity: "0.125",
    userId: "user-cajero-1",
  };
  const movement = await recordInventoryMovement(movementParams);
  const duplicateMovement = await recordInventoryMovement(movementParams);
  assert.equal(movement.id, duplicateMovement.id);
}

async function verifyPersistedOperations() {
  const sale = await prisma.sale.findUniqueOrThrow({
    where: { clientOpId: `${operationId}-sale` },
    include: { lines: true },
  });
  assert.equal(sale.total.toFixed(2), "229.50");
  assert.equal(sale.lines.length, 1);
  assert.equal(await prisma.sale.count({ where: { clientOpId: `${operationId}-sale` } }), 1);
  assert.equal(await prisma.cashMovement.count({ where: { clientOpId: `${operationId}-cash` } }), 1);
  assert.equal(await prisma.customerLedger.count({ where: { clientOpId: `${operationId}-payment` } }), 1);
  assert.equal(await prisma.inventoryMovement.count({ where: { clientOpId: `${operationId}-inventory` } }), 1);
  const auditEntry = await prisma.auditLog.findFirstOrThrow({ where: { entityId: sale.id } });
  await assert.rejects(prisma.auditLog.update({
    where: { id: auditEntry.id },
    data: { action: "MUTATED" },
  }));
  assert.equal((await prisma.auditLog.findUniqueOrThrow({ where: { id: auditEntry.id } })).action, "CREATE");

  const [customer, cashSession, product] = await Promise.all([
    prisma.customer.findUniqueOrThrow({ where: { id: "cust-001" } }),
    prisma.cashSession.findFirstOrThrow({ where: { status: "OPEN" } }),
    prisma.product.findUniqueOrThrow({ where: { id: "prod-res-01" } }),
  ]);
  assert.equal(customer.balance.toFixed(2), "4150.00");
  assert.equal(cashSession.expectedAmount.toFixed(2), "5239.50");
  assert.equal(product.currentStock.toFixed(3), "27.625");
}

async function verifyConfiguredDataPath() {
  const databases = await prisma.$queryRawUnsafe<Array<{ file: string }>>("PRAGMA database_list");
  assert.equal(databases[0]?.file, process.env.EXPECTED_SQLITE_PATH);
}

async function main() {
  try {
    if (process.argv[2] === "write") {
      await writeOperations();
    } else if (process.argv[2] === "verify") {
      await verifyPersistedOperations();
    } else if (process.argv[2] === "path") {
      await verifyConfiguredDataPath();
    } else {
      throw new Error("La fase debe ser write, verify o path.");
    }
    console.log(`SQLite persistence ${process.argv[2]}: OK`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
