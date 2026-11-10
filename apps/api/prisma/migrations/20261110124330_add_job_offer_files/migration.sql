-- CreateEnum
CREATE TYPE "job_offer_file_kind" AS ENUM ('original', 'attachment');

-- CreateEnum
CREATE TYPE "file_download_purpose" AS ENUM ('owner', 'moderation', 'unlock');

-- CreateTable
CREATE TABLE "job_offer_files" (
    "id" UUID NOT NULL,
    "job_offer_id" UUID NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "kind" "job_offer_file_kind" NOT NULL,
    "storage_key" VARCHAR(300) NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "job_offer_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_download_logs" (
    "id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "purpose" "file_download_purpose" NOT NULL,
    "ip" VARCHAR(45),
    "user_agent" VARCHAR(512),
    "request_id" VARCHAR(64),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_download_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "job_offer_files_storage_key_key" ON "job_offer_files"("storage_key");

-- CreateIndex
CREATE INDEX "job_offer_files_job_offer_id_deleted_at_idx" ON "job_offer_files"("job_offer_id", "deleted_at");

-- CreateIndex
CREATE INDEX "job_offer_files_sha256_idx" ON "job_offer_files"("sha256");

-- CreateIndex
CREATE INDEX "file_download_logs_file_id_created_at_idx" ON "file_download_logs"("file_id", "created_at");

-- CreateIndex
CREATE INDEX "file_download_logs_user_id_created_at_idx" ON "file_download_logs"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "job_offer_files" ADD CONSTRAINT "job_offer_files_job_offer_id_fkey" FOREIGN KEY ("job_offer_id") REFERENCES "job_offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_offer_files" ADD CONSTRAINT "job_offer_files_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_download_logs" ADD CONSTRAINT "file_download_logs_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "job_offer_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_download_logs" ADD CONSTRAINT "file_download_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "job_offer_files"
  ADD CONSTRAINT "job_offer_files_size_chk" CHECK ("size_bytes" > 0);

-- Une seule annonce originale active par offre.
CREATE UNIQUE INDEX "job_offer_files_one_original_idx"
  ON "job_offer_files" ("job_offer_id")
  WHERE "kind" = 'original' AND "deleted_at" IS NULL;

-- Journal des téléchargements : ajout seul.
CREATE TRIGGER "file_download_logs_append_only"
  BEFORE UPDATE OR DELETE ON "file_download_logs"
  FOR EACH ROW EXECUTE FUNCTION "prevent_append_only_mutation"();

CREATE TRIGGER "file_download_logs_no_truncate"
  BEFORE TRUNCATE ON "file_download_logs"
  FOR EACH STATEMENT EXECUTE FUNCTION "prevent_append_only_mutation"();
