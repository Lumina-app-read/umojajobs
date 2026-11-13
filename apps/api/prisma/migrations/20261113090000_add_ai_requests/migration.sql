-- CreateEnum
CREATE TYPE "ai_request_status" AS ENUM ('succeeded', 'rejected', 'failed');

-- CreateTable
CREATE TABLE "ai_requests" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "document_id" UUID,
    "feature" VARCHAR(40) NOT NULL,
    "model" VARCHAR(80) NOT NULL,
    "status" "ai_request_status" NOT NULL,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "latency_ms" INTEGER NOT NULL,
    "error_code" VARCHAR(60),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_requests_user_id_created_at_idx" ON "ai_requests"("user_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Contraintes ajoutées à la main.
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_tokens_check"
  CHECK (("input_tokens" IS NULL OR "input_tokens" >= 0) AND ("output_tokens" IS NULL OR "output_tokens" >= 0) AND "latency_ms" >= 0);

-- Journal en ajout seul : il sert de base au quota quotidien.
CREATE TRIGGER "ai_requests_append_only"
  BEFORE UPDATE OR DELETE ON "ai_requests"
  FOR EACH ROW EXECUTE FUNCTION "prevent_append_only_mutation"();
CREATE TRIGGER "ai_requests_no_truncate"
  BEFORE TRUNCATE ON "ai_requests"
  FOR EACH STATEMENT EXECUTE FUNCTION "prevent_append_only_mutation"();
