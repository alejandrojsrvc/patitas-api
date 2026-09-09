CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE "AuthActionType" AS ENUM ('EMAIL_CONFIRMATION', 'PASSWORD_RECOVERY', 'ADMIN_INVITATION');

ALTER TABLE "users"
ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE "payment_refunds"
ADD COLUMN "request_fingerprint" CHAR(64);

UPDATE "payment_refunds"
SET "request_fingerprint" = encode(sha256(("order_id"::text || ':' || "amount"::text || ':' || "currency")::bytea), 'hex');

ALTER TABLE "payment_refunds"
ALTER COLUMN "request_fingerprint" SET NOT NULL;

CREATE TABLE "auth_credentials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "password_hash" TEXT,
    "email_verified_at" TIMESTAMPTZ(6),
    "password_changed_at" TIMESTAMPTZ(6),
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "auth_credentials_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "auth_credentials_failed_login_count_check" CHECK ("failed_login_count" >= 0)
);

CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_family_id" UUID NOT NULL,
    "refresh_token_hash" CHAR(64) NOT NULL,
    "access_token_jti" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "last_used_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "ip_hash" CHAR(64),
    "user_agent" VARCHAR(512),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "auth_action_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" "AuthActionType" NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "auth_action_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auth_credentials_user_id_key" ON "auth_credentials"("user_id");
CREATE UNIQUE INDEX "auth_sessions_refresh_token_hash_key" ON "auth_sessions"("refresh_token_hash");
CREATE UNIQUE INDEX "auth_sessions_access_token_jti_key" ON "auth_sessions"("access_token_jti");
CREATE INDEX "idx_auth_sessions_user_active" ON "auth_sessions"("user_id", "revoked_at", "expires_at");
CREATE INDEX "idx_auth_sessions_token_family" ON "auth_sessions"("token_family_id");
CREATE UNIQUE INDEX "auth_action_tokens_token_hash_key" ON "auth_action_tokens"("token_hash");
CREATE INDEX "idx_auth_action_tokens_user_type_created" ON "auth_action_tokens"("user_id", "type", "created_at");
CREATE INDEX "idx_auth_action_tokens_expires_at" ON "auth_action_tokens"("expires_at");

ALTER TABLE "auth_credentials"
ADD CONSTRAINT "auth_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "auth_sessions"
ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "auth_action_tokens"
ADD CONSTRAINT "auth_action_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TRIGGER set_auth_credentials_updated_at
BEFORE UPDATE ON "auth_credentials"
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TABLE "external_identities";
