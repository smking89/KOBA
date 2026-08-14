import { prisma } from "@/lib/db";

export async function actorIsStaff(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { kobaIdentities: { select: { accountType: true } } },
  });
  const types = user?.kobaIdentities.map((row) => row.accountType) ?? [];
  return types.includes("SUPERADMIN") || types.includes("ADMIN");
}
