-- AlterTable
ALTER TABLE "job_offers" ADD COLUMN     "search_text" TEXT,
ADD COLUMN     "slug" VARCHAR(180);

-- CreateTable
CREATE TABLE "saved_jobs" (
    "user_id" UUID NOT NULL,
    "job_offer_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_jobs_pkey" PRIMARY KEY ("user_id","job_offer_id")
);

-- CreateIndex
CREATE INDEX "saved_jobs_user_id_created_at_idx" ON "saved_jobs"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "job_offers_slug_key" ON "job_offers"("slug");

-- CreateIndex
CREATE INDEX "job_offers_status_published_at_idx" ON "job_offers"("status", "published_at" DESC);

-- CreateIndex
CREATE INDEX "job_offers_status_country_id_category_id_idx" ON "job_offers"("status", "country_id", "category_id");

-- CreateIndex
CREATE INDEX "job_offers_search_text_trgm_idx" ON "job_offers" USING GIN ("search_text" gin_trgm_ops);

-- AddForeignKey
ALTER TABLE "saved_jobs" ADD CONSTRAINT "saved_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_jobs" ADD CONSTRAINT "saved_jobs_job_offer_id_fkey" FOREIGN KEY ("job_offer_id") REFERENCES "job_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

