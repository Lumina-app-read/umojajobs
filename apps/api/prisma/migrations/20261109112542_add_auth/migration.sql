-- Phase 1c : identité, sessions, rôles, permissions et journal de sécurité.
-- Adresses email insensibles à la casse.
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('active', 'suspended');

-- CreateEnum
CREATE TYPE "locale" AS ENUM ('fr', 'en');

-- CreateEnum
CREATE TYPE "theme_preference" AS ENUM ('light', 'dark', 'system');

-- CreateEnum
CREATE TYPE "role_code" AS ENUM ('user', 'moderator', 'admin', 'super_admin');

-- CreateEnum
CREATE TYPE "verification_token_type" AS ENUM ('email_verification', 'password_reset');

-- CreateEnum
CREATE TYPE "security_event_type" AS ENUM ('user_registered', 'registration_attempt_existing_email', 'email_verification_sent', 'email_verified', 'login_succeeded', 'login_failed', 'account_locked', 'logout', 'logout_all', 'session_revoked', 'password_reset_requested', 'password_reset_completed', 'password_changed', 'mfa_enrollment_started', 'mfa_enabled', 'mfa_verified', 'mfa_failed', 'mfa_recovery_code_used', 'role_granted', 'role_revoked');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "country_id" UUID NOT NULL,
    "phone_e164" VARCHAR(16),
    "locale" "locale" NOT NULL DEFAULT 'fr',
    "theme" "theme_preference" NOT NULL DEFAULT 'system',
    "status" "user_status" NOT NULL DEFAULT 'active',
    "email_verified_at" TIMESTAMPTZ(3),
    "terms_accepted_at" TIMESTAMPTZ(3) NOT NULL,
    "terms_version" VARCHAR(32) NOT NULL,
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(3),
    "last_login_at" TIMESTAMPTZ(3),
    "totp_secret_encrypted" VARCHAR(255),
    "totp_pending_secret_encrypted" VARCHAR(255),
    "totp_enabled_at" TIMESTAMPTZ(3),
    "totp_last_used_step" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "code" "role_code" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by_id" UUID,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "ip" VARCHAR(45),
    "user_agent" VARCHAR(512),
    "mfa_required" BOOLEAN NOT NULL DEFAULT false,
    "mfa_verified_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "revoked_reason" VARCHAR(50),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "verification_token_type" NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mfa_recovery_codes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "code_hash" CHAR(64) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mfa_recovery_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_events" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "type" "security_event_type" NOT NULL,
    "ip" VARCHAR(45),
    "user_agent" VARCHAR(512),
    "request_id" VARCHAR(64),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_country_id_idx" ON "users"("country_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_revoked_at_idx" ON "sessions"("user_id", "revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_hash_key" ON "verification_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "verification_tokens_user_id_type_idx" ON "verification_tokens"("user_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "mfa_recovery_codes_user_id_code_hash_key" ON "mfa_recovery_codes"("user_id", "code_hash");

-- CreateIndex
CREATE INDEX "security_events_user_id_created_at_idx" ON "security_events"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "security_events_type_created_at_idx" ON "security_events"("type", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mfa_recovery_codes" ADD CONSTRAINT "mfa_recovery_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Contraintes d'intégrité complémentaires (non modélisées par Prisma).
ALTER TABLE "users"
  ADD CONSTRAINT "users_email_format_chk" CHECK ("email" ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' AND length("email") <= 254),
  ADD CONSTRAINT "users_first_name_not_blank_chk" CHECK (length(btrim("first_name")) > 0),
  ADD CONSTRAINT "users_last_name_not_blank_chk" CHECK (length(btrim("last_name")) > 0),
  ADD CONSTRAINT "users_phone_e164_chk" CHECK ("phone_e164" IS NULL OR "phone_e164" ~ '^\+[1-9][0-9]{6,14}$'),
  ADD CONSTRAINT "users_failed_login_count_chk" CHECK ("failed_login_count" >= 0);

ALTER TABLE "sessions"
  ADD CONSTRAINT "sessions_expiry_chk" CHECK ("expires_at" > "created_at");

ALTER TABLE "verification_tokens"
  ADD CONSTRAINT "verification_tokens_expiry_chk" CHECK ("expires_at" > "created_at");

-- Journal de sécurité en ajout seul : aucune modification ni suppression ordinaire.
CREATE FUNCTION "prevent_security_event_mutation"() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'security_events est en ajout seul (% interdit)', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER "security_events_append_only"
  BEFORE UPDATE OR DELETE ON "security_events"
  FOR EACH ROW EXECUTE FUNCTION "prevent_security_event_mutation"();

CREATE TRIGGER "security_events_no_truncate"
  BEFORE TRUNCATE ON "security_events"
  FOR EACH STATEMENT EXECUTE FUNCTION "prevent_security_event_mutation"();
