import { requireSellerPromotions } from "@/features/promotions/lib/require-seller";
import { SellerPromotionsNav } from "@/features/promotions/components/seller-promotions-nav";
import { CampaignCreateForm } from "@/features/promotions/components/promotion-forms";
import { prisma } from "@/lib/db";

export const metadata = { title: "New campaign" };

export default async function NewCampaignPage() {
  const { userId } = await requireSellerPromotions("/seller/promotions/new");
  const shop = await prisma.shop.findUnique({
    where: { ownerUserId: userId },
    include: {
      products: {
        where: { moderationStatus: "APPROVED", publishedAt: { not: null } },
        select: { slug: true, title: true },
      },
    },
  });
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">New affiliate campaign</h1>
      <SellerPromotionsNav current="/seller/promotions/new" />
      <CampaignCreateForm products={shop?.products ?? []} />
    </div>
  );
}
