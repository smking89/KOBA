-- Phase 14H: developer portal, API keys, webhooks, app marketplace

ALTER TYPE "AuditAction" ADD VALUE 'DEV_PROFILE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'DEV_PROFILE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'DEV_MEMBER_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'DEV_APP_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'DEV_APP_SUSPENDED';
ALTER TYPE "AuditAction" ADD VALUE 'DEV_KEY_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'DEV_KEY_REVOKED';
ALTER TYPE "AuditAction" ADD VALUE 'DEV_KEY_ROTATED';
ALTER TYPE "AuditAction" ADD VALUE 'DEV_WEBHOOK_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'DEV_WEBHOOK_ROTATED';
ALTER TYPE "AuditAction" ADD VALUE 'DEV_PRODUCT_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE 'DEV_PRODUCT_REJECTED';
ALTER TYPE "AuditAction" ADD VALUE 'DEV_PRODUCT_SUSPENDED';
ALTER TYPE "AuditAction" ADD VALUE 'DEV_VERSION_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE 'DEV_PURCHASE_COMPLETED';
ALTER TYPE "AuditAction" ADD VALUE 'DEV_PURCHASE_REFUNDED';
ALTER TYPE "AuditAction" ADD VALUE 'DEV_PUBLISHER_VERIFIED';

CREATE TYPE "DevProductCategory" AS ENUM ('DISCORD_BOT', 'GAME_SERVER_PLUGIN', 'SERVER_MANAGEMENT', 'INTEGRATION', 'DOWNLOADABLE_PACK', 'API_SERVICE', 'UTILITY', 'THEME');
CREATE TYPE "DeveloperMemberRole" AS ENUM ('OWNER', 'ADMIN', 'DEVELOPER', 'SUPPORT', 'ANALYST');
CREATE TYPE "DeveloperAppEnvironment" AS ENUM ('SANDBOX', 'PRODUCTION');
CREATE TYPE "DeveloperAppStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED');
CREATE TYPE "DevReleaseChannel" AS ENUM ('STABLE', 'BETA', 'ALPHA');
CREATE TYPE "DevArtifactStatus" AS ENUM ('QUARANTINE', 'APPROVED', 'REJECTED');
CREATE TYPE "DevPurchaseStatus" AS ENUM ('PAID', 'REFUNDED');
CREATE TYPE "DevWebhookDeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED', 'CANCELLED');

ALTER TYPE "DevPricing" ADD VALUE 'COMING_SOON';
ALTER TYPE "DevReviewState" ADD VALUE 'CHANGES_REQUESTED';
ALTER TYPE "DevReviewState" ADD VALUE 'PUBLISHED';
ALTER TYPE "DevReviewState" ADD VALUE 'SUSPENDED';
ALTER TYPE "DevReviewState" ADD VALUE 'ARCHIVED';

CREATE TABLE "DeveloperProfile" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "avatarUrl" TEXT,
  "bannerUrl" TEXT,
  "websiteUrl" TEXT,
  "supportUrl" TEXT,
  "privacyUrl" TEXT,
  "termsUrl" TEXT,
  "contactEmail" TEXT NOT NULL,
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "verifiedAt" TIMESTAMP(3),
  "suspendedAt" TIMESTAMP(3),
  "games" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "platforms" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "ownerUserId" TEXT NOT NULL,
  "kobaIdentityId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DeveloperProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeveloperProfile_slug_key" ON "DeveloperProfile"("slug");
CREATE INDEX "DeveloperProfile_ownerUserId_idx" ON "DeveloperProfile"("ownerUserId");
CREATE INDEX "DeveloperProfile_verified_suspendedAt_idx" ON "DeveloperProfile"("verified", "suspendedAt");

CREATE TABLE "DeveloperMember" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "DeveloperMemberRole" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeveloperMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DeveloperMember_profileId_userId_key" ON "DeveloperMember"("profileId", "userId");
CREATE INDEX "DeveloperMember_userId_idx" ON "DeveloperMember"("userId");

