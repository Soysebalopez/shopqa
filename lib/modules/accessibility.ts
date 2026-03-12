import type { Issue, LighthouseReport, HtmlStructure, ComputedStyleEntry } from "./types";

/**
 * Accessibility module — combines Lighthouse a11y audit with custom checks.
 */
export function analyzeAccessibility(
  lighthouse: LighthouseReport | undefined,
  html: HtmlStructure,
  styles: ComputedStyleEntry[]
): Issue[] {
  const issues: Issue[] = [];

  // Lighthouse a11y score
  if (lighthouse) {
    if (lighthouse.scores.accessibility < 50) {
      issues.push({
        category: "accessibility",
        subcategory: "score",
        severity: "critical",
        title: `Accessibility score: ${lighthouse.scores.accessibility}`,
        description: `Lighthouse accessibility score is ${lighthouse.scores.accessibility}/100. Multiple accessibility barriers detected.`,
        actual_value: `${lighthouse.scores.accessibility}/100`,
        expected_value: "90+/100",
        suggestion: "Address critical accessibility issues below.",
      });
    } else if (lighthouse.scores.accessibility < 90) {
      issues.push({
        category: "accessibility",
        subcategory: "score",
        severity: "warning",
        title: `Accessibility score: ${lighthouse.scores.accessibility}`,
        description: `Score of ${lighthouse.scores.accessibility}/100 indicates some accessibility improvements needed.`,
        actual_value: `${lighthouse.scores.accessibility}/100`,
        expected_value: "90+/100",
      });
    }
  }

  // Images without alt text
  const noAlt = html.images.filter((img) => !img.alt || img.alt.trim() === "");
  if (noAlt.length > 0) {
    issues.push({
      category: "accessibility",
      subcategory: "images",
      severity: "critical",
      title: `${noAlt.length} images without alt text`,
      description:
        "Screen readers cannot describe these images to visually impaired users.",
      actual_value: `${noAlt.length} images missing alt`,
      suggestion:
        "Add descriptive alt text to all meaningful images. Use alt=\"\" for decorative images.",
    });
  }

  // Check for color contrast issues via computed styles
  const lowContrastElements = checkContrast(styles);
  if (lowContrastElements.length > 0) {
    issues.push({
      category: "accessibility",
      subcategory: "contrast",
      severity: lowContrastElements.some((e) => e.ratio < 3) ? "critical" : "warning",
      title: `${lowContrastElements.length} elements with low color contrast`,
      description: `Found ${lowContrastElements.length} text elements that may not meet WCAG AA contrast requirements (4.5:1 for normal text, 3:1 for large text).`,
      suggestion: "Increase contrast between text color and background color.",
      metadata: { elements: lowContrastElements.slice(0, 5) },
    });
  }

  // Check heading hierarchy
  const headings = html.headings;
  if (headings.length === 0) {
    issues.push({
      category: "accessibility",
      subcategory: "structure",
      severity: "warning",
      title: "No headings found",
      description:
        "The page has no heading elements. Headings help screen reader users navigate the page structure.",
      suggestion: "Add appropriate heading elements (H1-H6) to organize content.",
    });
  }

  // Check for landmark regions
  // (We can infer from HTML structure)
  const hasMain = html.links.length > 0; // rough proxy — would need DOM check
  if (!hasMain) {
    issues.push({
      category: "accessibility",
      subcategory: "landmarks",
      severity: "info",
      title: "Consider adding landmark regions",
      description:
        "Ensure the page has proper landmark regions (<main>, <nav>, <header>, <footer>) for screen reader navigation.",
      suggestion: "Use semantic HTML elements for page regions.",
    });
  }

  return issues;
}

interface ContrastResult {
  selector: string;
  text: string;
  ratio: number;
  foreground: string;
  background: string;
}

function checkContrast(styles: ComputedStyleEntry[]): ContrastResult[] {
  const results: ContrastResult[] = [];

  for (const entry of styles) {
    if (!entry.text || entry.text.trim() === "") continue;
    if (!entry.styles.color || !entry.styles.backgroundColor) continue;

    const fg = parseColor(entry.styles.color);
    const bg = parseColor(entry.styles.backgroundColor);
    if (!fg || !bg) continue;

    // Skip transparent backgrounds
    if (bg.a === 0) continue;

    const ratio = getContrastRatio(fg, bg);
    if (ratio < 4.5) {
      results.push({
        selector: entry.selector,
        text: entry.text.slice(0, 30),
        ratio: Math.round(ratio * 100) / 100,
        foreground: entry.styles.color,
        background: entry.styles.backgroundColor,
      });
    }
  }

  return results;
}

interface ParsedColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

function parseColor(colorStr: string): ParsedColor | null {
  const rgba = colorStr.match(
    /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/
  );
  if (!rgba) return null;
  return {
    r: parseInt(rgba[1]) / 255,
    g: parseInt(rgba[2]) / 255,
    b: parseInt(rgba[3]) / 255,
    a: rgba[4] ? parseFloat(rgba[4]) : 1,
  };
}

function luminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastRatio(fg: ParsedColor, bg: ParsedColor): number {
  const l1 = luminance(fg.r, fg.g, fg.b);
  const l2 = luminance(bg.r, bg.g, bg.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}
