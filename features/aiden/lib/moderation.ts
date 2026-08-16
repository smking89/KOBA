const BLOCKED_PATTERNS = [
  /\bchild\s*porn/i,
  /\bcsam\b/i,
  /\bmake\s+a\s+bomb\b/i,
  /\bcredit\s*card\s*number\b/i,
];

export type PromptModerationResult = { status: "ALLOWED" } | { status: "BLOCKED"; reason: string };

export function moderateAidenPrompt(prompt: string): PromptModerationResult {
  const trimmed = prompt.trim();
  if (trimmed.length < 4) {
    return { status: "BLOCKED", reason: "Prompt is too short." };
  }
  if (trimmed.length > 2000) {
    return { status: "BLOCKED", reason: "Prompt is too long." };
  }
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { status: "BLOCKED", reason: "Prompt failed automated moderation." };
    }
  }
  const extra = process.env.AIDEN_PROMPT_BLOCKLIST?.split(",")
    .map((row) => row.trim())
    .filter(Boolean);
  if (extra) {
    const lower = trimmed.toLowerCase();
    for (const term of extra) {
      if (term && lower.includes(term.toLowerCase())) {
        return { status: "BLOCKED", reason: "Prompt failed automated moderation." };
      }
    }
  }
  return { status: "ALLOWED" };
}
