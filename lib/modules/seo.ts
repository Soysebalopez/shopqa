import type { HtmlStructure, Issue } from "./types";

/**
 * SEO module — purely algorithmic checks.
 * No AI needed; analyzes HTML structure for SEO best practices.
 */
export function analyzeSeo(html: HtmlStructure, webUrl: string): Issue[] {
  const issues: Issue[] = [];

  // Meta title
  if (!html.title) {
    issues.push({
      category: "seo",
      subcategory: "meta-title",
      severity: "critical",
      title: "Missing page title",
      description: "The page has no <title> tag. This is essential for SEO and browser tabs.",
      suggestion: "Add a descriptive <title> tag between 30-60 characters.",
    });
  } else if (html.title.length < 30) {
    issues.push({
      category: "seo",
      subcategory: "meta-title",
      severity: "warning",
      title: "Page title too short",
      description: `Title is ${html.title.length} characters: "${html.title}". Recommended: 30-60 characters.`,
      actual_value: `${html.title.length} chars`,
      expected_value: "30-60 chars",
      suggestion: "Expand the title with relevant keywords while keeping it under 60 characters.",
    });
  } else if (html.title.length > 60) {
    issues.push({
      category: "seo",
      subcategory: "meta-title",
      severity: "warning",
      title: "Page title too long",
      description: `Title is ${html.title.length} characters. It may be truncated in search results.`,
      actual_value: `${html.title.length} chars`,
      expected_value: "30-60 chars",
      suggestion: "Shorten the title to under 60 characters to prevent truncation.",
    });
  }

  // Meta description
  if (!html.metaDescription) {
    issues.push({
      category: "seo",
      subcategory: "meta-description",
      severity: "warning",
      title: "Missing meta description",
      description: "No meta description found. Search engines will auto-generate one.",
      suggestion: "Add a meta description between 120-160 characters.",
    });
  } else if (html.metaDescription.length < 120) {
    issues.push({
      category: "seo",
      subcategory: "meta-description",
      severity: "info",
      title: "Meta description could be longer",
      description: `Meta description is ${html.metaDescription.length} characters. Longer descriptions provide more context.`,
      actual_value: `${html.metaDescription.length} chars`,
      expected_value: "120-160 chars",
      suggestion: "Expand the meta description to 120-160 characters.",
    });
  } else if (html.metaDescription.length > 160) {
    issues.push({
      category: "seo",
      subcategory: "meta-description",
      severity: "info",
      title: "Meta description too long",
      description: `Meta description is ${html.metaDescription.length} characters. It will be truncated.`,
      actual_value: `${html.metaDescription.length} chars`,
      expected_value: "120-160 chars",
      suggestion: "Shorten meta description to under 160 characters.",
    });
  }

  // Open Graph tags
  const requiredOg = ["og:title", "og:description", "og:image", "og:url"];
  for (const tag of requiredOg) {
    if (!html.ogTags[tag]) {
      issues.push({
        category: "seo",
        subcategory: "open-graph",
        severity: tag === "og:image" ? "warning" : "info",
        title: `Missing ${tag}`,
        description: `The ${tag} meta tag is not present. This affects how the page appears when shared on social media.`,
        suggestion: `Add <meta property="${tag}" content="..."> to the page head.`,
      });
    }
  }

  // Twitter Card tags
  const requiredTwitter = ["twitter:card", "twitter:title", "twitter:description"];
  const missingTwitter = requiredTwitter.filter((t) => !html.twitterTags[t]);
  if (missingTwitter.length > 0) {
    issues.push({
      category: "seo",
      subcategory: "twitter-cards",
      severity: "info",
      title: "Missing Twitter Card tags",
      description: `Missing: ${missingTwitter.join(", ")}. Twitter Card tags improve appearance when shared on X/Twitter.`,
      suggestion: "Add Twitter Card meta tags for better social sharing.",
    });
  }

  // Heading hierarchy
  const h1s = html.headings.filter((h) => h.level === 1);
  if (h1s.length === 0) {
    issues.push({
      category: "seo",
      subcategory: "headings",
      severity: "critical",
      title: "Missing H1 heading",
      description: "The page has no H1 heading. Every page should have exactly one H1.",
      suggestion: "Add a single H1 tag that describes the page content.",
    });
  } else if (h1s.length > 1) {
    issues.push({
      category: "seo",
      subcategory: "headings",
      severity: "warning",
      title: "Multiple H1 headings",
      description: `Found ${h1s.length} H1 headings. Best practice is to have exactly one.`,
      actual_value: `${h1s.length} H1 tags`,
      expected_value: "1 H1 tag",
      suggestion: "Keep only the most important H1 and convert others to H2.",
    });
  }

  // Check heading hierarchy (no skipping levels)
  for (let i = 1; i < html.headings.length; i++) {
    const prev = html.headings[i - 1].level;
    const curr = html.headings[i].level;
    if (curr > prev + 1) {
      issues.push({
        category: "seo",
        subcategory: "headings",
        severity: "warning",
        title: "Heading level skipped",
        description: `Heading jumps from H${prev} to H${curr}: "${html.headings[i].text.slice(0, 50)}". Heading levels should not skip.`,
        actual_value: `H${prev} → H${curr}`,
        expected_value: `H${prev} → H${prev + 1}`,
        suggestion: "Fix the heading hierarchy to not skip levels.",
      });
      break; // Only report first skip
    }
  }

  // Image alt text
  const imagesWithoutAlt = html.images.filter(
    (img) => !img.alt || img.alt.trim() === ""
  );
  if (imagesWithoutAlt.length > 0) {
    issues.push({
      category: "seo",
      subcategory: "images",
      severity: "warning",
      title: `${imagesWithoutAlt.length} images missing alt text`,
      description: "Images without alt text hurt accessibility and SEO.",
      actual_value: `${imagesWithoutAlt.length} images without alt`,
      suggestion: "Add descriptive alt text to all meaningful images.",
    });
  }

  // Generic alt text
  const genericAlts = html.images.filter((img) =>
    img.alt && /^(image|photo|picture|img|banner|icon)$/i.test(img.alt.trim())
  );
  if (genericAlts.length > 0) {
    issues.push({
      category: "seo",
      subcategory: "images",
      severity: "info",
      title: `${genericAlts.length} images with generic alt text`,
      description: "Some images have generic alt text like 'image' or 'photo' that doesn't describe the content.",
      suggestion: "Replace generic alt text with descriptive alternatives.",
    });
  }

  // Canonical URL
  if (!html.canonical) {
    issues.push({
      category: "seo",
      subcategory: "canonical",
      severity: "warning",
      title: "Missing canonical URL",
      description: "No canonical link found. This can cause duplicate content issues.",
      suggestion: `Add <link rel="canonical" href="${webUrl}"> to prevent duplicate content.`,
    });
  }

  // noindex check
  if (html.hasNoIndex) {
    issues.push({
      category: "seo",
      subcategory: "indexing",
      severity: "critical",
      title: "Page set to noindex",
      description: "This page has a noindex directive. It will not appear in search results.",
      suggestion: "Remove the noindex directive unless this page should intentionally not be indexed.",
    });
  }

  // Schema markup
  if (html.schemaMarkup.length === 0) {
    issues.push({
      category: "seo",
      subcategory: "schema",
      severity: "info",
      title: "No structured data found",
      description: "No JSON-LD structured data found. Schema markup helps search engines understand your content.",
      suggestion: "Add Product, Organization, or BreadcrumbList schema as appropriate.",
    });
  }

  return issues;
}
