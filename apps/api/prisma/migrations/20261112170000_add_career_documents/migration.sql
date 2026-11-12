-- CreateEnum
CREATE TYPE "career_document_type" AS ENUM ('cv', 'cover_letter', 'application_letter', 'internship_request', 'recommendation_draft', 'resignation_letter', 'follow_up_letter', 'thank_you_letter');

-- CreateTable
CREATE TABLE "career_documents" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "career_document_type" NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "language" "locale" NOT NULL,
    "template_key" VARCHAR(40) NOT NULL,
    "content" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "career_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "career_documents_user_id_deleted_at_updated_at_idx" ON "career_documents"("user_id", "deleted_at", "updated_at" DESC);

-- AddForeignKey
ALTER TABLE "career_documents" ADD CONSTRAINT "career_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "career_documents"
  ADD CONSTRAINT "career_documents_version_chk" CHECK ("version" >= 1);
