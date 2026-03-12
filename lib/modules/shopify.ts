import type { Issue, HtmlStructure, ComputedStyleEntry } from "./types";

/**
 * Shopify-specific module — checks for essential Shopify store elements.
 * Purely algorithmic checks based on DOM structure.
 */
export function analyzeShopify(
  html: HtmlStructure,
  styles: ComputedStyleEntry[],
  pageUrl: string
): Issue[] {
  const issues: Issue[] = [];
  const isProductPage = detectProductPage(html, pageUrl);

  // Add to Cart button (product pages)
  if (isProductPage) {
    const hasAddToCart = styles.some(
      (s) =>
        s.text &&
        /add\s+to\s+cart|agregar\s+al\s+carrito|comprar|buy\s+now/i.test(s.text) &&
        (s.tagName === "button" || s.tagName === "input" || s.tagName === "a")
    );

    if (!hasAddToCart) {
      issues.push({
        category: "shopify",
        subcategory: "add-to-cart",
        severity: "critical",
        title: "Add to Cart button not detected",
        description:
          "Could not find an Add to Cart button on what appears to be a product page. This is essential for conversions.",
        suggestion:
          "Ensure the Add to Cart button is visible and uses standard text ('Add to Cart', 'Buy Now', etc.).",
      });
    }

    // Price display
    const hasPrice = styles.some(
      (s) =>
        s.text &&
        /\$[\d,.]+|€[\d,.]+|£[\d,.]+|[\d,.]+\s*(USD|EUR|GBP|ARS|MXN)/i.test(
          s.text
        )
    );

    if (!hasPrice) {
      issues.push({
        category: "shopify",
        subcategory: "pricing",
        severity: "critical",
        title: "Product price not detected",
        description: "Could not find a visible price on the product page.",
        suggestion:
          "Ensure the product price is clearly displayed with proper currency formatting.",
      });
    }
  }

  // Legal policies
  const policyLinks = html.links.filter(
    (l) =>
      /privacy\s*policy|terms\s*of\s*service|terms\s*&?\s*conditions|refund\s*policy|shipping\s*policy/i.test(
        l.text
      ) ||
      /\/policies\//i.test(l.href)
  );

  if (policyLinks.length === 0) {
    issues.push({
      category: "shopify",
      subcategory: "policies",
      severity: "critical",
      title: "No legal policy links found",
      description:
        "Could not find links to Privacy Policy or Terms of Service. These are required by Shopify Payments and most payment processors.",
      suggestion:
        "Add links to Privacy Policy and Terms of Service, typically in the footer.",
    });
  }

  // Favicon check
  // (We check via HTML — look for favicon link in the structure)
  // Note: This is a simplified check. Real implementation would check HTTP response.

  // Cart icon/link
  const hasCartLink = html.links.some(
    (l) =>
      /\/cart/i.test(l.href) ||
      /cart|carrito|bag|basket/i.test(l.text)
  );

  if (!hasCartLink) {
    issues.push({
      category: "shopify",
      subcategory: "cart",
      severity: "warning",
      title: "Cart link not detected",
      description:
        "Could not find a cart link or icon in the navigation. Users need easy access to their cart.",
      suggestion:
        "Ensure a cart icon or link is visible in the header/navigation.",
    });
  }

  // Currency consistency
  const priceTexts = styles
    .filter(
      (s) =>
        s.text &&
        /\$|€|£|¥/.test(s.text) &&
        /\d/.test(s.text)
    )
    .map((s) => s.text!);

  const currencies = new Set<string>();
  for (const text of priceTexts) {
    if (text.includes("$")) currencies.add("$");
    if (text.includes("€")) currencies.add("€");
    if (text.includes("£")) currencies.add("£");
    if (text.includes("¥")) currencies.add("¥");
  }

  if (currencies.size > 1) {
    issues.push({
      category: "shopify",
      subcategory: "currency",
      severity: "warning",
      title: "Mixed currency symbols detected",
      description: `Found multiple currency symbols on the page: ${[...currencies].join(", ")}. This may confuse customers.`,
      actual_value: [...currencies].join(", "),
      suggestion: "Ensure consistent currency formatting throughout the store.",
    });
  }

  return issues;
}

function detectProductPage(html: HtmlStructure, url: string): boolean {
  // Heuristics for product page detection
  if (/\/products\//i.test(url)) return true;

  // Check for Product schema
  const hasProductSchema = html.schemaMarkup.some(
    (s) =>
      typeof s === "object" &&
      s !== null &&
      "@type" in (s as Record<string, unknown>) &&
      (s as Record<string, unknown>)["@type"] === "Product"
  );

  if (hasProductSchema) return true;

  // Check for og:type product
  if (html.ogTags["og:type"] === "product") return true;

  return false;
}
