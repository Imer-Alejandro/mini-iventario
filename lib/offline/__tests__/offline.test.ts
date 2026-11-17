import { generateClientOpId, enqueueOutboxOperation } from "../sync";
import { localDB } from "../db";

async function runOfflineTests() {
  console.log("=================================================================");
  console.log("      PRUEBAS DEL MOTOR OFFLINE Y SINCRONIZACIÓN (ETAPA 2)");
  console.log("=================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(name: string, condition: boolean, details?: string) {
    if (condition) {
      console.log(`  ✓ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${name} -> ${details || ""}`);
      failed++;
    }
  }

  // 1. Generación de clientOpId UUID v4
  const id1 = generateClientOpId();
  const id2 = generateClientOpId();
  assert("Genera UUID v4 válido no vacío", typeof id1 === "string" && id1.length >= 32);
  assert("Dos IDs generados consecutivamente son únicos", id1 !== id2);

  // 2. Encolado de operación en Outbox
  const op = await enqueueOutboxOperation({
    type: "SALE",
    localSaleNumber: "OFF-0001",
    payload: {
      customerId: "cust-001",
      paymentType: "CONTADO",
      lines: [{ productId: "prod-res-01", quantity: "1.500" }],
    },
  });

  assert("Operación encolada con estado PENDIENTE", op.status === "PENDIENTE");
  assert("Operación contiene clientOpId asignado", typeof op.clientOpId === "string" && op.clientOpId.length > 0);
  assert("Payload incluye clientOpId para garantizar idempotencia en servidor", op.payload.clientOpId === op.clientOpId);
  assert("Conserva número provisional local OFF-0001", op.localSaleNumber === "OFF-0001");

  console.log("\n=================================================================");
  console.log(` RESUMEN DE PRUEBAS OFFLINE: ${passed} pasados, ${failed} fallidos.`);
  console.log("=================================================================\n");

  if (failed > 0) process.exit(1);
}

runOfflineTests().catch((e) => {
  console.error("Fallo en tests offline:", e);
  process.exit(1);
});
