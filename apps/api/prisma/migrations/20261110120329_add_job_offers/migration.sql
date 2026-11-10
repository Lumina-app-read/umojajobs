-- CreateEnum
CREATE TYPE "job_offer_status" AS ENUM ('draft', 'pending_review', 'needs_correction', 'scheduled', 'active', 'expired', 'rejected', 'suspended', 'archived');

-- CreateEnum
CREATE TYPE "contract_type" AS ENUM ('permanent', 'fixed_term', 'internship', 'apprenticeship', 'freelance', 'consultancy', 'temporary', 'volunteer', 'other');

-- CreateEnum
CREATE TYPE "work_mode" AS ENUM ('on_site', 'remote', 'hybrid');

-- CreateEnum
CREATE TYPE "education_level" AS ENUM ('none', 'secondary', 'vocational', 'bachelor', 'master', 'doctorate');

-- CreateEnum
CREATE TYPE "experience_level" AS ENUM ('none', 'junior', 'intermediate', 'senior', 'expert');

-- CreateEnum
CREATE TYPE "salary_period" AS ENUM ('hour', 'day', 'month', 'year');

-- CreateEnum
CREATE TYPE "job_source_type" AS ENUM ('company_website', 'whatsapp', 'facebook', 'telegram', 'linkedin', 'newspaper', 'other_website', 'other');

