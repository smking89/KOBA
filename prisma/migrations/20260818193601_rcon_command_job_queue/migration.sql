-- CreateEnum
CREATE TYPE "RconCommandJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'DEAD');

-- CreateTable
CREATE TABLE "RconCommandJob" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "kitName" TEXT NOT NULL,
    "gamertag" TEXT NOT NULL,
    "status" "RconCommandJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RconCommandJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RconCommandJob_status_runAfter_idx" ON "RconCommandJob"("status", "runAfter");

-- CreateIndex
CREATE INDEX "RconCommandJob_orderId_idx" ON "RconCommandJob"("orderId");

-- AddForeignKey
ALTER TABLE "RconCommandJob" ADD CONSTRAINT "RconCommandJob_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RconCommandJob" ADD CONSTRAINT "RconCommandJob_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "GameServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
