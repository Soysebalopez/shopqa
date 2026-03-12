import type { Issue, FigmaTokens, ComputedStyleEntry } from "./types";
import { askClaudeJson } from "../claude/client";
import {
  DESIGN_QA_VISUAL_PROMPT,
  DESIGN_QA_TOKENS_PROMPT,
} from "../claude/prompts/design-qa";
import type { ClaudeContent } from "../claude/types";

/**
 * Design QA module — compares Figma design with web implementation.
 * Uses Claude Vision for visual diff and algorithmic comparison for tokens.
 */
export async function analyzeDesignQa(
  figmaScreenshot: Buffer | null,
  webScreenshot: Buffer | null,
  figmaTokens: FigmaTokens | null,
  computedStyles: ComputedStyleEntry[]
): Promise<Issue[]> {
  const issues: Issue[] = [];

  // Visual diff with Claude Vision
  if (figmaScreenshot && webScreenshot) {
    try {
      const visualIssues = await analyzeVisualDiff(
        figmaScreenshot,
        webScreenshot
      );
      issues.push(...visualIssues);
    } catch (err) {
      console.error("Visual diff analysis failed:", err);
    }
  }

  // Token comparison
  if (figmaTokens) {
    const tokenIssues = compareTokens(figmaTokens, computedStyles);
    issues.push(...tokenIssues);
  }

  return issues;
}

async function analyzeVisualDiff(
  figmaScreenshot: Buffer,
  webScreenshot: Buffer
): Promise<Issue[]> {
  const content: ClaudeContent[] = [
    {
      type: "text",
      text: "Compare these two images. The first is the Figma design, the second is the web implementation.",
    },
    {
      type: "image",
      source: {
        type: "base64",
        media_type: "image/png",
        data: figmaScreenshot.toString("base64"),
      },
    },
    {
      type: "image",
      source: {
        type: "base64",
        media_type: "image/png",
        data: webScreenshot.toString("base64"),
      },
    },
  ];

  const raw = await askClaudeJson<Omit<Issue, "category">[]>(
    DESIGN_QA_VISUAL_PROMPT,
    content,
    { maxTokens: 4096 }
  );

  return raw.map((i) => ({ ...i, category: "design-qa" as const }));
}

function compareTokens(
  figmaTokens: FigmaTokens,
  computedStyles: ComputedStyleEntry[]
): Issue[] {
  const issues: Issue[] = [];

  // Compare colors
  for (const figmaColor of figmaTokens.colors) {
    const matchingElements = computedStyles.filter((s) => {
      const cssColor = figmaColor.usage === "text" ? s.styles.color : s.styles.backgroundColor;
      if (!cssColor) return false;
      return true; // We'll compare in the next step
    });

    // Simple color comparison for text elements
    if (figmaColor.usage === "text") {
      for (const el of matchingElements.slice(0, 3)) {
        const cssHex = cssColorToHex(el.styles.color);
        if (cssHex && !colorsClose(figmaColor.hex, cssHex, 15)) {
          issues.push({
            category: "design-qa",
            subcategory: "token-mismatch",
            severity: colorsClose(figmaColor.hex, cssHex, 30) ? "info" : "warning",
            title: `Color mismatch on ${el.selector}`,
            description: `Text color differs from Figma design.`,
            expected_value: figmaColor.hex,
            actual_value: cssHex,
            element: el.selector,
            suggestion: `Update color to ${figmaColor.hex}`,
          });
        }
      }
    }
  }

  // Compare typography
  for (const figmaFont of figmaTokens.typography) {
    const headings = computedStyles.filter(
      (s) =>
        s.tagName.match(/^h[1-6]$/) &&
        s.text &&
        s.text.length > 0
    );

    for (const heading of headings.slice(0, 3)) {
      const cssFontSize = parseFloat(heading.styles.fontSize);
      if (cssFontSize && Math.abs(cssFontSize - figmaFont.fontSize) > 2) {
        issues.push({
          category: "design-qa",
          subcategory: "token-mismatch",
          severity: Math.abs(cssFontSize - figmaFont.fontSize) > 4 ? "warning" : "info",
          title: `Font size mismatch on ${heading.selector}`,
          description: `Font size differs from Figma: expected ${figmaFont.fontSize}px, got ${cssFontSize}px.`,
          expected_value: `${figmaFont.fontSize}px`,
          actual_value: `${cssFontSize}px`,
          element: heading.selector,
          suggestion: `Update font-size to ${figmaFont.fontSize}px`,
        });
      }
    }
  }

  return issues;
}

function cssColorToHex(cssColor: string): string | null {
  const match = cssColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return null;
  const r = parseInt(match[1]);
  const g = parseInt(match[2]);
  const b = parseInt(match[3]);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function colorsClose(hex1: string, hex2: string, threshold: number): boolean {
  const r1 = parseInt(hex1.slice(1, 3), 16);
  const g1 = parseInt(hex1.slice(3, 5), 16);
  const b1 = parseInt(hex1.slice(5, 7), 16);
  const r2 = parseInt(hex2.slice(1, 3), 16);
  const g2 = parseInt(hex2.slice(3, 5), 16);
  const b2 = parseInt(hex2.slice(5, 7), 16);
  const distance = Math.sqrt(
    (r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2
  );
  return distance < threshold;
}
