import { store } from "../data-store";
import { openCashSession, recordCashMovement, closeCashSession, getCashSessionReport } from "../cash.service";
import { createSale, voidSale } from "../sales.service";
import { checkCustomerCredit, registerCustomerPayment, getCustomerAging } from "../credit.service";
import { recordInventoryMovement, recordMerma, getStockAlerts } from "../inventory.service";
import Decimal from "decimal.js";

async function runDomainServiceTests() {
  console.log("=================================================================");
  console.log("   PRUEBAS AUTOMATIZADAS DE DOMINIO Y FINANZAS (ETAPA 1)");
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

  // Limpiar el estado antes de empezar
  store.reset();

  // -------------------------------------------------------------
  // TEST 1: Caja y Arqueo Diario
  // -------------------------------------------------------------
  console.log("\n[GRUPO 1: GESTIÓN DE CAJA Y CIERRE DIARIO]");
  const activeSess = store.getActiveCashSession()!;
  assert("Sesión inicial abierta con RD$ 5,000.00", activeSess.openingAmount === "5000.00");

  // Registrar un ingreso manual
  await recordCashMovement({
    cashSessionId: activeSess.id,
    type: "INGRESO_MANUAL",
    amount: "1500.00",
    reason: "Cambio menudo para dar cambio",
    userId: "user-cajero-1",
  });

  let report = await getCashSessionReport(activeSess.id);
  assert("Efectivo esperado tras ingreso de 1500: RD$ 6,500.00", report.expectedAmount === "6500.00", `Esperado: ${report.expectedAmount}`);

  // Registrar un retiro manual con autorización
  await recordCashMovement({
    cashSessionId: activeSess.id,
    type: "RETIRO_MANUAL",
    amount: "1200.00",
    reason: "Pago de hielo y bolsas al proveedor",
    userId: "user-cajero-1",
    authorizedBy: "user-supervisor-1",
  });

  report = await getCashSessionReport(activeSess.id);
  assert("Efectivo esperado tras retiro de 1200: RD$ 5,300.00", report.expectedAmount === "5300.00", `Esperado: ${report.expectedAmount}`);

  // -------------------------------------------------------------
  // TEST 2: Venta en Mostrador con pesaje decimal exacto
  // -------------------------------------------------------------
  console.log("\n[GRUPO 2: VENTA POS CON PESAJE EXACTO (DECIMAL 14,3)]");
  const sale = await createSale({
    paymentType: "CONTADO",
    paymentMethod: "EFECTIVO",
    userId: "user-cajero-1",
    clientOpId: "b8a97e2f-5182-4fa1-82d2-837190ad3123",
    lines: [
      { productId: "prod-res-01", quantity: "1.275", unitPrice: "450.00" }, // 573.75
      { productId: "prod-pollo-01", quantity: "2.000", unitPrice: "180.00" }, // 360.00
    ],
  });

  assert("Venta calculada exactamente: 573.75 + 360.00 == '933.75'", sale.total === "933.75", `Total: ${sale.total}`);
  assert("Línea 1 redondeada a 2 decimales: 573.75", sale.lines[0].lineTotal === "573.75");
  assert("Línea 2 redondeada a 2 decimales: 360.00", sale.lines[1].lineTotal === "360.00");
  assert("Estado confirmado y asignación de consecutivo atómico", sale.status === "CONFIRMED" && sale.number > 0);

  // Verificar impacto en caja: 5300.00 + 933.75 = 6233.75
  report = await getCashSessionReport(activeSess.id);
  assert("Venta en efectivo impactó la caja: esperado RD$ 6,233.75", report.expectedAmount === "6233.75", `Esperado: ${report.expectedAmount}`);

  // -------------------------------------------------------------
  // TEST 3: Idempotencia de la Venta (Garantía Offline)
  // -------------------------------------------------------------
  console.log("\n[GRUPO 3: IDEMPOTENCIA Y PROTECCIÓN ANTE DUPLICADOS]");
  const duplicateSaleAttempt = await createSale({
    paymentType: "CONTADO",
    userId: "user-cajero-1",
    clientOpId: "b8a97e2f-5182-4fa1-82d2-837190ad3123", // Mismo clientOpId
    lines: [{ productId: "prod-res-01", quantity: "1.275" }],
  });

  assert("Reenvío con mismo clientOpId devuelve venta original sin duplicar", duplicateSaleAttempt.id === sale.id);
  report = await getCashSessionReport(activeSess.id);
  assert("La caja NO se duplicó por reintento offline: sigue en RD$ 6,233.75", report.expectedAmount === "6233.75");

  // -------------------------------------------------------------
  // TEST 4: Cuenta Corriente, Crédito y Abonos
  // -------------------------------------------------------------
  console.log("\n[GRUPO 4: CRÉDITO Y CUENTA CORRIENTE]");
  const customer = store.getCustomerById("cust-001")!; // Saldo previo: 4250.00, Límite: 25000.00
  const initialCustomerBalance = customer.balance;

  const creditSale = await createSale({
    customerId: customer.id,
    paymentType: "CREDITO",
    userId: "user-cajero-1",
    lines: [{ productId: "prod-cerdo-01", quantity: "5.000", unitPrice: "280.00" }], // 1400.00
  });

  const updatedCustomer = store.getCustomerById(customer.id)!;
  assert("Venta a crédito sumó exactamente a la deuda: 4250 + 1400 == 5650.00", updatedCustomer.balance === "5650.00", `Deuda: ${updatedCustomer.balance}`);

  // Registrar un abono en efectivo del cliente
  const paymentRes = await registerCustomerPayment({
    customerId: customer.id,
    amount: "2000.00",
    paymentMethod: "EFECTIVO",
    note: "Abono parcial en mostrador",
    userId: "user-cajero-1",
  });

  const afterPaymentCustomer = store.getCustomerById(customer.id)!;
  assert("Abono redujo la deuda: 5650 - 2000 == 3650.00", afterPaymentCustomer.balance === "3650.00", `Deuda: ${afterPaymentCustomer.balance}`);

  // Verificar que el abono en efectivo también ingresó a la caja abierta: 6233.75 + 2000.00 = 8233.75
  report = await getCashSessionReport(activeSess.id);
  assert("Abono en efectivo ingresó a caja: esperado RD$ 8,233.75", report.expectedAmount === "8233.75", `Esperado: ${report.expectedAmount}`);

  // -------------------------------------------------------------
  // TEST 5: Control de Límite de Crédito
  // -------------------------------------------------------------
  console.log("\n[GRUPO 5: CONTROL ESTRICTO DE LÍMITE DE CRÉDITO]");
  const smallCustomer = store.getCustomerById("cust-003")!; // Límite: 5,000.00, Saldo: 0.00
  let creditRejected = false;
  try {
    // Intentar venta a crédito por 6,000.00 (> límite) sin supervisor
    await createSale({
      customerId: smallCustomer.id,
      paymentType: "CREDITO",
      userId: "user-cajero-1",
      lines: [{ productId: "prod-res-01", quantity: "20.000", unitPrice: "300.00" }], // 6000.00
    });
  } catch {
    creditRejected = true;
  }
  assert("Venta que excede límite de crédito es bloqueada sin PIN de supervisor", creditRejected);

  // Ahora con PIN / autorización de supervisor
  const approvedOverlimitSale = await createSale({
    customerId: smallCustomer.id,
    paymentType: "CREDITO",
    userId: "user-cajero-1",
    authorizedBy: "user-supervisor-1",
    lines: [{ productId: "prod-res-01", quantity: "20.000", unitPrice: "300.00" }], // 6000.00
  });
  assert("Venta autorizada por supervisor se procesa correctamente", approvedOverlimitSale.status === "CONFIRMED");

  // -------------------------------------------------------------
  // TEST 6: Anulación de Venta (Contra-movimiento)
  // -------------------------------------------------------------
  console.log("\n[GRUPO 6: ANULACIÓN DE VENTAS Y CONTRA-MOVIMIENTOS]");
  const voided = await voidSale({
    saleId: sale.id,
    voidReason: "Cliente devolvió la carne por cambio de pedido",
    voidedBy: "user-supervisor-1",
  });

  assert("La venta fue marcada como VOIDED (nunca borrada)", voided.status === "VOIDED");
  assert("Registra motivo y usuario que autorizó la anulación", Boolean(voided.voidReason?.includes("Cliente devolvió")));


  // Verificar que la reversión en efectivo restó de la caja: 8233.75 - 933.75 = 7300.00
  report = await getCashSessionReport(activeSess.id);
  assert("Reversión de venta restó de la caja: esperado RD$ 7,300.00", report.expectedAmount === "7300.00", `Esperado: ${report.expectedAmount}`);

  // -------------------------------------------------------------
  // TEST 7: Inventario, Merma y Alertas de Stock
  // -------------------------------------------------------------
  console.log("\n[GRUPO 7: MERMAS DE CARNICERÍA Y ALERTAS DE REPOSICIÓN]");
  // Registrar una merma por desposte en Pechuga de Pollo (42.000 kg actuales)
  const mermaMov = await recordMerma({
    productId: "prod-pollo-01",
    locationId: "loc-003",
    quantity: "25.000",
    reason: "Pérdida por hueso y cartílago en desposte diario",
    userId: "user-carnicero-1",
  });

  assert("Merma de 25.000 kg registrada exitosamente", mermaMov.type === "MERMA");
  const pollo = store.getProductById("prod-pollo-01")!;
  assert("Stock de pollo disminuyó acordemente", new Decimal(pollo.currentStock).lessThan(42));

  // Comprobar alertas de reposición
  const alerts = await getStockAlerts();
  assert("Alertas detectan productos que requieren reposición", alerts.length > 0);
  console.log(`  -> Alertas generadas: ${alerts.map((a) => `${a.productCode} (Stock: ${a.currentStock}, Sugerido: ${a.suggestedQty})`).join(", ")}`);

  // -------------------------------------------------------------
  // TEST 8: Arqueo y Cierre Diario de Caja
  // -------------------------------------------------------------
  console.log("\n[GRUPO 8: CIERRE DIARIO Y ARQUEO DE EFECTIVO]");
  // Esperado en caja: 7300.00
  // Supongamos que el cajero cuenta físicamente RD$ 7,250.00 (Faltante de RD$ 50.00)
  // Intento de cerrar sin motivo con diferencia -> Debe fallar
  let closeFailedWithoutReason = false;
  try {
    await closeCashSession({
      cashSessionId: activeSess.id,
      countedAmount: "7250.00",
      userId: "user-cajero-1",
    });
  } catch {
    closeFailedWithoutReason = true;
  }
  assert("Cierre con diferencia exige justificación obligatoria", closeFailedWithoutReason);

  // Cierre correcto con justificación
  const finalClosed = await closeCashSession({
    cashSessionId: activeSess.id,
    countedAmount: "7250.00",
    diffReason: "Error en cambio entregado en horas pico",
    userId: "user-cajero-1",
  });

  assert("Caja cerrada exitosamente en estado CLOSED", finalClosed.status === "CLOSED");
  assert("Diferencia de faltante calculada exactamente: '-50.00'", finalClosed.difference === "-50.00", `Diferencia: ${finalClosed.difference}`);
  assert("Reporte inmutable con justificación auditada", Boolean(finalClosed.diffReason?.includes("Error en cambio")));


  console.log("\n=================================================================");
  console.log(` RESUMEN DE PRUEBAS: ${passed} pasados, ${failed} fallidos.`);
  console.log("=================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runDomainServiceTests().catch((e) => {
  console.error("Error crítico ejecutando tests:", e);
  process.exit(1);
});
