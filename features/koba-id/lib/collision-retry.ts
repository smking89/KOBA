import { generateKobaIdCode, type RandomBytesFn } from "@/features/koba-id/lib/format";
import type { KobaAccountType } from "@/features/koba-id/lib/format";
import { KobaIdError } from "@/features/koba-id/services/koba-id-error";

export const MAX_COLLISION_ATTEMPTS = 32;

export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

export async function createIdentityWithCollisionRetry<T>(input: {
  accountType: KobaAccountType;
  randomBytesFn: RandomBytesFn;
  create: (code: string) => Promise<T>;
  maxAttempts?: number;
}): Promise<T> {
  const maxAttempts = input.maxAttempts ?? MAX_COLLISION_ATTEMPTS;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const code = generateKobaIdCode(input.accountType, input.randomBytesFn);
    try {
      return await input.create(code);
    } catch (error) {
      if (isUniqueViolation(error)) {
        continue;
      }
      throw error;
    }
  }

  throw new KobaIdError("Could not allocate a unique KOBAID.", "COLLISION");
}
