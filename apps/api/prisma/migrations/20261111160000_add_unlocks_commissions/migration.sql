-- CreateEnum
CREATE TYPE "commission_status" AS ENUM ('pending', 'available', 'paid', 'reversed');

-- AlterEnum
ALTER TYPE "ledger_transaction_type" ADD VALUE 'commission_accrual';

-- CreateTable
CREATE TABLE "job_unlocks" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "job_offer_id" UUID NOT NULL,
    "service" "credit_service" NOT NULL,
    "credits" INTEGER NOT NULL,
    "movement_id" UUID NOT NULL,
    "value_usd" DECIMAL(20,6) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_unlocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commissions" (
    "id" UUID NOT NULL,
    "unlock_id" UUID NOT NULL,
    "contributor_id" UUID NOT NULL,
    "job_offer_id" UUID NOT NULL,
    "base_value_usd" DECIMAL(20,6) NOT NULL,
    "rate" DECIMAL(9,6) NOT NULL,
    "amount_usd" DECIMAL(20,6) NOT NULL,
    "status" "commission_status" NOT NULL DEFAULT 'pending',
    "available_at" TIMESTAMPTZ(3),
    "reversed_at" TIMESTAMPTZ(3),
    "ledger_transaction_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_events" (
    "id" UUID NOT NULL,
    "commission_id" UUID NOT NULL,
    "from_status" "commission_status",
    "to_status" "commission_status" NOT NULL,
    "actor_id" UUID,
    "reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "job_unlocks_movement_id_key" ON "job_unlocks"("movement_id");

-- CreateIndex
CREATE INDEX "job_unlocks_user_id_created_at_idx" ON "job_unlocks"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "job_unlocks_job_offer_id_idx" ON "job_unlocks"("job_offer_id");

-- CreateIndex
CREATE UNIQUE INDEX "job_unlocks_user_id_job_offer_id_key" ON "job_unlocks"("user_id", "job_offer_id");

-- CreateIndex
CREATE UNIQUE INDEX "commissions_unlock_id_key" ON "commissions"("unlock_id");

-- CreateIndex
CREATE UNIQUE INDEX "commissions_ledger_transaction_id_key" ON "commissions"("ledger_transaction_id");

-- CreateIndex
CREATE INDEX "commissions_contributor_id_status_created_at_idx" ON "commissions"("contributor_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "commissions_job_offer_id_idx" ON "commissions"("job_offer_id");

-- CreateIndex
CREATE INDEX "commission_events_commission_id_created_at_idx" ON "commission_events"("commission_id", "created_at");

-- AddForeignKey
ALTER TABLE "job_unlocks" ADD CONSTRAINT "job_unlocks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_unlocks" ADD CONSTRAINT "job_unlocks_job_offer_id_fkey" FOREIGN KEY ("job_offer_id") REFERENCES "job_offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_unlocks" ADD CONSTRAINT "job_unlocks_movement_id_fkey" FOREIGN KEY ("movement_id") REFERENCES "credit_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_unlock_id_fkey" FOREIGN KEY ("unlock_id") REFERENCES "job_unlocks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_contributor_id_fkey" FOREIGN KEY ("contributor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_job_offer_id_fkey" FOREIGN KEY ("job_offer_id") REFERENCES "job_offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_ledger_transaction_id_fkey" FOREIGN KEY ("ledger_transaction_id") REFERENCES "ledger_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_events" ADD CONSTRAINT "commission_events_commission_id_fkey" FOREIGN KEY ("commission_id") REFERENCES "commissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_events" ADD CONSTRAINT "commission_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Garde-fous des déverrouillages et commissions.
-- ---------------------------------------------------------------------------

ALTER TABLE "job_unlocks"
  ADD CONSTRAINT "job_unlocks_amounts_chk" CHECK ("credits" > 0 AND "value_usd" >= 0),
  ADD CONSTRAINT "job_unlocks_service_chk" CHECK ("service" IN ('unlock_standard', 'unlock_premium'));

ALTER TABLE "commissions"
  ADD CONSTRAINT "commissions_amounts_chk"
    CHECK ("base_value_usd" > 0 AND "rate" > 0 AND "rate" <= 1 AND "amount_usd" > 0
           AND "amount_usd" <= "base_value_usd"),
  ADD CONSTRAINT "commissions_status_dates_chk"
    CHECK (("status" <> 'available' OR "available_at" IS NOT NULL)
           AND ("status" <> 'reversed' OR "reversed_at" IS NOT NULL));

-- Pas de commission sur ses propres achats (CLAUDE.md §10 : absence d'auto-achat).
CREATE FUNCTION "commissions_no_self_purchase"() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "job_unlocks" WHERE "id" = NEW."unlock_id" AND "user_id" = NEW."contributor_id") THEN
    RAISE EXCEPTION 'Commission refusée : le contributeur a lui-même déverrouillé l''offre'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "commissions_no_self_purchase" BEFORE INSERT ON "commissions"
  FOR EACH ROW EXECUTE FUNCTION "commissions_no_self_purchase"();

-- Une commission ne change ni de montant ni de bénéficiaire ; une commission annulée ou payée
-- ne revient jamais en arrière (correction par écriture compensatoire uniquement).
CREATE FUNCTION "commissions_guard"() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'commissions : suppression interdite' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW."unlock_id" <> OLD."unlock_id" OR NEW."contributor_id" <> OLD."contributor_id"
     OR NEW."job_offer_id" <> OLD."job_offer_id" OR NEW."base_value_usd" <> OLD."base_value_usd"
     OR NEW."rate" <> OLD."rate" OR NEW."amount_usd" <> OLD."amount_usd"
     OR NEW."ledger_transaction_id" <> OLD."ledger_transaction_id" THEN
    RAISE EXCEPTION 'commissions : montant et bénéficiaire non modifiables'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD."status" IN ('paid', 'reversed') AND NEW."status" <> OLD."status" THEN
    RAISE EXCEPTION 'commissions : état % définitif', OLD."status"
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "commissions_guard" BEFORE UPDATE OR DELETE ON "commissions"
  FOR EACH ROW EXECUTE FUNCTION "commissions_guard"();
CREATE TRIGGER "commissions_no_truncate" BEFORE TRUNCATE ON "commissions"
  FOR EACH STATEMENT EXECUTE FUNCTION "prevent_append_only_mutation"();

-- Déverrouillages et historique des commissions : ajout seul.
CREATE TRIGGER "job_unlocks_append_only" BEFORE UPDATE OR DELETE ON "job_unlocks"
  FOR EACH ROW EXECUTE FUNCTION "prevent_append_only_mutation"();
CREATE TRIGGER "job_unlocks_no_truncate" BEFORE TRUNCATE ON "job_unlocks"
  FOR EACH STATEMENT EXECUTE FUNCTION "prevent_append_only_mutation"();
CREATE TRIGGER "commission_events_append_only" BEFORE UPDATE OR DELETE ON "commission_events"
  FOR EACH ROW EXECUTE FUNCTION "prevent_append_only_mutation"();
CREATE TRIGGER "commission_events_no_truncate" BEFORE TRUNCATE ON "commission_events"
  FOR EACH STATEMENT EXECUTE FUNCTION "prevent_append_only_mutation"();
