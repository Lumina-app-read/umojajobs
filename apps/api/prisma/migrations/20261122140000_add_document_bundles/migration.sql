-- CreateEnum
CREATE TYPE "document_bundle_file_kind" AS ENUM ('pdf', 'image');

-- AlterEnum
ALTER TYPE "credit_service" ADD VALUE 'doc_bundle';

-- CreateTable
CREATE TABLE "document_bundles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "document_bundles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_bundle_files" (
    "id" UUID NOT NULL,
    "bundle_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "kind" "document_bundle_file_kind" NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "storage_key" VARCHAR(300) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "page_count" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_bundle_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_bundle_passes" (
    "id" UUID NOT NULL,
    "bundle_id" UUID NOT NULL,
    "credits" INTEGER NOT NULL,
    "movement_id" UUID NOT NULL,
    "value_usd" DECIMAL(20,6) NOT NULL,
    "valid_until" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_bundle_passes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_bundle_exports" (
    "id" UUID NOT NULL,
    "bundle_id" UUID NOT NULL,
    "pass_id" UUID NOT NULL,
    "idempotency_key" VARCHAR(100) NOT NULL,
    "charged" BOOLEAN NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "status" "career_export_status" NOT NULL DEFAULT 'pending',
    "storage_key" VARCHAR(300),
    "size_bytes" INTEGER,
    "page_count" INTEGER,
    "failure_reason" VARCHAR(120),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "document_bundle_exports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_bundles_user_id_deleted_at_updated_at_idx" ON "document_bundles"("user_id", "deleted_at", "updated_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "document_bundle_files_storage_key_key" ON "document_bundle_files"("storage_key");

-- CreateIndex
CREATE INDEX "document_bundle_files_bundle_id_position_idx" ON "document_bundle_files"("bundle_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "document_bundle_passes_movement_id_key" ON "document_bundle_passes"("movement_id");

-- CreateIndex
CREATE INDEX "document_bundle_passes_bundle_id_created_at_idx" ON "document_bundle_passes"("bundle_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "document_bundle_exports_bundle_id_created_at_idx" ON "document_bundle_exports"("bundle_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "document_bundle_exports_bundle_id_idempotency_key_key" ON "document_bundle_exports"("bundle_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "document_bundles" ADD CONSTRAINT "document_bundles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_bundle_files" ADD CONSTRAINT "document_bundle_files_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "document_bundles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_bundle_passes" ADD CONSTRAINT "document_bundle_passes_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "document_bundles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_bundle_passes" ADD CONSTRAINT "document_bundle_passes_movement_id_fkey" FOREIGN KEY ("movement_id") REFERENCES "credit_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_bundle_exports" ADD CONSTRAINT "document_bundle_exports_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "document_bundles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_bundle_exports" ADD CONSTRAINT "document_bundle_exports_pass_id_fkey" FOREIGN KEY ("pass_id") REFERENCES "document_bundle_passes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Contraintes ajoutées à la main.
ALTER TABLE "document_bundle_files" ADD CONSTRAINT "document_bundle_files_values_check"
  CHECK ("position" >= 0 AND "size_bytes" > 0 AND "page_count" >= 1);
ALTER TABLE "document_bundle_passes" ADD CONSTRAINT "document_bundle_passes_amounts_check"
  CHECK ("credits" > 0 AND "value_usd" >= 0 AND "valid_until" >= "created_at");
-- La clé d'un PDF prêt devient nulle quand l'utilisateur supprime son dossier (effacement réel).
ALTER TABLE "document_bundle_exports" ADD CONSTRAINT "document_bundle_exports_values_check"
  CHECK (("size_bytes" IS NULL OR "size_bytes" >= 0) AND ("page_count" IS NULL OR "page_count" >= 1)
    AND ("status" <> 'ready' OR "completed_at" IS NOT NULL));

-- Un paiement est une pièce comptable : ni modifié, ni supprimé.
CREATE TRIGGER "document_bundle_passes_append_only"
  BEFORE UPDATE OR DELETE ON "document_bundle_passes"
  FOR EACH ROW EXECUTE FUNCTION "prevent_append_only_mutation"();
CREATE TRIGGER "document_bundle_passes_no_truncate"
  BEFORE TRUNCATE ON "document_bundle_passes"
  FOR EACH STATEMENT EXECUTE FUNCTION "prevent_append_only_mutation"();
-- Dossiers et exports changent d'état mais ne sont jamais supprimés.
CREATE TRIGGER "document_bundles_no_delete"
  BEFORE DELETE ON "document_bundles"
  FOR EACH ROW EXECUTE FUNCTION "prevent_delete"();
CREATE TRIGGER "document_bundle_exports_no_delete"
  BEFORE DELETE ON "document_bundle_exports"
  FOR EACH ROW EXECUTE FUNCTION "prevent_delete"();