CREATE TABLE "DeveloperApplication" (
  "id" TEXT NOT NULL,
  "publicRef" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "logoUrl" TEXT,
  "environment" "DeveloperAppEnvironment" NOT NULL DEFAULT 'SANDBOX',
  "status" "DeveloperAppStatus" NOT NULL DEFAULT 'ACTIVE',
  "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "redirectUris" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "productionApprovedAt" TIMESTAMP(3),
  "suspendedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DeveloperApplication_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DeveloperApplication_publicRef_key" ON "DeveloperApplication"("publicRef");
CREATE INDEX "DeveloperApplication_profileId_environment_idx" ON "DeveloperApplication"("profileId", "environment");
CREATE INDEX "DeveloperApplication_status_idx" ON "DeveloperApplication"("status");

CREATE TABLE "DeveloperApiKey" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "prefix" TEXT NOT NULL,
  "secretHash" TEXT NOT NULL,
  "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "environment" "DeveloperAppEnvironment" NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "rateLimitRpm" INTEGER NOT NULL DEFAULT 60,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeveloperApiKey_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DeveloperApiKey_prefix_key" ON "DeveloperApiKey"("prefix");
CREATE INDEX "DeveloperApiKey_applicationId_revokedAt_idx" ON "DeveloperApiKey"("applicationId", "revokedAt");
CREATE INDEX "DeveloperApiKey_secretHash_idx" ON "DeveloperApiKey"("secretHash");

CREATE TABLE "DeveloperWebhookEndpoint" (
  "id" TEXT NOT NULL,
  "publicRef" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "applicationId" TEXT,
  "url" TEXT NOT NULL,
  "events" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "secretCiphertext" TEXT NOT NULL,
  "secretIv" TEXT NOT NULL,
  "secretAuthTag" TEXT NOT NULL,
  "secretKeyVersion" INTEGER NOT NULL DEFAULT 1,
  "secretPrefix" TEXT NOT NULL,
  "disabledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DeveloperWebhookEndpoint_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DeveloperWebhookEndpoint_publicRef_key" ON "DeveloperWebhookEndpoint"("publicRef");
CREATE INDEX "DeveloperWebhookEndpoint_profileId_disabledAt_idx" ON "DeveloperWebhookEndpoint"("profileId", "disabledAt");

CREATE TABLE "DeveloperWebhookDelivery" (
  "id" TEXT NOT NULL,
  "deliveryId" TEXT NOT NULL,
  "endpointId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payloadJson" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL,
  "status" "DevWebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 6,
  "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastError" TEXT,
  "claimedAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DeveloperWebhookDelivery_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DeveloperWebhookDelivery_deliveryId_key" ON "DeveloperWebhookDelivery"("deliveryId");
CREATE INDEX "DeveloperWebhookDelivery_status_runAfter_idx" ON "DeveloperWebhookDelivery"("status", "runAfter");

ALTER TABLE "DevProduct" ADD COLUMN "slug" TEXT;
ALTER TABLE "DevProduct" ADD COLUMN "profileId" TEXT;
ALTER TABLE "DevProduct" ADD COLUMN "category" "DevProductCategory" NOT NULL DEFAULT 'UTILITY';
ALTER TABLE "DevProduct" ADD COLUMN "shortDescription" TEXT NOT NULL DEFAULT '';
ALTER TABLE "DevProduct" ADD COLUMN "description" TEXT NOT NULL DEFAULT '';
ALTER TABLE "DevProduct" ADD COLUMN "priceCoins" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "DevProduct" ADD COLUMN "games" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "DevProduct" ADD COLUMN "operatingSystems" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "DevProduct" ADD COLUMN "serverPlatforms" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "DevProduct" ADD COLUMN "screenshotsJson" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "DevProduct" ADD COLUMN "iconUrl" TEXT;
ALTER TABLE "DevProduct" ADD COLUMN "docsUrl" TEXT;
ALTER TABLE "DevProduct" ADD COLUMN "supportUrl" TEXT;
ALTER TABLE "DevProduct" ADD COLUMN "privacyUrl" TEXT;
ALTER TABLE "DevProduct" ADD COLUMN "changelog" TEXT NOT NULL DEFAULT '';
ALTER TABLE "DevProduct" ADD COLUMN "publishedAt" TIMESTAMP(3);
ALTER TABLE "DevProduct" ADD COLUMN "suspendedAt" TIMESTAMP(3);
ALTER TABLE "DevProduct" ADD COLUMN "kobaOfficial" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DevProduct" ADD COLUMN "ratingSum" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "DevProduct" ADD COLUMN "ratingCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "DevProduct" ADD COLUMN "downloadCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "DevProduct" ADD COLUMN "moderationNote" TEXT;

UPDATE "DevProduct" SET "slug" = lower(regexp_replace("publicRef", '[^a-zA-Z0-9]+', '-', 'g')) WHERE "slug" IS NULL;
ALTER TABLE "DevProduct" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "DevProduct_slug_key" ON "DevProduct"("slug");
CREATE INDEX "DevProduct_profileId_reviewState_idx" ON "DevProduct"("profileId", "reviewState");
CREATE INDEX "DevProduct_category_reviewState_idx" ON "DevProduct"("category", "reviewState");

CREATE TABLE "DevProductVersion" (
  "id" TEXT NOT NULL,
  "publicRef" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "semver" TEXT NOT NULL,
  "changelog" TEXT NOT NULL DEFAULT '',
  "channel" "DevReleaseChannel" NOT NULL DEFAULT 'STABLE',
  "gameVersions" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "platforms" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "requirements" TEXT NOT NULL DEFAULT '',
  "reviewState" "DevReviewState" NOT NULL DEFAULT 'DRAFT',
  "releasedAt" TIMESTAMP(3),
  "deprecatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DevProductVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DevProductVersion_publicRef_key" ON "DevProductVersion"("publicRef");
CREATE UNIQUE INDEX "DevProductVersion_productId_semver_key" ON "DevProductVersion"("productId", "semver");
CREATE INDEX "DevProductVersion_productId_reviewState_idx" ON "DevProductVersion"("productId", "reviewState");

CREATE TABLE "DevProductArtifact" (
  "id" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "sha256" TEXT NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "mimeType" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "status" "DevArtifactStatus" NOT NULL DEFAULT 'QUARANTINE',
  "bytes" BYTEA,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DevProductArtifact_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DevProductArtifact_versionId_status_idx" ON "DevProductArtifact"("versionId", "status");

CREATE TABLE "DevEntitlement" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DevEntitlement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DevEntitlement_userId_productId_key" ON "DevEntitlement"("userId", "productId");
CREATE INDEX "DevEntitlement_productId_idx" ON "DevEntitlement"("productId");

CREATE TABLE "DevPurchase" (
  "id" TEXT NOT NULL,
  "publicRef" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "buyerUserId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "priceCoins" BIGINT NOT NULL,
  "feeCoins" BIGINT NOT NULL,
  "sellerCoins" BIGINT NOT NULL,
  "commissionBps" INTEGER NOT NULL,
  "status" "DevPurchaseStatus" NOT NULL DEFAULT 'PAID',
  "captureTxRef" TEXT,
  "sellerTxRef" TEXT,
  "refundTxRef" TEXT,
  "refundReason" TEXT,
  "proceedsUnrecoverable" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DevPurchase_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DevPurchase_publicRef_key" ON "DevPurchase"("publicRef");
CREATE UNIQUE INDEX "DevPurchase_idempotencyKey_key" ON "DevPurchase"("idempotencyKey");
CREATE UNIQUE INDEX "DevPurchase_one_paid_per_buyer_product" ON "DevPurchase"("buyerUserId", "productId") WHERE "status" = 'PAID';
CREATE INDEX "DevPurchase_buyerUserId_createdAt_idx" ON "DevPurchase"("buyerUserId", "createdAt");
CREATE INDEX "DevPurchase_productId_status_idx" ON "DevPurchase"("productId", "status");

CREATE TABLE "DevProductReview" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "body" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DevProductReview_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DevProductReview_productId_userId_key" ON "DevProductReview"("productId", "userId");
CREATE INDEX "DevProductReview_productId_idx" ON "DevProductReview"("productId");

ALTER TABLE "DeveloperProfile" ADD CONSTRAINT "DeveloperProfile_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeveloperProfile" ADD CONSTRAINT "DeveloperProfile_kobaIdentityId_fkey" FOREIGN KEY ("kobaIdentityId") REFERENCES "KobaIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DeveloperMember" ADD CONSTRAINT "DeveloperMember_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "DeveloperProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeveloperMember" ADD CONSTRAINT "DeveloperMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeveloperApplication" ADD CONSTRAINT "DeveloperApplication_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "DeveloperProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeveloperApiKey" ADD CONSTRAINT "DeveloperApiKey_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "DeveloperApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeveloperApiKey" ADD CONSTRAINT "DeveloperApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeveloperWebhookEndpoint" ADD CONSTRAINT "DeveloperWebhookEndpoint_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "DeveloperProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeveloperWebhookEndpoint" ADD CONSTRAINT "DeveloperWebhookEndpoint_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "DeveloperApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DeveloperWebhookDelivery" ADD CONSTRAINT "DeveloperWebhookDelivery_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "DeveloperWebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DevProduct" ADD CONSTRAINT "DevProduct_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "DeveloperProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DevProductVersion" ADD CONSTRAINT "DevProductVersion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "DevProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DevProductArtifact" ADD CONSTRAINT "DevProductArtifact_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "DevProductVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DevEntitlement" ADD CONSTRAINT "DevEntitlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DevEntitlement" ADD CONSTRAINT "DevEntitlement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "DevProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DevPurchase" ADD CONSTRAINT "DevPurchase_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DevPurchase" ADD CONSTRAINT "DevPurchase_productId_fkey" FOREIGN KEY ("productId") REFERENCES "DevProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DevProductReview" ADD CONSTRAINT "DevProductReview_productId_fkey" FOREIGN KEY ("productId") REFERENCES "DevProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DevProductReview" ADD CONSTRAINT "DevProductReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
