-- CreateEnum
CREATE TYPE "RconDeliveryStatus" AS ENUM ('NOT_APPLICABLE', 'PENDING', 'DELIVERED', 'FAILED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "buyerGameHandle" TEXT,
ADD COLUMN     "rconDeliveryError" TEXT,
ADD COLUMN     "rconDeliveryStatus" "RconDeliveryStatus" NOT NULL DEFAULT 'NOT_APPLICABLE';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "rconKitName" TEXT,
ADD COLUMN     "rconServerId" TEXT;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_rconServerId_fkey" FOREIGN KEY ("rconServerId") REFERENCES "GameServer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

