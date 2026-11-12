-- CreateEnum
CREATE TYPE "credit_order_status" AS ENUM ('pending', 'paid', 'failed', 'abandoned', 'anomaly');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ledger_transaction_type" ADD VALUE 'credit_purchase';
ALTER TYPE "ledger_transaction_type" ADD VALUE 'payment_settlement';
ALTER TYPE "ledger_transaction_type" ADD VALUE 'commission_release';

-- AlterEnum
ALTER TYPE "security_event_type" ADD VALUE 'credit_pack_changed';

-- AlterTable
ALTER TABLE "credit_lots" ADD COLUMN     "payment_id" UUID;

-- CreateTable
CREATE TABLE "credit_packs" (
    "id" UUID NOT NULL,
    "sku" VARCHAR(40) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "credits" INTEGER NOT NULL,
    "price_usd" DECIMAL(20,2) NOT NULL,
    "chariow_product_id" VARCHAR(100),
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "credit_packs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_orders" (
    "id" UUID NOT NULL,
    "reference" VARCHAR(40) NOT NULL,
    "user_id" UUID NOT NULL,
    "pack_id" UUID NOT NULL,
    "credits" INTEGER NOT NULL,
    "price_usd" DECIMAL(20,2) NOT NULL,
    "credit_unit_value_usd" DECIMAL(20,6) NOT NULL,
    "chariow_product_id" VARCHAR(100) NOT NULL,
    "status" "credit_order_status" NOT NULL DEFAULT 'pending',
    "provider_sale_id" VARCHAR(100),
    "checkout_url" TEXT,
    "failure_reason" VARCHAR(500),
    "paid_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "credit_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "provider" VARCHAR(20) NOT NULL,
    "provider_sale_id" VARCHAR(100) NOT NULL,
    "amount_usd" DECIMAL(20,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "settlement_amount" DECIMAL(20,2),
    "service_fee" DECIMAL(20,2),
    "settlement_due_at" TIMESTAMPTZ(3),
    "settlement_done_at" TIMESTAMPTZ(3),
    "sale_status" VARCHAR(30) NOT NULL,
    "raw_snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_events" (
    "id" UUID NOT NULL,
    "provider" VARCHAR(20) NOT NULL,
    "delivery_id" VARCHAR(100) NOT NULL,
    "event_type" VARCHAR(60) NOT NULL,
    "signature_valid" BOOLEAN NOT NULL,
    "payload" JSONB NOT NULL,
    "sale_id" VARCHAR(100),
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(3),
    "error" VARCHAR(500),

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "credit_packs_sku_key" ON "credit_packs"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "credit_packs_chariow_product_id_key" ON "credit_packs"("chariow_product_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_orders_reference_key" ON "credit_orders"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "credit_orders_provider_sale_id_key" ON "credit_orders"("provider_sale_id");

-- CreateIndex
CREATE INDEX "credit_orders_user_id_created_at_idx" ON "credit_orders"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "credit_orders_status_created_at_idx" ON "credit_orders"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payments_order_id_key" ON "payments"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_provider_sale_id_key" ON "payments"("provider", "provider_sale_id");

-- CreateIndex
CREATE INDEX "payment_events_sale_id_idx" ON "payment_events"("sale_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_events_provider_delivery_id_key" ON "payment_events"("provider", "delivery_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_lots_payment_id_key" ON "credit_lots"("payment_id");

-- AddForeignKey
ALTER TABLE "credit_lots" ADD CONSTRAINT "credit_lots_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_orders" ADD CONSTRAINT "credit_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_orders" ADD CONSTRAINT "credit_orders_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "credit_packs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "credit_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Garde-fous des recharges (correction du modèle économique §3).
-- ---------------------------------------------------------------------------

ALTER TABLE "credit_packs"
  ADD CONSTRAINT "credit_packs_values_chk" CHECK ("credits" > 0 AND "price_usd" > 0);

ALTER TABLE "credit_orders"
  ADD CONSTRAINT "credit_orders_values_chk"
    CHECK ("credits" > 0 AND "price_usd" > 0 AND "credit_unit_value_usd" > 0),
  ADD CONSTRAINT "credit_orders_paid_chk" CHECK ("status" <> 'paid' OR "paid_at" IS NOT NULL);

-- Un lot « purchase » vient toujours d'un paiement ; seul un tel lot est commissionnable.
ALTER TABLE "credit_lots"
  ADD CONSTRAINT "credit_lots_purchase_payment_chk"
    CHECK (("origin" = 'purchase') = ("payment_id" IS NOT NULL));

-- Une commande payée ne revient jamais en arrière ; montant, crédits et produit sont figés.
CREATE FUNCTION "credit_orders_guard"() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'credit_orders : suppression interdite' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW."user_id" <> OLD."user_id" OR NEW."credits" <> OLD."credits"
     OR NEW."price_usd" <> OLD."price_usd"
     OR NEW."credit_unit_value_usd" <> OLD."credit_unit_value_usd"
     OR NEW."chariow_product_id" <> OLD."chariow_product_id" THEN
    RAISE EXCEPTION 'credit_orders : montant et crédits non modifiables'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD."status" = 'paid' AND NEW."status" <> 'paid' THEN
    RAISE EXCEPTION 'credit_orders : une commande payée est définitive'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "credit_orders_guard" BEFORE UPDATE OR DELETE ON "credit_orders"
  FOR EACH ROW EXECUTE FUNCTION "credit_orders_guard"();

-- Paiements et notifications : jamais supprimés.
CREATE FUNCTION "prevent_delete"() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% : suppression interdite', TG_TABLE_NAME USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER "payments_no_delete" BEFORE DELETE ON "payments"
  FOR EACH ROW EXECUTE FUNCTION "prevent_delete"();
CREATE TRIGGER "payments_no_truncate" BEFORE TRUNCATE ON "payments"
  FOR EACH STATEMENT EXECUTE FUNCTION "prevent_append_only_mutation"();
CREATE TRIGGER "payment_events_no_delete" BEFORE DELETE ON "payment_events"
  FOR EACH ROW EXECUTE FUNCTION "prevent_delete"();
CREATE TRIGGER "payment_events_no_truncate" BEFORE TRUNCATE ON "payment_events"
  FOR EACH STATEMENT EXECUTE FUNCTION "prevent_append_only_mutation"();
