-- AlterEnum
ALTER TYPE "security_event_type" ADD VALUE 'candidate_terms_accepted';

-- AlterTable
ALTER TABLE "job_offers" ADD COLUMN     "application_phone" VARCHAR(16),
ADD COLUMN     "contributor_tips" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "candidate_terms_accepted_at" TIMESTAMPTZ(3),
ADD COLUMN     "candidate_terms_version" VARCHAR(32);


-- Numéro de contact au format international E.164 (même règle que le téléphone du profil).
ALTER TABLE "job_offers"
  ADD CONSTRAINT "job_offers_application_phone_chk"
    CHECK ("application_phone" IS NULL OR "application_phone" ~ '^\+[1-9][0-9]{7,14}$');
