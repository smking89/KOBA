-- CreateEnum
CREATE TYPE "StaffMfaFactorStatus" AS ENUM ('PENDING', 'ACTIVE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'STAFF_MFA_ENROLLMENT_STARTED';
ALTER TYPE "AuditAction" ADD VALUE 'STAFF_MFA_ENROLLED';
ALTER TYPE "AuditAction" ADD VALUE 'STAFF_MFA_CHALLENGE_SUCCEEDED';
ALTER TYPE "AuditAction" ADD VALUE 'STAFF_MFA_CHALLENGE_FAILED';
ALTER TYPE "AuditAction" ADD VALUE 'STAFF_MFA_RECOVERY_CODE_USED';
ALTER TYPE "AuditAction" ADD VALUE 'STAFF_MFA_RECOVERY_CODES_REGENERATED';
ALTER TYPE "AuditAction" ADD VALUE 'STAFF_MFA_DISABLED';
ALTER TYPE "AuditAction" ADD VALUE 'STAFF_MFA_ADMIN_RESET';
ALTER TYPE "AuditAction" ADD VALUE 'STAFF_STEP_UP_SUCCEEDED';
ALTER TYPE "AuditAction" ADD VALUE 'STAFF_STEP_UP_FAILED';
ALTER TYPE "AuditAction" ADD VALUE 'STAFF_SESSION_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'STAFF_SESSION_REVOKED';
ALTER TYPE "AuditAction" ADD VALUE 'STAFF_SESSIONS_REVOKED_ALL';
ALTER TYPE "AuditAction" ADD VALUE 'STAFF_ROLE_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'STAFF_PASSWORD_CHANGED';

-- CreateTable
CREATE TABLE "StaffMfaFactor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "StaffMfaFactorStatus" NOT NULL DEFAULT 'PENDING',
    "secretCiphertext" TEXT NOT NULL,
    "secretIv" TEXT NOT NULL,
    "secretAuthTag" TEXT NOT NULL,
    "keyVersion" INTEGER NOT NULL,
    "lastAcceptedStep" BIGINT,
    "enrollmentExpiresAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffMfaFactor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffRecoveryCode" (
    "id" TEXT NOT NULL,
    "factorId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffRecoveryCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffMfaChallenge" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'staff-login',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffMfaChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMfaAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" VARCHAR(64),
    "ipHash" VARCHAR(64),
    "userAgent" VARCHAR(160),

    CONSTRAINT "StaffSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffMfaFactor_userId_key" ON "StaffMfaFactor"("userId");

-- CreateIndex
CREATE INDEX "StaffMfaFactor_status_idx" ON "StaffMfaFactor"("status");

-- CreateIndex
CREATE UNIQUE INDEX "StaffRecoveryCode_codeHash_key" ON "StaffRecoveryCode"("codeHash");

-- CreateIndex
CREATE INDEX "StaffRecoveryCode_factorId_idx" ON "StaffRecoveryCode"("factorId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffMfaChallenge_tokenHash_key" ON "StaffMfaChallenge"("tokenHash");

-- CreateIndex
CREATE INDEX "StaffMfaChallenge_userId_idx" ON "StaffMfaChallenge"("userId");

-- CreateIndex
CREATE INDEX "StaffMfaChallenge_expiresAt_idx" ON "StaffMfaChallenge"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "StaffSession_tokenHash_key" ON "StaffSession"("tokenHash");

-- CreateIndex
CREATE INDEX "StaffSession_userId_idx" ON "StaffSession"("userId");

-- CreateIndex
CREATE INDEX "StaffSession_expiresAt_idx" ON "StaffSession"("expiresAt");

-- AddForeignKey
ALTER TABLE "StaffMfaFactor" ADD CONSTRAINT "StaffMfaFactor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffRecoveryCode" ADD CONSTRAINT "StaffRecoveryCode_factorId_fkey" FOREIGN KEY ("factorId") REFERENCES "StaffMfaFactor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMfaChallenge" ADD CONSTRAINT "StaffMfaChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffSession" ADD CONSTRAINT "StaffSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

