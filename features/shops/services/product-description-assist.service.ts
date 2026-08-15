import { ShopError } from "@/features/shops/services/shop.service";
import { getOwnedShop } from "@/features/shops/services/shop.service";
import {
  ClaudeGenerationError,
  ClaudeNotConfiguredError,
  generateText,
} from "@/features/aiden/providers/claude-provider";
import { coinCostForModel } from "@/features/aiden/lib/model-costs";
import { WalletError } from "@/features/wallet/lib/errors";
import {
  captureReservation,
  releaseReservation,
  reserveCoins,
} from "@/features/wallet/services/ledger.service";

export type DescriptionAssistInput = {
  title: string;
  game: string;
  category: string;
  idempotencyKey: string;
};

const SYSTEM_PROMPT =
  "You write concise, accurate marketplace listing descriptions for a game-server " +
  "asset marketplace (skins, maps, mods, server assets). 2-3 sentences, no hype " +
  "language, no unverifiable claims, no emoji. Describe what the item is and what " +
  "it's for, not why the buyer should want it.";

/**
 * Synchronous, not queued like Aiden's Vest/Graft/Terra jobs — Claude
 * responds fast enough that reserve -> call -> capture/release in one
 * request is reasonable, no AidenJob/AidenAsset persistence needed (this
 * is ephemeral form-fill assist text, not a marketplace asset).
 */
export async function generateProductDescription(
  userId: string,
  input: DescriptionAssistInput,
  ipAddress?: string | null,
): Promise<{ description: string }> {
  const shop = await getOwnedShop(userId);
  if (!shop) {
    throw new ShopError("Create a shop before using AI description assist.", "NOT_FOUND");
  }

  const coinCost = coinCostForModel("CLAUDE_TEXT");

  let reservation: Awaited<ReturnType<typeof reserveCoins>>;
  try {
    reservation = await reserveCoins({
      userId,
      amount: coinCost,
      purpose: `Product description assist: ${input.title}`,
      idempotencyKey: `describe-reserve:${input.idempotencyKey}`,
      ...(ipAddress !== undefined ? { ipAddress } : {}),
    });
  } catch (error) {
    if (error instanceof WalletError && error.code === "INSUFFICIENT") {
      throw new ShopError("Insufficient KOBA Coins for AI description assist.", "FORBIDDEN");
    }
    throw error;
  }

  try {
    const result = await generateText({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: `Title: ${input.title}\nGame: ${input.game}\nCategory: ${input.category}`,
      maxTokens: 220,
    });

    await captureReservation({
      userId,
      reservationPublicRef: reservation.publicRef,
      idempotencyKey: `describe-capture:${input.idempotencyKey}`,
      ...(ipAddress !== undefined ? { ipAddress } : {}),
    });

    return { description: result.text.trim() };
  } catch (error) {
    await releaseReservation({
      userId,
      reservationPublicRef: reservation.publicRef,
      idempotencyKey: `describe-release:${input.idempotencyKey}`,
      ...(ipAddress !== undefined ? { ipAddress } : {}),
    });

    if (error instanceof ClaudeNotConfiguredError) {
      throw new ShopError(error.message, "NOT_FOUND");
    }
    if (error instanceof ClaudeGenerationError) {
      throw new ShopError(`AI description assist failed: ${error.message}`, "GENERATION_FAILED");
    }
    throw error;
  }
}
