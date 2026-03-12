import type { Issue } from "./types";
import { askClaudeJson } from "../claude/client";
import type { ClaudeContent } from "../claude/types";

const CROSS_BROWSER_PROMPT = `You are a cross-browser compatibility expert comparing screenshots of the same web page rendered in Chrome and WebKit (Safari approximation via Playwright).

Analyze the visual differences between the two browser renderings. The first image is Chrome, the second is WebKit.

Focus on:
1. Layout differences (flexbox/grid rendering, spacing)
2. Typography rendering differences
3. Border-radius, shadows, backdrop-filter differences
4. Elements that are visible in one browser but not the other
5. Scroll behavior or overflow differences

Note: WebKit in Playwright is an approximation of Safari, not identical. Minor font smoothing differences are expected and not issues.

Respond in JSON format:
[
  {
    "subcategory": "layout" | "typography" | "visual" | "missing-element",
    "severity": "critical" | "warning" | "info",
    "title": "short description",
    "description": "detailed description",
    "suggestion": "CSS fix or workaround"
  }
]

Only report meaningful rendering differences that users would notice. Return [] if the pages look essentially identical.`;

/**
 * Cross-browser module — compares Chrome vs WebKit screenshots using Claude Vision.
 */
export async function analyzeCrossBrowser(
  chromeScreenshot: Buffer,
  webkitScreenshot: Buffer,
  viewport: "desktop" | "mobile"
): Promise<Issue[]> {
  const content: ClaudeContent[] = [
    {
      type: "text",
      text: `Compare these ${viewport} screenshots. First is Chrome, second is WebKit (Safari). Report meaningful rendering differences.`,
    },
    {
      type: "image",
      source: {
        type: "base64",
        media_type: "image/png",
        data: chromeScreenshot.toString("base64"),
      },
    },
    {
      type: "image",
      source: {
        type: "base64",
        media_type: "image/png",
        data: webkitScreenshot.toString("base64"),
      },
    },
  ];

  const raw = await askClaudeJson<Omit<Issue, "category">[]>(
    CROSS_BROWSER_PROMPT,
    content,
    { maxTokens: 2048 }
  );

  return raw.map((i) => ({ ...i, category: "cross-browser" as const }));
}
