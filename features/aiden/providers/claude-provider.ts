import { isEnvConfigured } from "@/features/aiden/providers/env-gate";

const ENV_VAR = "ANTHROPIC_API_KEY";
const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-5";

export class ClaudeNotConfiguredError extends Error {
  constructor() {
    super(`Claude text generation has no configured API key (set ${ENV_VAR} to enable).`);
    this.name = "ClaudeNotConfiguredError";
  }
}

export class ClaudeGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClaudeGenerationError";
  }
}

export function isClaudeConfigured(): boolean {
  return isEnvConfigured(ENV_VAR);
}

/**
 * Real, working integration — unlike Vest/Graft/Terra's providers, this
 * genuinely calls the Anthropic Messages API rather than failing closed
 * unconditionally. Still fails closed if ANTHROPIC_API_KEY is unset/a
 * placeholder, same contract as every other provider in this codebase.
 */
export async function generateText(input: {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
}): Promise<{ text: string; usage: { inputTokens: number; outputTokens: number } }> {
  if (!isClaudeConfigured()) {
    throw new ClaudeNotConfiguredError();
  }

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env[ENV_VAR] as string,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: input.maxTokens ?? 512,
      system: input.systemPrompt,
      messages: [{ role: "user", content: input.userPrompt }],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new ClaudeGenerationError(`Claude API returned ${response.status}: ${body.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text?: string }>;
    usage: { input_tokens: number; output_tokens: number };
  };

  const text = data.content.find((block) => block.type === "text")?.text;
  if (!text) {
    throw new ClaudeGenerationError("Claude API response had no text content.");
  }

  return {
    text,
    usage: { inputTokens: data.usage.input_tokens, outputTokens: data.usage.output_tokens },
  };
}
