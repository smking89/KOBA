/** Categories are generic, not branded — per spec. Vest/Graft/Terra are
 * agents registered inside the Generation category, not categories
 * themselves. */
export const AIDEN_CATEGORIES = ["GENERATION", "LOGIC", "DATA", "AUTOMATION", "INTERFACE"] as const;
export type AidenCategoryName = (typeof AIDEN_CATEGORIES)[number];

export type TaskRequest = {
  /** Dot-namespaced task identifier, e.g. "generation.vest". */
  taskType: string;
  payload: unknown;
};

export type RoutingDecision = {
  category: AidenCategoryName;
  agentId: string;
};
