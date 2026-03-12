import type { ClaudeContent, ClaudeResponse } from "./types";

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";
const MAX_RETRIES = 2;

function getApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY env var is required");
  return key;
}

export async function askClaude(
  systemPrompt: string,
  userContent: ClaudeContent[],
  options: { maxTokens?: number } = {}
): Promise<string> {
  const maxTokens = options.maxTokens ?? 4096;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(CLAUDE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": getApiKey(),
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: [{ role: "user", content: userContent }],
        }),
      });

      if (res.status === 429 || res.status >= 500) {
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
          continue;
        }
      }

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Claude API error ${res.status}: ${body}`);
      }

      const data = (await res.json()) as ClaudeResponse;
      return data.content[0].text;
    } catch (error) {
      if (attempt === MAX_RETRIES) throw error;
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }

  throw new Error("Unreachable");
}

/**
 * Ask Claude to analyze and return structured JSON.
 * Wraps the response in a JSON parse with error handling.
 */
export async function askClaudeJson<T>(
  systemPrompt: string,
  userContent: ClaudeContent[],
  options: { maxTokens?: number } = {}
): Promise<T> {
  const text = await askClaude(systemPrompt, userContent, options);

  // Extract JSON from response (Claude might wrap in ```json blocks)
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);

  if (!jsonMatch) {
    throw new Error(`Claude response was not valid JSON: ${text.slice(0, 200)}`);
  }

  return JSON.parse(jsonMatch[1]) as T;
}
