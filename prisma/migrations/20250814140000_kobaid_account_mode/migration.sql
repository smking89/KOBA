-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'KOBAID_MINTED';
ALTER TYPE "AuditAction" ADD VALUE 'ACCOUNT_SWITCHED';
ALTER TYPE "AuditAction" ADD VALUE 'KOBAID_ISSUED_STAFF';

-- AlterTable
ALTER TABLE "AccountProfile" ADD COLUMN "activeAccountType" "KobaAccountType" NOT NULL DEFAULT 'PLAYER';
ALTER TABLE "AccountProfile" ADD COLUMN "kobaIdRevealedAt" TIMESTAMP(3);
