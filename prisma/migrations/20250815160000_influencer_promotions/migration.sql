-- Phase 14I: influencer profiles, affiliate campaigns, promo codes, commissions, sponsored ads

CREATE TYPE "InfluencerVerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED');
CREATE TYPE "AffiliateCampaignStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'REJECTED', 'SUSPENDED', 'CANCELLED');
CREATE TYPE "CampaignParticipationStatus" AS ENUM ('INVITED', 'APPLIED', 'ACTIVE', 'REJECTED', 'PAUSED', 'REVOKED', 'COMPLETED');
CREATE TYPE "PromotionRateType" AS ENUM ('FIXED', 'PERCENTAGE');
CREATE TYPE "AttributionSource" AS ENUM ('CLICK', 'PROMO_CODE');
CREATE TYPE "PromotionCommissionStatus" AS ENUM ('PENDING', 'QUALIFIED', 'AVAILABLE', 'REVERSED', 'PAID', 'CANCELLED', 'UNDER_REVIEW');
CREATE TYPE "SponsoredEntityType" AS ENUM ('PRODUCT', 'SHOP', 'DEV_PRODUCT', 'GAME_SERVER');
CREATE TYPE "SponsoredPlacement" AS ENUM ('MARKETPLACE', 'SHOP', 'APPS', 'SERVERS');
CREATE TYPE "SponsoredCampaignStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'REJECTED', 'SUSPENDED', 'CANCELLED');
CREATE TYPE "SponsoredEventType" AS ENUM ('IMPRESSION', 'CLICK', 'SPEND', 'RELEASE');

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INFLUENCER_PROFILE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INFLUENCER_VERIFIED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INFLUENCER_SUSPENDED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'AFFILIATE_CAMPAIGN_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'AFFILIATE_CAMPAIGN_SUBMITTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'AFFILIATE_CAMPAIGN_MODERATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CAMPAIGN_PARTICIPATION_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PROMO_CODE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PROMO_CODE_SUSPENDED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PROMOTION_COMMISSION_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PROMOTION_COMMISSION_REVERSED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SPONSORED_CAMPAIGN_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SPONSORED_CAMPAIGN_MODERATED';

ALTER TABLE "Order" ADD COLUMN "originalSubtotalCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "discountCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "eligibleCommissionBaseCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "promoCodeId" TEXT;
ALTER TABLE "Order" ADD COLUMN "campaignId" TEXT;
ALTER TABLE "Order" ADD COLUMN "participationId" TEXT;
ALTER TABLE "Order" ADD COLUMN "attributionSource" "AttributionSource";

