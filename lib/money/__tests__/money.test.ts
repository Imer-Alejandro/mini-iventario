import {
  calculateLineTotal,
  sumLineTotals,
  validateAndParseQty,
  formatCurrencyRD,
  calculateChange,
  calculateCountedCash,
  checkCreditAvailability,
} from "../index";
import Decimal from "decimal.js";


function runTests() {
  console.log("=== EJECUTANDO CASOS DE PRUEBA OBLIGATORIOS (SECCIÓN 4.5) ===");
  let passed = 0;
  let failed = 0;

  function assert(name: string, condition: boolean, details?: string) {
    if (condition) {
      console.log(`✓ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`✗ [FAIL] ${name} - ${details || ""}`);
      failed++;
    }
  }

  // 1. 1.275 kg × 450.00 = 573.75
  const item1 = calculateLineTotal("1.275", "450.00");
  assert("1.275 kg × 450.00 == '573.75'", item1 === "573.75", `Resultado: ${item1}`);

  // 2. 2.000 kg × 180.00 = 360.00
  const item2 = calculateLineTotal("2.000", "180.00");
  assert("2.000 kg × 180.00 == '360.00'", item2 === "360.00", `Resultado: ${item2}`);

  // 3. Total del ejemplo = 933.75
  const total = sumLineTotals([item1, item2]);
  assert("Total del ejemplo == '933.75'", total === "933.75", `Resultado: ${total}`);

  // 4. 0.1 + 0.2 (decimal) == 0.3
  const decSum = new Decimal("0.1").plus(new Decimal("0.2")).toString();
  assert("0.1 + 0.2 == '0.3'", decSum === "0.3", `Resultado: ${decSum}`);

  // 5. 0.333 kg × 100.00 == 33.30
  const item3 = calculateLineTotal("0.333", "100.00");
  assert("0.333 kg × 100.00 == '33.30'", item3 === "33.30", `Resultado: ${item3}`);

  // 6. 0.005 redondeado a 2 decimales == 0.01 (ROUND_HALF_UP)
  const roundHalfUp = new Decimal("0.005").toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
  assert("0.005 redondeado a 2 == '0.01'", roundHalfUp === "0.01", `Resultado: ${roundHalfUp}`);

  // 7. Cantidad '1.2756' (más de 3 decimales) -> Rechazada
  let rejectedExtraDecimals = false;
  try {
    validateAndParseQty("1.2756");
  } catch {
    rejectedExtraDecimals = true;
  }
  assert("Cantidad '1.2756' es rechazada (> 3 decimales)", rejectedExtraDecimals);

  // 8. Cantidad '1,275' (con coma) -> Rechazada
  let rejectedComma = false;
  try {
    validateAndParseQty("1,275");
  } catch {
    rejectedComma = true;
  }
  assert("Cantidad '1,275' es rechazada (formato inválido con coma)", rejectedComma);

  // 9. Unidad no admite fracciones (allowsDecimals = false) con decimales -> Rechazada
  let rejectedIntegerConstraint = false;
  try {
    validateAndParseQty("1.500", false);
  } catch {
    rejectedIntegerConstraint = true;
  }
  assert("Producto indivisible con '1.500' es rechazado", rejectedIntegerConstraint);

  // 10. Cálculo de cambio: Total 933.75, Pagó con RD$ 1,000.00 -> Devuelta = 66.25
  const changeResult = calculateChange("1000.00", "933.75");
  assert("Cambio exacto: 1000.00 - 933.75 == '66.25'", changeResult.change === "66.25" && changeResult.isSufficient, `Resultado: ${changeResult.change}`);

  // 11. Pago insuficiente: Total 933.75, Pagó 500.00 -> isSufficient = false, remainingDue = 433.75
  const insufficientResult = calculateChange("500.00", "933.75");
  assert("Pago insuficiente detectado correctamente", !insufficientResult.isSufficient && insufficientResult.remainingDue === "433.75");

  // 12. Conteo de efectivo por denominaciones RD$:
  // 2 billetes de 2000 (= 4000) + 3 billetes de 500 (= 1500) + 4 monedas de 25 (= 100) = 5600.00
  const counted = calculateCountedCash({
    "2000.00": 2,
    "500.00": 3,
    "25.00": 4,
  });
  assert("Conteo por denominaciones RD$: 2x2000 + 3x500 + 4x25 == '5600.00'", counted === "5600.00", `Resultado: ${counted}`);

  // 13. Verificación de crédito disponible:
  // Límite: 15,000.00, Deuda actual: 4,250.00, Nueva venta: 1,350.00 -> Permitida, Nuevo saldo: 5,600.00, Disponible: 9,400.00
  const creditOk = checkCreditAvailability("4250.00", "15000.00", "1350.00");
  assert("Crédito aprobado: dentro del límite", creditOk.allowed && creditOk.newBalance === "5600.00" && creditOk.availableCredit === "9400.00");

  // 14. Verificación de crédito excedido:
  // Límite: 15,000.00, Deuda actual: 14,000.00, Nueva venta: 2,000.00 -> Denegada, Excedido: 1,000.00
  const creditDenied = checkCreditAvailability("14000.00", "15000.00", "2000.00");
  assert("Crédito rechazado por exceder límite", !creditDenied.allowed && creditDenied.exceededAmount === "1000.00");

  console.log(`\nRESUMEN: ${passed} pasados, ${failed} fallidos.`);
  if (failed > 0) process.exit(1);
}

runTests();

