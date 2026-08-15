import { prisma } from "@/lib/db";
import { isStaffAccountType } from "@/features/koba-id/lib/format";

export async function loadStaffTypes(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { kobaIdentities: { select: { accountType: true } } },
  });
  return user?.kobaIdentities.map((row) => row.accountType) ?? [];
}

export async function userHasStaffIdentity(userId: string): Promise<boolean> {
  const types = await loadStaffTypes(userId);
  return types.some((type) => isStaffAccountType(type));
}

export async function userHasActiveStaffMfa(userId: string): Promise<boolean> {
  const factor = await prisma.staffMfaFactor.findUnique({
    where: { userId },
    select: { status: true },
  });
  return factor?.status === "ACTIVE";
}
