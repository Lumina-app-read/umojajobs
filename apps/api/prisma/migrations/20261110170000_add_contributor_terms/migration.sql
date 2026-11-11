-- AlterEnum
ALTER TYPE "security_event_type" ADD VALUE 'contributor_terms_accepted';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "contributor_terms_accepted_at" TIMESTAMPTZ(3),
ADD COLUMN     "contributor_terms_version" VARCHAR(32);

