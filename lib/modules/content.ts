import type { Issue, HtmlStructure } from "./types";

const PLACEHOLDER_PATTERNS = [
  /lorem\s+ipsum/i,
  /placeholder/i,
  /\bTBD\b/,
  /\bTODO\b/,
  /\[texto\]/i,
  /\[text\]/i,
  /\basdf\b/i,
  /\btest\s*test\b/i,
  /\bxxx\b/i,
  /sample\s+text/i,
  /your\s+(text|title|description)\s+here/i,
  /insert\s+(text|title|content)\s+here/i,
];

/**
 * Content module — checks for broken links, placeholder text, and CTA consistency.
 * Link checking is done algorithmically. Claude handles ambiguous detection.
 */
export function analyzeContent(html: HtmlStructure): Issue[] {
  const issues: Issue[] = [];

  // Placeholder text detection
  const allText = [
    html.title,
    html.metaDescription,
    ...html.headings.map((h) => h.text),
  ].filter(Boolean) as string[];

  for (const text of allText) {
    for (const pattern of PLACEHOLDER_PATTERNS) {
      if (pattern.test(text)) {
        issues.push({
          category: "content",
          subcategory: "placeholder",
          severity: "critical",
          title: "Placeholder text detected",
          description: `Found placeholder text: "${text.slice(0, 80)}"`,
          actual_value: text.slice(0, 100),
          suggestion: "Replace placeholder text with real content before launch.",
        });
        break;
      }
    }
  }

  // Empty links
  const emptyLinks = html.links.filter(
    (l) => !l.text || l.text.trim() === ""
  );
  if (emptyLinks.length > 0) {
    issues.push({
      category: "content",
      subcategory: "links",
      severity: "warning",
      title: `${emptyLinks.length} links without text`,
      description:
        "Links without visible text are hard to understand for users and screen readers.",
      actual_value: `${emptyLinks.length} empty links`,
      suggestion:
        "Add descriptive text to all links, or use aria-label for icon-only links.",
    });
  }

  // Mixed content (HTTP on HTTPS page)
  const httpImages = html.images.filter(
    (img) => img.src && img.src.startsWith("http://")
  );
  if (httpImages.length > 0) {
    issues.push({
      category: "content",
      subcategory: "mixed-content",
      severity: "warning",
      title: `${httpImages.length} images loaded over HTTP`,
      description:
        "Images loaded over HTTP on an HTTPS page create mixed content warnings and may be blocked.",
      actual_value: `${httpImages.length} HTTP images`,
      suggestion: "Update all image URLs to use HTTPS.",
    });
  }

  // Broken image detection (basic — checks for obviously invalid src)
  const suspiciousImages = html.images.filter(
    (img) =>
      !img.src ||
      img.src === "" ||
      img.src === "#" ||
      img.src.includes("undefined") ||
      img.src.includes("null")
  );
  if (suspiciousImages.length > 0) {
    issues.push({
      category: "content",
      subcategory: "broken-images",
      severity: "critical",
      title: `${suspiciousImages.length} potentially broken images`,
      description: "Some images have invalid or empty src attributes.",
      actual_value: `${suspiciousImages.length} broken images`,
      suggestion: "Fix or remove images with invalid src attributes.",
    });
  }

  return issues;
}

/**
 * Check links by fetching them. Returns issues for broken links.
 * Should be called separately due to async nature.
 */
export async function checkLinks(
  links: HtmlStructure["links"],
  baseUrl: string
): Promise<Issue[]> {
  const issues: Issue[] = [];
  const checked = new Set<string>();
  const brokenNav: string[] = [];
  const brokenOther: string[] = [];

  // Limit to first 50 links to avoid excessive requests
  const linksToCheck = links.slice(0, 50);

  for (const link of linksToCheck) {
    if (!link.href || link.href === "#" || link.href.startsWith("javascript:"))
      continue;
    if (checked.has(link.href)) continue;
    checked.add(link.href);

    try {
      const url = new URL(link.href, baseUrl);
      const res = await fetch(url.toString(), {
        method: "HEAD",
        signal: AbortSignal.timeout(5000),
        redirect: "follow",
      });

      if (res.status >= 400) {
        const isNav =
          link.text.length < 30 &&
          !link.isExternal; // rough heuristic
        if (isNav) {
          brokenNav.push(`${link.text} (${link.href}) → ${res.status}`);
        } else {
          brokenOther.push(`${link.text} (${link.href}) → ${res.status}`);
        }
      }
    } catch {
      // Timeout or network error
      brokenOther.push(`${link.text} (${link.href}) → timeout/error`);
    }
  }

  if (brokenNav.length > 0) {
    issues.push({
      category: "content",
      subcategory: "broken-links",
      severity: "critical",
      title: `${brokenNav.length} broken navigation links`,
      description: `Found broken links in navigation: ${brokenNav.join("; ")}`,
      suggestion: "Fix or remove broken navigation links immediately.",
    });
  }

  if (brokenOther.length > 0) {
    issues.push({
      category: "content",
      subcategory: "broken-links",
      severity: "warning",
      title: `${brokenOther.length} broken links`,
      description: `Found broken links: ${brokenOther.slice(0, 5).join("; ")}${brokenOther.length > 5 ? ` and ${brokenOther.length - 5} more` : ""}`,
      suggestion: "Review and fix broken links.",
    });
  }

  return issues;
}
