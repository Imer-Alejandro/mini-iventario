-- AlterTable
ALTER TABLE "cash_movements" ADD COLUMN "client_op_id" TEXT;

-- AlterTable
ALTER TABLE "customer_ledger" ADD COLUMN "client_op_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "cash_movements_client_op_id_key" ON "cash_movements"("client_op_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_ledger_client_op_id_key" ON "customer_ledger"("client_op_id");
