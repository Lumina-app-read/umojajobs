-- CreateEnum
CREATE TYPE "career_export_status" AS ENUM ('pending', 'ready', 'failed');

-- AlterEnum
ALTER TYPE "financial_setting_key" ADD VALUE 'studio_reexport_window_days';

-- CreateTable
CREATE TABLE "career_document_passes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "service" "credit_service" NOT NULL,
    "credits" INTEGER NOT NULL,
    "movement_id" UUID NOT NULL,
    "value_usd" DECIMAL(20,6) NOT NULL,
    "valid_until" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "career_document_passes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "career_document_exports" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "pass_id" UUID NOT NULL,
    "idempotency_key" VARCHAR(100) NOT NULL,
    "charged" BOOLEAN NOT NULL,
    "template_key" VARCHAR(40) NOT NULL,
    "language" "locale" NOT NULL,
    "document_version" INTEGER NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "content" JSONB NOT NULL,
    "status" "career_export_status" NOT NULL DEFAULT 'pending',
    "storage_key" VARCHAR(300),
    "size_bytes" INTEGER,
    "failure_reason" VARCHAR(120),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "career_document_exports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "career_document_passes_movement_id_key" ON "career_document_passes"("movement_id");

-- CreateIndex
CREATE INDEX "career_document_passes_document_id_valid_until_idx" ON "career_document_passes"("document_id", "valid_until" DESC);

-- CreateIndex
CREATE INDEX "career_document_exports_document_id_created_at_idx" ON "career_document_exports"("document_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "career_document_exports_user_id_idempotency_key_key" ON "career_document_exports"("user_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "career_document_passes" ADD CONSTRAINT "career_document_passes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "career_document_passes" ADD CONSTRAINT "career_document_passes_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "career_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "career_document_passes" ADD CONSTRAINT "career_document_passes_movement_id_fkey" FOREIGN KEY ("movement_id") REFERENCES "credit_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "career_document_exports" ADD CONSTRAINT "career_document_exports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "career_document_exports" ADD CONSTRAINT "career_document_exports_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "career_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "career_document_exports" ADD CONSTRAINT "career_document_exports_pass_id_fkey" FOREIGN KEY ("pass_id") REFERENCES "career_document_passes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Contraintes ajoutées à la main.
ALTER TABLE "career_document_passes" ADD CONSTRAINT "career_document_passes_amounts_check"
  CHECK ("credits" > 0 AND "value_usd" >= 0 AND "valid_until" >= "created_at");
ALTER TABLE "career_document_exports" ADD CONSTRAINT "career_document_exports_values_check"
  CHECK ("document_version" >= 1 AND ("size_bytes" IS NULL OR "size_bytes" >= 0)
    AND ("status" <> 'ready' OR ("storage_key" IS NOT NULL AND "completed_at" IS NOT NULL)));

-- Un paiement est une pièce comptable : ni modifié, ni supprimé.
CREATE TRIGGER "career_document_passes_append_only"
  BEFORE UPDATE OR DELETE ON "career_document_passes"
  FOR EACH ROW EXECUTE FUNCTION "prevent_append_only_mutation"();
CREATE TRIGGER "career_document_passes_no_truncate"
  BEFORE TRUNCATE ON "career_document_passes"
  FOR EACH STATEMENT EXECUTE FUNCTION "prevent_append_only_mutation"();

-- Les exports changent d'état (en cours, prêt, échec) mais ne sont jamais supprimés.
CREATE TRIGGER "career_document_exports_no_delete"
  BEFORE DELETE ON "career_document_exports"
  FOR EACH ROW EXECUTE FUNCTION "prevent_delete"();
