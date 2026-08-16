import { jsonPlus, jsonPlusError } from "@/features/plus/lib/http";
import { PLUS_BENEFITS } from "@/features/plus/lib/types";
import { getPlanComparison } from "@/features/plus/services/plus.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const plans = await getPlanComparison();
    return jsonPlus({
      plans,
      benefits: PLUS_BENEFITS,
    });
  } catch (error) {
    return jsonPlusError(error, "Could not load Plus plans.");
  }
}