-- CreateTable
CREATE TABLE "job_categories" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "name_fr" VARCHAR(120) NOT NULL,
    "name_en" VARCHAR(120) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "job_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_offers" (
    "id" UUID NOT NULL,
    "contributor_id" UUID NOT NULL,
    "status" "job_offer_status" NOT NULL DEFAULT 'draft',
    "title" VARCHAR(200),
    "company_name" VARCHAR(200),
    "country_id" UUID,
    "city_id" UUID,
    "category_id" UUID,
    "contract_type" "contract_type",
    "work_mode" "work_mode",
    "education_level" "education_level",
    "experience_level" "experience_level",
    "salary_min" DECIMAL(14,2),
    "salary_max" DECIMAL(14,2),
    "salary_currency" CHAR(3),
    "salary_period" "salary_period",
    "description" TEXT,
    "requirements" TEXT,
    "skills" VARCHAR(80)[] DEFAULT ARRAY[]::VARCHAR(80)[],
    "content_language" "locale",
    "start_date" DATE,
    "end_date" DATE,
    "timezone" VARCHAR(64),
    "starts_at" TIMESTAMPTZ(3),
    "ends_at" TIMESTAMPTZ(3),
    "source_type" "job_source_type",
    "source_url" VARCHAR(2048),
    "source_details" VARCHAR(300),
    "application_instructions" TEXT,
    "application_email" CITEXT,
    "application_url" VARCHAR(2048),
    "application_address" VARCHAR(500),
    "duplicate_key" CHAR(64),
    "declaration_accepted_at" TIMESTAMPTZ(3),
    "submitted_at" TIMESTAMPTZ(3),
    "reviewed_at" TIMESTAMPTZ(3),
    "reviewed_by_id" UUID,
    "published_at" TIMESTAMPTZ(3),
    "expired_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "job_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_offer_status_history" (
    "id" UUID NOT NULL,
    "job_offer_id" UUID NOT NULL,
    "from_status" "job_offer_status",
    "to_status" "job_offer_status" NOT NULL,
    "actor_id" UUID,
    "actor_roles" VARCHAR(32)[] DEFAULT ARRAY[]::VARCHAR(32)[],
    "reason" TEXT,
    "ip" VARCHAR(45),
    "user_agent" VARCHAR(512),
    "request_id" VARCHAR(64),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_offer_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_offer_revisions" (
    "id" UUID NOT NULL,
    "job_offer_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "author_id" UUID NOT NULL,
    "snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_offer_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "job_categories_slug_key" ON "job_categories"("slug");

-- CreateIndex
CREATE INDEX "job_offers_contributor_id_created_at_idx" ON "job_offers"("contributor_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "job_offers_status_submitted_at_idx" ON "job_offers"("status", "submitted_at");

-- CreateIndex
CREATE INDEX "job_offers_status_starts_at_idx" ON "job_offers"("status", "starts_at");

-- CreateIndex
CREATE INDEX "job_offers_status_ends_at_idx" ON "job_offers"("status", "ends_at");

-- CreateIndex
CREATE INDEX "job_offers_duplicate_key_idx" ON "job_offers"("duplicate_key");

-- CreateIndex
CREATE INDEX "job_offers_source_url_idx" ON "job_offers"("source_url");

-- CreateIndex
CREATE INDEX "job_offer_status_history_job_offer_id_created_at_idx" ON "job_offer_status_history"("job_offer_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "job_offer_revisions_job_offer_id_number_key" ON "job_offer_revisions"("job_offer_id", "number");

-- AddForeignKey
ALTER TABLE "job_offers" ADD CONSTRAINT "job_offers_contributor_id_fkey" FOREIGN KEY ("contributor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_offers" ADD CONSTRAINT "job_offers_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_offers" ADD CONSTRAINT "job_offers_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_offers" ADD CONSTRAINT "job_offers_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_offers" ADD CONSTRAINT "job_offers_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "job_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_offer_status_history" ADD CONSTRAINT "job_offer_status_history_job_offer_id_fkey" FOREIGN KEY ("job_offer_id") REFERENCES "job_offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_offer_status_history" ADD CONSTRAINT "job_offer_status_history_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_offer_revisions" ADD CONSTRAINT "job_offer_revisions_job_offer_id_fkey" FOREIGN KEY ("job_offer_id") REFERENCES "job_offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_offer_revisions" ADD CONSTRAINT "job_offer_revisions_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Cohérence des données (en plus de la validation de l'API).
ALTER TABLE "job_offers"
  ADD CONSTRAINT "job_offers_dates_chk" CHECK ("end_date" IS NULL OR "start_date" IS NULL OR "end_date" >= "start_date"),
  ADD CONSTRAINT "job_offers_salary_chk" CHECK ("salary_max" IS NULL OR "salary_min" IS NULL OR "salary_max" >= "salary_min"),
  ADD CONSTRAINT "job_offers_salary_positive_chk" CHECK (("salary_min" IS NULL OR "salary_min" >= 0) AND ("salary_max" IS NULL OR "salary_max" >= 0)),
  ADD CONSTRAINT "job_offers_version_chk" CHECK ("version" >= 1);

ALTER TABLE "job_offer_revisions"
  ADD CONSTRAINT "job_offer_revisions_number_chk" CHECK ("number" >= 1);

-- Historique des statuts et versions soumises : ajout seul, comme le journal de sécurité.
CREATE FUNCTION "prevent_append_only_mutation"() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% est en ajout seul (% interdit)', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER "job_offer_status_history_append_only"
  BEFORE UPDATE OR DELETE ON "job_offer_status_history"
  FOR EACH ROW EXECUTE FUNCTION "prevent_append_only_mutation"();

CREATE TRIGGER "job_offer_status_history_no_truncate"
  BEFORE TRUNCATE ON "job_offer_status_history"
  FOR EACH STATEMENT EXECUTE FUNCTION "prevent_append_only_mutation"();

CREATE TRIGGER "job_offer_revisions_append_only"
  BEFORE UPDATE OR DELETE ON "job_offer_revisions"
  FOR EACH ROW EXECUTE FUNCTION "prevent_append_only_mutation"();

CREATE TRIGGER "job_offer_revisions_no_truncate"
  BEFORE TRUNCATE ON "job_offer_revisions"
  FOR EACH STATEMENT EXECUTE FUNCTION "prevent_append_only_mutation"();
