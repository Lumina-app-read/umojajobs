-- DropIndex
DROP INDEX "career_document_passes_movement_id_key";

-- AlterTable
ALTER TABLE "career_document_passes" ADD COLUMN     "pack_id" UUID;

-- CreateTable
CREATE TABLE "career_document_packs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "idempotency_key" VARCHAR(100) NOT NULL,
    "credits" INTEGER NOT NULL,
    "movement_id" UUID NOT NULL,
    "value_usd" DECIMAL(20,6) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "career_document_packs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "career_document_packs_movement_id_key" ON "career_document_packs"("movement_id");

-- CreateIndex
CREATE UNIQUE INDEX "career_document_packs_user_id_idempotency_key_key" ON "career_document_packs"("user_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "career_document_exports_user_id_created_at_idx" ON "career_document_exports"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "career_document_passes_pack_id_idx" ON "career_document_passes"("pack_id");

-- CreateIndex
CREATE UNIQUE INDEX "career_document_passes_movement_id_document_id_key" ON "career_document_passes"("movement_id", "document_id");

-- AddForeignKey
ALTER TABLE "career_document_passes" ADD CONSTRAINT "career_document_passes_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "career_document_packs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "career_document_packs" ADD CONSTRAINT "career_document_packs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "career_document_packs" ADD CONSTRAINT "career_document_packs_movement_id_fkey" FOREIGN KEY ("movement_id") REFERENCES "credit_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Contraintes ajoutées à la main.
-- Hors pack, un débit ne paie qu'un seul document (règle d'origine conservée).
CREATE UNIQUE INDEX "career_document_passes_single_movement_key"
  ON "career_document_passes"("movement_id") WHERE "pack_id" IS NULL;
ALTER TABLE "career_document_packs" ADD CONSTRAINT "career_document_packs_amounts_check"
  CHECK ("credits" >= 2 AND "value_usd" >= 0);

-- Un paiement est une pièce comptable : ni modifié, ni supprimé.
CREATE TRIGGER "career_document_packs_append_only"
  BEFORE UPDATE OR DELETE ON "career_document_packs"
  FOR EACH ROW EXECUTE FUNCTION "prevent_append_only_mutation"();
CREATE TRIGGER "career_document_packs_no_truncate"
  BEFORE TRUNCATE ON "career_document_packs"
  FOR EACH STATEMENT EXECUTE FUNCTION "prevent_append_only_mutation"();
