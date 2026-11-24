-- CreateEnum
CREATE TYPE "audit_result" AS ENUM ('success', 'denied', 'rejected', 'error');

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "actor_roles" TEXT[],
    "method" VARCHAR(10) NOT NULL,
    "route" VARCHAR(200) NOT NULL,
    "path" VARCHAR(300) NOT NULL,
    "target_id" VARCHAR(100),
    "status_code" INTEGER NOT NULL,
    "result" "audit_result" NOT NULL,
    "ip" VARCHAR(45),
    "user_agent" VARCHAR(512),
    "request_id" VARCHAR(64) NOT NULL,
    "input" JSONB,
    "changes" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_id_idx" ON "audit_logs"("actor_id", "id" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_result_id_idx" ON "audit_logs"("result", "id" DESC);

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Contraintes ajoutées à la main : le journal d'audit est en ajout seul.
CREATE TRIGGER "audit_logs_append_only"
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION "prevent_append_only_mutation"();
CREATE TRIGGER "audit_logs_no_truncate"
  BEFORE TRUNCATE ON "audit_logs"
  FOR EACH STATEMENT EXECUTE FUNCTION "prevent_append_only_mutation"();
