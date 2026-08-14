-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'GROUP_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'GROUP_JOINED';
ALTER TYPE "AuditAction" ADD VALUE 'GROUP_LEFT';
ALTER TYPE "AuditAction" ADD VALUE 'GROUP_MODERATED';
ALTER TYPE "AuditAction" ADD VALUE 'LFG_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'LFG_JOIN_REQUESTED';
ALTER TYPE "AuditAction" ADD VALUE 'LFG_SETTLED';

-- CreateEnum
CREATE TYPE "GroupVisibility" AS ENUM ('PUBLIC', 'PRIVATE');
CREATE TYPE "GroupMemberRole" AS ENUM ('OWNER', 'ADMIN', 'MODERATOR', 'MEMBER');
CREATE TYPE "GroupRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "GroupInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');
CREATE TYPE "LfgRegion" AS ENUM ('NA', 'EU', 'SA', 'AS', 'OC', 'AF', 'ANY');
CREATE TYPE "LfgSkill" AS ENUM ('CASUAL', 'INTERMEDIATE', 'COMPETITIVE', 'ANY');
CREATE TYPE "LfgMic" AS ENUM ('REQUIRED', 'OPTIONAL', 'NO_MIC');
CREATE TYPE "LfgStatus" AS ENUM ('OPEN', 'FULL', 'EXPIRED', 'CANCELLED');
CREATE TYPE "LfgRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bio" TEXT NOT NULL,
    "visibility" "GroupVisibility" NOT NULL DEFAULT 'PUBLIC',
    "taggingAllowed" BOOLEAN NOT NULL DEFAULT true,
    "ownerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GroupMember" (
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "GroupMemberRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("groupId","userId")
);

CREATE TABLE "GroupJoinRequest" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "GroupRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupJoinRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GroupInvitation" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "invitedUserId" TEXT NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    "status" "GroupInviteStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupInvitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GroupBan" (
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bannedByUserId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupBan_pkey" PRIMARY KEY ("groupId","userId")
);

CREATE TABLE "LfgPost" (
    "id" TEXT NOT NULL,
    "publicRef" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "platform" "GamePlatform" NOT NULL,
    "region" "LfgRegion" NOT NULL,
    "timezone" TEXT NOT NULL,
    "skillLevel" "LfgSkill" NOT NULL,
    "mic" "LfgMic" NOT NULL,
    "availability" TEXT NOT NULL,
    "slotsTotal" INTEGER NOT NULL,
    "slotsFilled" INTEGER NOT NULL DEFAULT 1,
    "status" "LfgStatus" NOT NULL DEFAULT 'OPEN',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LfgPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LfgRequest" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "LfgRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LfgRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Group_slug_key" ON "Group"("slug");
CREATE INDEX "Group_visibility_createdAt_idx" ON "Group"("visibility", "createdAt");
CREATE INDEX "Group_ownerUserId_idx" ON "Group"("ownerUserId");
CREATE INDEX "GroupMember_userId_idx" ON "GroupMember"("userId");
CREATE UNIQUE INDEX "GroupJoinRequest_groupId_userId_key" ON "GroupJoinRequest"("groupId", "userId");
CREATE INDEX "GroupJoinRequest_groupId_status_idx" ON "GroupJoinRequest"("groupId", "status");
CREATE UNIQUE INDEX "GroupInvitation_groupId_invitedUserId_key" ON "GroupInvitation"("groupId", "invitedUserId");
CREATE INDEX "GroupInvitation_invitedUserId_status_idx" ON "GroupInvitation"("invitedUserId", "status");
CREATE INDEX "GroupBan_userId_idx" ON "GroupBan"("userId");
CREATE UNIQUE INDEX "LfgPost_publicRef_key" ON "LfgPost"("publicRef");
CREATE INDEX "LfgPost_status_expiresAt_idx" ON "LfgPost"("status", "expiresAt");
CREATE INDEX "LfgPost_gameId_createdAt_idx" ON "LfgPost"("gameId", "createdAt");
CREATE INDEX "LfgPost_authorUserId_idx" ON "LfgPost"("authorUserId");
CREATE UNIQUE INDEX "LfgRequest_postId_userId_key" ON "LfgRequest"("postId", "userId");
CREATE INDEX "LfgRequest_postId_status_idx" ON "LfgRequest"("postId", "status");

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupJoinRequest" ADD CONSTRAINT "GroupJoinRequest_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupJoinRequest" ADD CONSTRAINT "GroupJoinRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupInvitation" ADD CONSTRAINT "GroupInvitation_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupInvitation" ADD CONSTRAINT "GroupInvitation_invitedUserId_fkey" FOREIGN KEY ("invitedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupInvitation" ADD CONSTRAINT "GroupInvitation_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupBan" ADD CONSTRAINT "GroupBan_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupBan" ADD CONSTRAINT "GroupBan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupBan" ADD CONSTRAINT "GroupBan_bannedByUserId_fkey" FOREIGN KEY ("bannedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LfgPost" ADD CONSTRAINT "LfgPost_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LfgPost" ADD CONSTRAINT "LfgPost_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LfgRequest" ADD CONSTRAINT "LfgRequest_postId_fkey" FOREIGN KEY ("postId") REFERENCES "LfgPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LfgRequest" ADD CONSTRAINT "LfgRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
