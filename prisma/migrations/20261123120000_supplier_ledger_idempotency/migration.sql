ALTER TABLE "supplier_ledger" ADD COLUMN "client_op_id" TEXT;

CREATE UNIQUE INDEX "supplier_ledger_client_op_id_key" ON "supplier_ledger"("client_op_id");

INSERT OR IGNORE INTO "permissions" ("id", "code", "name") VALUES
  ('perm-proveedores-leer', 'PROVEEDORES.LEER', 'Ver proveedores y cuentas por pagar'),
  ('perm-proveedores-gestionar', 'PROVEEDORES.GESTIONAR', 'Gestionar proveedores y registrar deuda'),
  ('perm-proveedores-pagar', 'PROVEEDORES.PAGAR', 'Registrar pagos a proveedores');

INSERT OR IGNORE INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON p."code" IN (
  'PROVEEDORES.LEER',
  'PROVEEDORES.GESTIONAR',
  'PROVEEDORES.PAGAR'
)
WHERE r."name" = 'Administrador';
