-- CreateEnum
CREATE TYPE "withdrawal_method_type" AS ENUM ('mobile_money', 'bank_transfer');

-- CreateEnum
CREATE TYPE "withdrawal_status" AS ENUM ('pending', 'under_review', 'approved', 'processing', 'paid', 'rejected');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ledger_transaction_type" ADD VALUE 'withdrawal_reserve';
ALTER TYPE "ledger_transaction_type" ADD VALUE 'withdrawal_release';
ALTER TYPE "ledger_transaction_type" ADD VALUE 'withdrawal_payout';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "security_event_type" ADD VALUE 'withdrawal_requested';
ALTER TYPE "security_event_type" ADD VALUE 'withdrawal_status_changed';

-- CreateTable
CREATE TABLE "withdrawal_methods" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "withdrawal_method_type" NOT NULL,
    "country_iso2" CHAR(2) NOT NULL,
    "provider" VARCHAR(100) NOT NULL,
    "masked_account" VARCHAR(40) NOT NULL,
    "details_encrypted" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_at" TIMESTAMPTZ(3),

    CONSTRAINT "withdrawal_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "withdrawal_requests" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "method_id" UUID NOT NULL,
    "amount_usd" DECIMAL(20,6) NOT NULL,
    "status" "withdrawal_status" NOT NULL DEFAULT 'pending',
    "approved_by_id" UUID,
    "approved_at" TIMESTAMPTZ(3),
    "paid_by_id" UUID,
    "paid_at" TIMESTAMPTZ(3),
    "payout_reference" VARCHAR(120),
    "rejection_reason" VARCHAR(1000),
    "reserve_transaction_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "withdrawal_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "withdrawal_events" (
    "id" UUID NOT NULL,
    "withdrawal_id" UUID NOT NULL,
    "from_status" "withdrawal_status",
    "to_status" "withdrawal_status" NOT NULL,
    "actor_id" UUID,
    "note" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "withdrawal_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "withdrawal_commission_allocations" (
    "id" UUID NOT NULL,
    "withdrawal_id" UUID NOT NULL,
    "commission_id" UUID NOT NULL,
    "amount_usd" DECIMAL(20,6) NOT NULL,
    "released_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "withdrawal_commission_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "withdrawal_methods_user_id_archived_at_idx" ON "withdrawal_methods"("user_id", "archived_at");

-- CreateIndex
CREATE UNIQUE INDEX "withdrawal_requests_reserve_transaction_id_key" ON "withdrawal_requests"("reserve_transaction_id");

-- CreateIndex
CREATE INDEX "withdrawal_requests_user_id_created_at_idx" ON "withdrawal_requests"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "withdrawal_requests_status_created_at_idx" ON "withdrawal_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "withdrawal_events_withdrawal_id_created_at_idx" ON "withdrawal_events"("withdrawal_id", "created_at");

-- CreateIndex
CREATE INDEX "withdrawal_commission_allocations_commission_id_idx" ON "withdrawal_commission_allocations"("commission_id");

-- CreateIndex
CREATE UNIQUE INDEX "withdrawal_commission_allocations_withdrawal_id_commission__key" ON "withdrawal_commission_allocations"("withdrawal_id", "commission_id");

-- AddForeignKey
ALTER TABLE "withdrawal_methods" ADD CONSTRAINT "withdrawal_methods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_method_id_fkey" FOREIGN KEY ("method_id") REFERENCES "withdrawal_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_paid_by_id_fkey" FOREIGN KEY ("paid_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_reserve_transaction_id_fkey" FOREIGN KEY ("reserve_transaction_id") REFERENCES "ledger_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_events" ADD CONSTRAINT "withdrawal_events_withdrawal_id_fkey" FOREIGN KEY ("withdrawal_id") REFERENCES "withdrawal_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_events" ADD CONSTRAINT "withdrawal_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_commission_allocations" ADD CONSTRAINT "withdrawal_commission_allocations_withdrawal_id_fkey" FOREIGN KEY ("withdrawal_id") REFERENCES "withdrawal_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_commission_allocations" ADD CONSTRAINT "withdrawal_commission_allocations_commission_id_fkey" FOREIGN KEY ("commission_id") REFERENCES "commissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Garde-fous des retraits (audit §7).
-- ---------------------------------------------------------------------------

ALTER TABLE "withdrawal_requests"
  ADD CONSTRAINT "withdrawal_requests_amount_chk" CHECK ("amount_usd" > 0),
  -- « paid » = versement effectif : référence, date et auteur obligatoires.
  ADD CONSTRAINT "withdrawal_requests_paid_chk"
    CHECK ("status" <> 'paid' OR ("payout_reference" IS NOT NULL AND "paid_at" IS NOT NULL
                                  AND "paid_by_id" IS NOT NULL AND "approved_by_id" IS NOT NULL)),
  ADD CONSTRAINT "withdrawal_requests_rejected_chk"
    CHECK ("status" <> 'rejected' OR "rejection_reason" IS NOT NULL);

ALTER TABLE "withdrawal_commission_allocations"
  ADD CONSTRAINT "withdrawal_allocations_amount_chk" CHECK ("amount_usd" > 0);

-- Une seule demande en cours par utilisateur (les fonds sont réservés jusqu'à son issue).
CREATE UNIQUE INDEX "withdrawal_requests_one_open_idx" ON "withdrawal_requests" ("user_id")
  WHERE "status" IN ('pending', 'under_review', 'approved', 'processing');

-- Un retrait payé ou refusé est définitif ; montant, bénéficiaire et réservation sont figés.
CREATE FUNCTION "withdrawal_requests_guard"() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'withdrawal_requests : suppression interdite' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW."user_id" <> OLD."user_id" OR NEW."method_id" <> OLD."method_id"
     OR NEW."amount_usd" <> OLD."amount_usd"
     OR NEW."reserve_transaction_id" <> OLD."reserve_transaction_id" THEN
    RAISE EXCEPTION 'withdrawal_requests : montant et bénéficiaire non modifiables'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD."status" IN ('paid', 'rejected') THEN
    RAISE EXCEPTION 'withdrawal_requests : état % définitif', OLD."status"
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "withdrawal_requests_guard" BEFORE UPDATE OR DELETE ON "withdrawal_requests"
  FOR EACH ROW EXECUTE FUNCTION "withdrawal_requests_guard"();
CREATE TRIGGER "withdrawal_requests_no_truncate" BEFORE TRUNCATE ON "withdrawal_requests"
  FOR EACH STATEMENT EXECUTE FUNCTION "prevent_append_only_mutation"();

CREATE TRIGGER "withdrawal_events_append_only" BEFORE UPDATE OR DELETE ON "withdrawal_events"
  FOR EACH ROW EXECUTE FUNCTION "prevent_append_only_mutation"();
CREATE TRIGGER "withdrawal_events_no_truncate" BEFORE TRUNCATE ON "withdrawal_events"
  FOR EACH STATEMENT EXECUTE FUNCTION "prevent_append_only_mutation"();
