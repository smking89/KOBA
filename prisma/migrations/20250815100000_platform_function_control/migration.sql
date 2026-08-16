-- Superadmin platform function control (TDLS trust-boundary slice 1):
-- a DB-backed kill switch per major platform function, plus tamper-evident
-- hash chaining on AuditLog so a superadmin's own toggles (and everything
-- else logged) can be verified for post-hoc tampering.

ALTER TYPE "AuditAction" ADD VALUE 'PLATFORM_FUNCTION_ENABLED';
ALTER TYPE "AuditAction" ADD VALUE 'PLATFORM_FUNCTION_DISABLED';

CREATE TYPE "PlatformFunctionKey" AS ENUM (
  'STRIPE_PAYMENTS',
  'AIDEN_GENERATION',
  'CLAUDE_DESCRIPTION_ASSIST',
  'SOCIAL_POSTING',
  'MESSAGING',
  'TRADE',
  'MARKETPLACE_CHECKOUT',
  'SERVER_RCON',
  'PLUS_SUBSCRIPTIONS'
);

ALTER TABLE "AuditLog" ADD COLUMN "prevHash" VARCHAR(64);
ALTER TABLE "AuditLog" ADD COLUMN "hash" VARCHAR(64);

CREATE TABLE "PlatformFunctionFlag" (
  "id" TEXT NOT NULL,
  "key" "PlatformFunctionKey" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "note" TEXT,
  "updatedByUserId" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PlatformFunctionFlag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformFunctionFlag_key_key" ON "PlatformFunctionFlag"("key");
CREATE INDEX "PlatformFunctionFlag_key_idx" ON "PlatformFunctionFlag"("key");

ALTER TABLE "PlatformFunctionFlag" ADD CONSTRAINT "PlatformFunctionFlag_updatedByUserId_fkey"
  FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
