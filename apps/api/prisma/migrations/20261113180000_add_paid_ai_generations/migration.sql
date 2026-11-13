-- CreateEnum
CREATE TYPE "ai_generation_action" AS ENUM ('generate', 'regenerate_section', 'improve');

-- CreateEnum
CREATE TYPE "ai_generation_status" AS ENUM ('pending', 'succeeded', 'failed');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "credit_service" ADD VALUE 'ai_generate_cv';
ALTER TYPE "credit_service" ADD VALUE 'ai_generate_cover_letter';
ALTER TYPE "credit_service" ADD VALUE 'ai_generate_application_letter';
ALTER TYPE "credit_service" ADD VALUE 'ai_generate_internship_request';
ALTER TYPE "credit_service" ADD VALUE 'ai_generate_recommendation';
ALTER TYPE "credit_service" ADD VALUE 'ai_generate_resignation';
ALTER TYPE "credit_service" ADD VALUE 'ai_generate_follow_up';
ALTER TYPE "credit_service" ADD VALUE 'ai_generate_thank_you';
ALTER TYPE "credit_service" ADD VALUE 'ai_regenerate_section';
ALTER TYPE "credit_service" ADD VALUE 'ai_improve_text';

-- AlterEnum
ALTER TYPE "ledger_transaction_type" ADD VALUE 'credit_refund';

-- AlterTable
ALTER TABLE "ai_requests" ADD COLUMN     "document_type" "career_document_type",
ADD COLUMN     "estimated_cost_usd" DECIMAL(20,8),
ADD COLUMN     "generation_id" UUID;

-- AlterTable
ALTER TABLE "career_documents" ADD COLUMN     "brief" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "ai_generations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "document_type" "career_document_type" NOT NULL,
    "action" "ai_generation_action" NOT NULL,
    "section" VARCHAR(60),
    "idempotency_key" VARCHAR(100) NOT NULL,
    "service" "credit_service" NOT NULL,
    "credits" INTEGER NOT NULL,
    "charge_movement_id" UUID NOT NULL,
    "refund_movement_id" UUID,
    "status" "ai_generation_status" NOT NULL DEFAULT 'pending',
    "result" JSONB,
    "failure_code" VARCHAR(60),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "ai_generations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_generations_charge_movement_id_key" ON "ai_generations"("charge_movement_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_generations_refund_movement_id_key" ON "ai_generations"("refund_movement_id");

-- CreateIndex
CREATE INDEX "ai_generations_status_created_at_idx" ON "ai_generations"("status", "created_at");

-- CreateIndex
CREATE INDEX "ai_generations_created_at_idx" ON "ai_generations"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "ai_generations_user_id_idempotency_key_key" ON "ai_generations"("user_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_generation_id_fkey" FOREIGN KEY ("generation_id") REFERENCES "ai_generations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "career_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_charge_movement_id_fkey" FOREIGN KEY ("charge_movement_id") REFERENCES "credit_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_refund_movement_id_fkey" FOREIGN KEY ("refund_movement_id") REFERENCES "credit_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Contraintes ajoutées à la main.
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_values_check" CHECK (
  "credits" > 0
  -- Une génération échouée est toujours remboursée ; une génération réussie ne l'est jamais.
  AND ("status" <> 'failed' OR "refund_movement_id" IS NOT NULL)
  AND ("status" <> 'succeeded' OR ("refund_movement_id" IS NULL AND "result" IS NOT NULL))
  AND ("status" = 'pending' OR "completed_at" IS NOT NULL)
);
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_cost_check"
  CHECK ("estimated_cost_usd" IS NULL OR "estimated_cost_usd" >= 0);

-- Une seule génération en cours par document : deux clics ou deux onglets ne lancent
-- jamais deux appels facturés en parallèle.
CREATE UNIQUE INDEX "ai_generations_one_pending_per_document"
  ON "ai_generations" ("document_id") WHERE "status" = 'pending';

-- Pièce comptable : une génération change d'état mais n'est jamais supprimée.
CREATE TRIGGER "ai_generations_no_delete" BEFORE DELETE ON "ai_generations"
  FOR EACH ROW EXECUTE FUNCTION "prevent_delete"();
CREATE TRIGGER "ai_generations_no_truncate" BEFORE TRUNCATE ON "ai_generations"
  FOR EACH STATEMENT EXECUTE FUNCTION "prevent_append_only_mutation"();
