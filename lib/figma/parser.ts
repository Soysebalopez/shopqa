import type { FigmaDocumentNode, ParsedFigmaUrl } from "./types";
import type { FigmaTokens, FigmaNode } from "../modules/types";

/**
 * Parse a Figma URL to extract fileKey and optional nodeId.
 * Supports formats:
 *  - figma.com/design/:fileKey/:fileName
 *  - figma.com/design/:fileKey/:fileName?node-id=:nodeId
 *  - figma.com/file/:fileKey/:fileName
 *  - figma.com/design/:fileKey/branch/:branchKey/:fileName
 */
export function parseFigmaUrl(url: string): ParsedFigmaUrl {
  const parsed = new URL(url);

  if (!parsed.hostname.includes("figma.com")) {
    throw new Error("Not a valid Figma URL");
  }

  const pathParts = parsed.pathname.split("/").filter(Boolean);

  // Handle /design/ and /file/ URLs
  const typeIndex = pathParts.findIndex(
    (p) => p === "design" || p === "file"
  );
  if (typeIndex === -1) {
    throw new Error("Could not find file key in Figma URL");
  }

  // Check for branch URLs
  const branchIndex = pathParts.indexOf("branch");
  const fileKey =
    branchIndex !== -1
      ? pathParts[branchIndex + 1]
      : pathParts[typeIndex + 1];

  if (!fileKey) {
    throw new Error("Could not extract file key from Figma URL");
  }

  // Extract node-id from query params
  const nodeIdParam = parsed.searchParams.get("node-id");
  const nodeId = nodeIdParam ? nodeIdParam.replace("-", ":") : undefined;

  return { fileKey, nodeId };
}

/**
 * Extract design tokens (colors, typography, spacing) from Figma node tree.
 */
export function extractTokens(node: FigmaDocumentNode): FigmaTokens {
  const colors: FigmaTokens["colors"] = [];
  const typography: FigmaTokens["typography"] = [];
  const spacing: FigmaTokens["spacing"] = [];
  const seenColors = new Set<string>();
  const seenFonts = new Set<string>();

  function traverse(n: FigmaDocumentNode) {
    // Extract colors from fills
    if (n.fills) {
      for (const fill of n.fills) {
        if (fill.type === "SOLID" && fill.color) {
          const hex = rgbaToHex(fill.color);
          if (!seenColors.has(hex)) {
            seenColors.add(hex);
            colors.push({
              name: n.name,
              hex,
              usage: n.type === "TEXT" ? "text" : "fill",
            });
          }
        }
      }
    }

    // Extract typography from text nodes
    if (n.type === "TEXT" && n.style) {
      const key = `${n.style.fontFamily}-${n.style.fontSize}-${n.style.fontWeight}`;
      if (!seenFonts.has(key)) {
        seenFonts.add(key);
        typography.push({
          name: n.name,
          fontFamily: n.style.fontFamily,
          fontSize: n.style.fontSize,
          fontWeight: n.style.fontWeight,
          lineHeight: n.style.lineHeightPx ?? 0,
          letterSpacing: n.style.letterSpacing ?? 0,
        });
      }
    }

    // Extract spacing from auto-layout frames
    if (n.type === "FRAME" || n.type === "COMPONENT" || n.type === "INSTANCE") {
      if (n.paddingLeft !== undefined) {
        spacing.push({ name: `${n.name}-padding-left`, value: n.paddingLeft });
      }
      if (n.paddingTop !== undefined) {
        spacing.push({ name: `${n.name}-padding-top`, value: n.paddingTop });
      }
      if (n.itemSpacing !== undefined) {
        spacing.push({ name: `${n.name}-gap`, value: n.itemSpacing });
      }
    }

    if (n.children) {
      for (const child of n.children) {
        traverse(child);
      }
    }
  }

  traverse(node);
  return { colors, typography, spacing };
}

/**
 * Flatten Figma node tree into a simplified structure.
 */
export function flattenStructure(node: FigmaDocumentNode): FigmaNode[] {
  const nodes: FigmaNode[] = [];

  function traverse(n: FigmaDocumentNode) {
    nodes.push({
      id: n.id,
      name: n.name,
      type: n.type,
    });
    if (n.children) {
      for (const child of n.children) {
        traverse(child);
      }
    }
  }

  traverse(node);
  return nodes;
}

function rgbaToHex(color: {
  r: number;
  g: number;
  b: number;
  a: number;
}): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
