-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('offer_submitted', 'offer_approved', 'offer_correction_requested', 'offer_rejected', 'offer_suspended', 'offer_unlocked', 'commission_earned', 'commission_available', 'credits_purchased', 'withdrawal_updated', 'account_suspended');

-- CreateEnum
CREATE TYPE "notification_email_status" AS ENUM ('pending', 'sending', 'sent', 'failed', 'skipped');

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "notification_type" NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "link" VARCHAR(300),
    "dedupe_key" VARCHAR(200) NOT NULL,
    "read_at" TIMESTAMPTZ(3),
    "email_status" "notification_email_status" NOT NULL DEFAULT 'pending',
    "email_attempts" INTEGER NOT NULL DEFAULT 0,
    "email_next_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email_sent_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notifications_dedupe_key_key" ON "notifications"("dedupe_key");

-- CreateIndex
CREATE INDEX "notifications_user_id_id_idx" ON "notifications"("user_id", "id" DESC);

-- CreateIndex
CREATE INDEX "notifications_email_status_email_next_at_idx" ON "notifications"("email_status", "email_next_at");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