CREATE TABLE "InfluencerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "bio" TEXT NOT NULL DEFAULT '',
    "avatarUrl" TEXT,
    "bannerUrl" TEXT,
    "socialLinksJson" TEXT NOT NULL DEFAULT '[]',
    "games" TEXT[],
    "categories" TEXT[],
    "audienceRegions" TEXT[],
    "contactEmail" TEXT,
    "verificationStatus" "InfluencerVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "verificationNote" TEXT,
    "suspendedAt" TIMESTAMP(3),
    "payoutEligible" BOOLEAN NOT NULL DEFAULT false,
    "disclosureAcceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InfluencerProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AffiliateCampaign" (
    "id" TEXT NOT NULL,
    "publicRef" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "sellerUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "AffiliateCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "commissionType" "PromotionRateType" NOT NULL DEFAULT 'PERCENTAGE',
    "commissionValue" INTEGER NOT NULL DEFAULT 1000,
    "discountType" "PromotionRateType",
    "discountValue" INTEGER,
    "attributionWindowHours" INTEGER NOT NULL DEFAULT 168,
    "totalBudgetCents" INTEGER NOT NULL DEFAULT 0,
    "remainingBudgetCents" INTEGER NOT NULL DEFAULT 0,
    "perInfluencerLimitCents" INTEGER,
    "totalConversionLimit" INTEGER,
    "conversionCount" INTEGER NOT NULL DEFAULT 0,
    "targetGames" TEXT[],
    "targetCategories" TEXT[],
    "openApplications" BOOLEAN NOT NULL DEFAULT true,
    "terms" TEXT NOT NULL DEFAULT '',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "moderationNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AffiliateCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AffiliateCampaignProduct" (
    "campaignId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    CONSTRAINT "AffiliateCampaignProduct_pkey" PRIMARY KEY ("campaignId","productId")
);

CREATE TABLE "CampaignParticipation" (
    "id" TEXT NOT NULL,
    "publicRef" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "influencerUserId" TEXT NOT NULL,
    "status" "CampaignParticipationStatus" NOT NULL DEFAULT 'APPLIED',
    "referralToken" TEXT NOT NULL,
    "promoCodeId" TEXT,
    "termsAcceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CampaignParticipation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromoCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sellerUserId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "campaignId" TEXT,
    "discountType" "PromotionRateType" NOT NULL,
    "discountValue" INTEGER NOT NULL,
    "minOrderCents" INTEGER NOT NULL DEFAULT 0,
    "maxDiscountCents" INTEGER,
    "usageLimit" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "perAccountLimit" INTEGER NOT NULL DEFAULT 1,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "applicableAccountTypes" TEXT[],
    "stackingAllowed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromoCodeProduct" (
    "promoCodeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    CONSTRAINT "PromoCodeProduct_pkey" PRIMARY KEY ("promoCodeId","productId")
);

CREATE TABLE "PromoCodeRedemption" (
    "id" TEXT NOT NULL,
    "promoCodeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromoCodeRedemption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReferralClickEvent" (
    "id" TEXT NOT NULL,
    "publicRef" TEXT NOT NULL,
    "participationId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "visitorHash" TEXT,
    "destinationPath" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "suspicious" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReferralClickEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromotionCommission" (
    "id" TEXT NOT NULL,
    "publicRef" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "participationId" TEXT NOT NULL,
    "influencerUserId" TEXT NOT NULL,
    "sellerUserId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "PromotionCommissionStatus" NOT NULL DEFAULT 'PENDING',
    "attributionSource" "AttributionSource" NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "qualifiedAt" TIMESTAMP(3),
    "availableAt" TIMESTAMP(3),
    "reversedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PromotionCommission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SponsoredCampaign" (
    "id" TEXT NOT NULL,
    "publicRef" TEXT NOT NULL,
    "advertiserUserId" TEXT NOT NULL,
    "entityType" "SponsoredEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "placement" "SponsoredPlacement" NOT NULL,
    "targetGameId" TEXT,
    "targetCategoryId" TEXT,
    "targetPlatform" TEXT,
    "targetRegion" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "totalBudgetCoins" BIGINT NOT NULL,
    "remainingBudgetCoins" BIGINT NOT NULL,
    "dailyBudgetCoins" BIGINT NOT NULL,
    "dailySpentCoins" BIGINT NOT NULL DEFAULT 0,
    "dailySpentOn" TIMESTAMP(3),
    "cpcCoins" BIGINT NOT NULL,
    "frequencyCap" INTEGER NOT NULL DEFAULT 6,
    "status" "SponsoredCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "reservationPublicRef" TEXT,
    "impressionCount" INTEGER NOT NULL DEFAULT 0,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "spendCoins" BIGINT NOT NULL DEFAULT 0,
    "lastShownAt" TIMESTAMP(3),
    "moderationNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SponsoredCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SponsoredEvent" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "type" "SponsoredEventType" NOT NULL,
    "viewerUserId" TEXT,
    "viewerHash" TEXT,
    "amountCoins" BIGINT NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT NOT NULL,
    "suspicious" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SponsoredEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromotionNotice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromotionNotice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromotionEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "campaignId" TEXT,
    "participationId" TEXT,
    "orderId" TEXT,
    "actorUserId" TEXT,
    "payloadJson" TEXT NOT NULL DEFAULT '{}',
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromotionEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InfluencerProfile_userId_key" ON "InfluencerProfile"("userId");
CREATE UNIQUE INDEX "InfluencerProfile_slug_key" ON "InfluencerProfile"("slug");
CREATE INDEX "InfluencerProfile_verificationStatus_idx" ON "InfluencerProfile"("verificationStatus");

CREATE UNIQUE INDEX "AffiliateCampaign_publicRef_key" ON "AffiliateCampaign"("publicRef");
CREATE INDEX "AffiliateCampaign_shopId_status_idx" ON "AffiliateCampaign"("shopId", "status");
CREATE INDEX "AffiliateCampaign_sellerUserId_status_idx" ON "AffiliateCampaign"("sellerUserId", "status");

CREATE INDEX "AffiliateCampaignProduct_productId_idx" ON "AffiliateCampaignProduct"("productId");

CREATE UNIQUE INDEX "CampaignParticipation_publicRef_key" ON "CampaignParticipation"("publicRef");
CREATE UNIQUE INDEX "CampaignParticipation_referralToken_key" ON "CampaignParticipation"("referralToken");
CREATE UNIQUE INDEX "CampaignParticipation_campaignId_influencerUserId_key" ON "CampaignParticipation"("campaignId", "influencerUserId");
CREATE INDEX "CampaignParticipation_influencerUserId_status_idx" ON "CampaignParticipation"("influencerUserId", "status");
CREATE INDEX "CampaignParticipation_referralToken_idx" ON "CampaignParticipation"("referralToken");

CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");
CREATE INDEX "PromoCode_shopId_active_idx" ON "PromoCode"("shopId", "active");
CREATE INDEX "PromoCode_campaignId_idx" ON "PromoCode"("campaignId");
CREATE INDEX "PromoCodeProduct_productId_idx" ON "PromoCodeProduct"("productId");
CREATE UNIQUE INDEX "PromoCodeRedemption_orderId_key" ON "PromoCodeRedemption"("orderId");
CREATE INDEX "PromoCodeRedemption_promoCodeId_userId_idx" ON "PromoCodeRedemption"("promoCodeId", "userId");

CREATE UNIQUE INDEX "ReferralClickEvent_publicRef_key" ON "ReferralClickEvent"("publicRef");
CREATE UNIQUE INDEX "ReferralClickEvent_idempotencyKey_key" ON "ReferralClickEvent"("idempotencyKey");
CREATE INDEX "ReferralClickEvent_participationId_createdAt_idx" ON "ReferralClickEvent"("participationId", "createdAt");
CREATE INDEX "ReferralClickEvent_expiresAt_idx" ON "ReferralClickEvent"("expiresAt");

CREATE UNIQUE INDEX "PromotionCommission_publicRef_key" ON "PromotionCommission"("publicRef");
CREATE UNIQUE INDEX "PromotionCommission_orderId_key" ON "PromotionCommission"("orderId");
CREATE UNIQUE INDEX "PromotionCommission_idempotencyKey_key" ON "PromotionCommission"("idempotencyKey");
CREATE INDEX "PromotionCommission_influencerUserId_status_idx" ON "PromotionCommission"("influencerUserId", "status");
CREATE INDEX "PromotionCommission_campaignId_status_idx" ON "PromotionCommission"("campaignId", "status");

CREATE UNIQUE INDEX "SponsoredCampaign_publicRef_key" ON "SponsoredCampaign"("publicRef");
CREATE INDEX "SponsoredCampaign_status_placement_idx" ON "SponsoredCampaign"("status", "placement");
CREATE INDEX "SponsoredCampaign_advertiserUserId_status_idx" ON "SponsoredCampaign"("advertiserUserId", "status");
CREATE UNIQUE INDEX "SponsoredEvent_idempotencyKey_key" ON "SponsoredEvent"("idempotencyKey");
CREATE INDEX "SponsoredEvent_campaignId_type_createdAt_idx" ON "SponsoredEvent"("campaignId", "type", "createdAt");
CREATE INDEX "SponsoredEvent_viewerUserId_createdAt_idx" ON "SponsoredEvent"("viewerUserId", "createdAt");
CREATE INDEX "PromotionNotice_userId_createdAt_idx" ON "PromotionNotice"("userId", "createdAt");
CREATE UNIQUE INDEX "PromotionEvent_idempotencyKey_key" ON "PromotionEvent"("idempotencyKey");
CREATE INDEX "PromotionEvent_type_createdAt_idx" ON "PromotionEvent"("type", "createdAt");
CREATE INDEX "PromotionEvent_campaignId_createdAt_idx" ON "PromotionEvent"("campaignId", "createdAt");
CREATE INDEX "Order_promoCodeId_idx" ON "Order"("promoCodeId");
CREATE INDEX "Order_campaignId_idx" ON "Order"("campaignId");

ALTER TABLE "InfluencerProfile" ADD CONSTRAINT "InfluencerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AffiliateCampaign" ADD CONSTRAINT "AffiliateCampaign_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AffiliateCampaign" ADD CONSTRAINT "AffiliateCampaign_sellerUserId_fkey" FOREIGN KEY ("sellerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AffiliateCampaignProduct" ADD CONSTRAINT "AffiliateCampaignProduct_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AffiliateCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AffiliateCampaignProduct" ADD CONSTRAINT "AffiliateCampaignProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignParticipation" ADD CONSTRAINT "CampaignParticipation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AffiliateCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignParticipation" ADD CONSTRAINT "CampaignParticipation_influencerUserId_fkey" FOREIGN KEY ("influencerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignParticipation" ADD CONSTRAINT "CampaignParticipation_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_sellerUserId_fkey" FOREIGN KEY ("sellerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AffiliateCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PromoCodeProduct" ADD CONSTRAINT "PromoCodeProduct_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromoCodeProduct" ADD CONSTRAINT "PromoCodeProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromoCodeRedemption" ADD CONSTRAINT "PromoCodeRedemption_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromoCodeRedemption" ADD CONSTRAINT "PromoCodeRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromoCodeRedemption" ADD CONSTRAINT "PromoCodeRedemption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReferralClickEvent" ADD CONSTRAINT "ReferralClickEvent_participationId_fkey" FOREIGN KEY ("participationId") REFERENCES "CampaignParticipation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReferralClickEvent" ADD CONSTRAINT "ReferralClickEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AffiliateCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromotionCommission" ADD CONSTRAINT "PromotionCommission_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AffiliateCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromotionCommission" ADD CONSTRAINT "PromotionCommission_participationId_fkey" FOREIGN KEY ("participationId") REFERENCES "CampaignParticipation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromotionCommission" ADD CONSTRAINT "PromotionCommission_influencerUserId_fkey" FOREIGN KEY ("influencerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromotionCommission" ADD CONSTRAINT "PromotionCommission_sellerUserId_fkey" FOREIGN KEY ("sellerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromotionCommission" ADD CONSTRAINT "PromotionCommission_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SponsoredCampaign" ADD CONSTRAINT "SponsoredCampaign_advertiserUserId_fkey" FOREIGN KEY ("advertiserUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SponsoredEvent" ADD CONSTRAINT "SponsoredEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "SponsoredCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromotionNotice" ADD CONSTRAINT "PromotionNotice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AffiliateCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_participationId_fkey" FOREIGN KEY ("participationId") REFERENCES "CampaignParticipation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
