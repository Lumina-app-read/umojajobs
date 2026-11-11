-- CreateEnum
CREATE TYPE "financial_setting_key" AS ENUM ('credit_unit_value_usd', 'contributor_commission_rate', 'withdrawal_min_usd', 'commission_hold_days', 'commission_hold_days_new_contributor', 'new_contributor_period_days', 'withdrawal_dual_approval_usd');

-- CreateEnum
CREATE TYPE "credit_service" AS ENUM ('unlock_standard', 'unlock_premium', 'doc_cv', 'doc_cover_letter', 'doc_application_letter', 'doc_pack');

-- CreateEnum
CREATE TYPE "credit_lot_origin" AS ENUM ('purchase', 'grant', 'adjustment');

-- CreateEnum
CREATE TYPE "credit_movement_type" AS ENUM ('purchase', 'consume', 'refund', 'expire', 'grant', 'adjust');

-- CreateEnum
CREATE TYPE "ledger_account_type" AS ENUM ('asset', 'liability', 'revenue', 'expense');

-- CreateEnum
CREATE TYPE "ledger_transaction_type" AS ENUM ('credit_grant', 'credit_consumption');

-- CreateTable
CREATE TABLE "financial_settings" (
    "id" UUID NOT NULL,
    "key" "financial_setting_key" NOT NULL,
    "value" DECIMAL(20,6) NOT NULL,
    "effective_from" TIMESTAMPTZ(3) NOT NULL,
    "changed_by_id" UUID,
    "reason" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_credit_costs" (
    "id" UUID NOT NULL,
    "service" "credit_service" NOT NULL,
    "credits" INTEGER NOT NULL,
    "effective_from" TIMESTAMPTZ(3) NOT NULL,
    "changed_by_id" UUID,
    "reason" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_credit_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "credit_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_lots" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "origin" "credit_lot_origin" NOT NULL,
    "credits_total" INTEGER NOT NULL,
    "credits_remaining" INTEGER NOT NULL,
    "credit_unit_value_usd" DECIMAL(20,6) NOT NULL,
    "commissionable" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_movements" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "type" "credit_movement_type" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "idempotency_key" VARCHAR(200) NOT NULL,
    "reference_type" VARCHAR(50),
    "reference_id" UUID,
    "actor_id" UUID,
    "reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_lot_allocations" (
    "id" UUID NOT NULL,
    "movement_id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "credits" INTEGER NOT NULL,
    "value_usd" DECIMAL(20,6) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_lot_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_accounts" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "type" "ledger_account_type" NOT NULL,
    "owner_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_transactions" (
    "id" UUID NOT NULL,
    "type" "ledger_transaction_type" NOT NULL,
    "reference_type" VARCHAR(50),
    "reference_id" UUID,
    "idempotency_key" VARCHAR(200) NOT NULL,
    "reverses_transaction_id" UUID,
    "actor_id" UUID,
    "reason" VARCHAR(500),
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "debit" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "credit" DECIMAL(20,6) NOT NULL DEFAULT 0,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "financial_settings_key_effective_from_idx" ON "financial_settings"("key", "effective_from" DESC);

-- CreateIndex
CREATE INDEX "service_credit_costs_service_effective_from_idx" ON "service_credit_costs"("service", "effective_from" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "credit_accounts_user_id_key" ON "credit_accounts"("user_id");

-- CreateIndex
CREATE INDEX "credit_lots_account_id_created_at_idx" ON "credit_lots"("account_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "credit_movements_idempotency_key_key" ON "credit_movements"("idempotency_key");

-- CreateIndex
CREATE INDEX "credit_movements_account_id_created_at_idx" ON "credit_movements"("account_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "credit_lot_allocations_lot_id_idx" ON "credit_lot_allocations"("lot_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_lot_allocations_movement_id_lot_id_key" ON "credit_lot_allocations"("movement_id", "lot_id");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_accounts_code_key" ON "ledger_accounts"("code");

-- CreateIndex
CREATE INDEX "ledger_accounts_owner_user_id_idx" ON "ledger_accounts"("owner_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_transactions_idempotency_key_key" ON "ledger_transactions"("idempotency_key");

-- CreateIndex
CREATE INDEX "ledger_transactions_reference_type_reference_id_idx" ON "ledger_transactions"("reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "ledger_entries_transaction_id_idx" ON "ledger_entries"("transaction_id");

-- CreateIndex
CREATE INDEX "ledger_entries_account_id_idx" ON "ledger_entries"("account_id");

-- AddForeignKey
ALTER TABLE "financial_settings" ADD CONSTRAINT "financial_settings_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_credit_costs" ADD CONSTRAINT "service_credit_costs_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_accounts" ADD CONSTRAINT "credit_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_lots" ADD CONSTRAINT "credit_lots_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "credit_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_movements" ADD CONSTRAINT "credit_movements_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "credit_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_movements" ADD CONSTRAINT "credit_movements_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_lot_allocations" ADD CONSTRAINT "credit_lot_allocations_movement_id_fkey" FOREIGN KEY ("movement_id") REFERENCES "credit_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_lot_allocations" ADD CONSTRAINT "credit_lot_allocations_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "credit_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_reverses_transaction_id_fkey" FOREIGN KEY ("reverses_transaction_id") REFERENCES "ledger_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "ledger_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Garde-fous financiers (CLAUDE.md §16) : contrôles, ajout seul, équilibre comptable.
-- ---------------------------------------------------------------------------

ALTER TABLE "financial_settings"
  ADD CONSTRAINT "financial_settings_value_chk" CHECK ("value" >= 0);
ALTER TABLE "service_credit_costs"
  ADD CONSTRAINT "service_credit_costs_credits_chk" CHECK ("credits" > 0);
ALTER TABLE "credit_accounts"
  ADD CONSTRAINT "credit_accounts_balance_chk" CHECK ("balance" >= 0);
ALTER TABLE "credit_lots"
  ADD CONSTRAINT "credit_lots_credits_chk"
    CHECK ("credits_total" > 0 AND "credits_remaining" >= 0 AND "credits_remaining" <= "credits_total"),
  ADD CONSTRAINT "credit_lots_unit_value_chk" CHECK ("credit_unit_value_usd" > 0),
  -- Seule une recharge payée peut ouvrir droit à commission (arbitrage A2).
  ADD CONSTRAINT "credit_lots_commissionable_chk" CHECK (NOT "commissionable" OR "origin" = 'purchase');
ALTER TABLE "credit_movements"
  ADD CONSTRAINT "credit_movements_quantity_chk" CHECK ("quantity" <> 0),
  ADD CONSTRAINT "credit_movements_balance_chk" CHECK ("balance_after" >= 0);
ALTER TABLE "credit_lot_allocations"
  ADD CONSTRAINT "credit_lot_allocations_chk" CHECK ("credits" > 0 AND "value_usd" >= 0);
ALTER TABLE "ledger_entries"
  ADD CONSTRAINT "ledger_entries_one_side_chk"
    CHECK (("debit" > 0 AND "credit" = 0) OR ("credit" > 0 AND "debit" = 0));
ALTER TABLE "ledger_transactions"
  ADD CONSTRAINT "ledger_transactions_not_self_reversal_chk"
    CHECK ("reverses_transaction_id" IS NULL OR "reverses_transaction_id" <> "id");

-- Une transaction ne peut être annulée qu'une seule fois.
CREATE UNIQUE INDEX "ledger_transactions_reverses_once_idx"
  ON "ledger_transactions" ("reverses_transaction_id")
  WHERE "reverses_transaction_id" IS NOT NULL;

-- Registres en ajout seul : historique des paramètres, mouvements, affectations et grand livre.
CREATE TRIGGER "financial_settings_append_only" BEFORE UPDATE OR DELETE ON "financial_settings"
  FOR EACH ROW EXECUTE FUNCTION "prevent_append_only_mutation"();
CREATE TRIGGER "financial_settings_no_truncate" BEFORE TRUNCATE ON "financial_settings"
  FOR EACH STATEMENT EXECUTE FUNCTION "prevent_append_only_mutation"();
CREATE TRIGGER "service_credit_costs_append_only" BEFORE UPDATE OR DELETE ON "service_credit_costs"
  FOR EACH ROW EXECUTE FUNCTION "prevent_append_only_mutation"();
CREATE TRIGGER "service_credit_costs_no_truncate" BEFORE TRUNCATE ON "service_credit_costs"
  FOR EACH STATEMENT EXECUTE FUNCTION "prevent_append_only_mutation"();
CREATE TRIGGER "credit_movements_append_only" BEFORE UPDATE OR DELETE ON "credit_movements"
  FOR EACH ROW EXECUTE FUNCTION "prevent_append_only_mutation"();
CREATE TRIGGER "credit_movements_no_truncate" BEFORE TRUNCATE ON "credit_movements"
  FOR EACH STATEMENT EXECUTE FUNCTION "prevent_append_only_mutation"();
CREATE TRIGGER "credit_lot_allocations_append_only" BEFORE UPDATE OR DELETE ON "credit_lot_allocations"
  FOR EACH ROW EXECUTE FUNCTION "prevent_append_only_mutation"();
CREATE TRIGGER "credit_lot_allocations_no_truncate" BEFORE TRUNCATE ON "credit_lot_allocations"
  FOR EACH STATEMENT EXECUTE FUNCTION "prevent_append_only_mutation"();
CREATE TRIGGER "ledger_transactions_append_only" BEFORE UPDATE OR DELETE ON "ledger_transactions"
  FOR EACH ROW EXECUTE FUNCTION "prevent_append_only_mutation"();
CREATE TRIGGER "ledger_transactions_no_truncate" BEFORE TRUNCATE ON "ledger_transactions"
  FOR EACH STATEMENT EXECUTE FUNCTION "prevent_append_only_mutation"();
CREATE TRIGGER "ledger_entries_append_only" BEFORE UPDATE OR DELETE ON "ledger_entries"
  FOR EACH ROW EXECUTE FUNCTION "prevent_append_only_mutation"();
CREATE TRIGGER "ledger_entries_no_truncate" BEFORE TRUNCATE ON "ledger_entries"
  FOR EACH STATEMENT EXECUTE FUNCTION "prevent_append_only_mutation"();

-- Le compte d'un lot ne change jamais ; seul le reste disponible évolue, et uniquement à la baisse
-- hors remboursement (géré par écriture dédiée dans une phase ultérieure).
CREATE FUNCTION "credit_lots_guard"() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'credit_lots : suppression interdite' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW."account_id" <> OLD."account_id" OR NEW."origin" <> OLD."origin"
     OR NEW."credits_total" <> OLD."credits_total"
     OR NEW."credit_unit_value_usd" <> OLD."credit_unit_value_usd"
     OR NEW."commissionable" <> OLD."commissionable"
     OR NEW."created_at" <> OLD."created_at" THEN
    RAISE EXCEPTION 'credit_lots : seul credits_remaining est modifiable'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "credit_lots_guard" BEFORE UPDATE OR DELETE ON "credit_lots"
  FOR EACH ROW EXECUTE FUNCTION "credit_lots_guard"();
CREATE TRIGGER "credit_lots_no_truncate" BEFORE TRUNCATE ON "credit_lots"
  FOR EACH STATEMENT EXECUTE FUNCTION "prevent_append_only_mutation"();

-- Partie double : chaque transaction comporte au moins deux lignes et s'équilibre exactement.
-- Contrôle différé à la validation de la transaction SQL (les lignes sont insérées après l'en-tête).
CREATE FUNCTION "ledger_assert_balanced"() RETURNS trigger
  LANGUAGE plpgsql AS $$
DECLARE
  tx_id uuid;
  lines integer;
  total_debit numeric;
  total_credit numeric;
BEGIN
  tx_id := CASE WHEN TG_TABLE_NAME = 'ledger_transactions' THEN NEW."id" ELSE NEW."transaction_id" END;
  SELECT count(*), coalesce(sum("debit"), 0), coalesce(sum("credit"), 0)
    INTO lines, total_debit, total_credit
    FROM "ledger_entries" WHERE "transaction_id" = tx_id;
  IF lines < 2 OR total_debit <> total_credit THEN
    RAISE EXCEPTION 'Transaction comptable % déséquilibrée (% lignes, débit %, crédit %)',
      tx_id, lines, total_debit, total_credit
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "ledger_transactions_balanced"
  AFTER INSERT ON "ledger_transactions"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "ledger_assert_balanced"();

CREATE CONSTRAINT TRIGGER "ledger_entries_balanced"
  AFTER INSERT ON "ledger_entries"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "ledger_assert_balanced"();
