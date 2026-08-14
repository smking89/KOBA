-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'CONVERSATION_STARTED';
ALTER TYPE "AuditAction" ADD VALUE 'MESSAGE_SENT';
ALTER TYPE "AuditAction" ADD VALUE 'VANISH_PURGED';

ALTER TYPE "ReportTargetType" ADD VALUE 'MESSAGE';
ALTER TYPE "ReportTargetType" ADD VALUE 'CONVERSATION';

-- CreateEnum
CREATE TYPE "MessageKind" AS ENUM ('TEXT', 'VOICE', 'ATTACHMENT', 'PRODUCT');

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "publicRef" TEXT NOT NULL,
    "pairKey" TEXT NOT NULL,
    "vanishMode" BOOLEAN NOT NULL DEFAULT false,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConversationParticipant" (
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("conversationId","userId")
);

CREATE TABLE "DirectMessage" (
    "id" TEXT NOT NULL,
    "publicRef" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "kind" "MessageKind" NOT NULL DEFAULT 'TEXT',
    "body" TEXT,
    "vanish" BOOLEAN NOT NULL DEFAULT false,
    "mediaUrl" TEXT,
    "mediaDurationMs" INTEGER,
    "productSlug" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Conversation_publicRef_key" ON "Conversation"("publicRef");
CREATE UNIQUE INDEX "Conversation_pairKey_key" ON "Conversation"("pairKey");
CREATE INDEX "Conversation_lastMessageAt_idx" ON "Conversation"("lastMessageAt");
CREATE INDEX "ConversationParticipant_userId_idx" ON "ConversationParticipant"("userId");
CREATE UNIQUE INDEX "DirectMessage_publicRef_key" ON "DirectMessage"("publicRef");
CREATE INDEX "DirectMessage_conversationId_createdAt_idx" ON "DirectMessage"("conversationId", "createdAt");
CREATE INDEX "DirectMessage_senderUserId_idx" ON "DirectMessage"("senderUserId");

ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
