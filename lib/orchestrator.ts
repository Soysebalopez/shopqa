import { parseFigmaUrl, extractTokens, flattenStructure } from "./figma/parser";
import * as figmaClient from "./figma/client";
import { captureWebPage } from "./playwright/capture";
import { analyzeSeo } from "./modules/seo";
import { analyzePerformance } from "./modules/performance";
import { analyzeAccessibility } from "./modules/accessibility";
import { analyzeContent, checkLinks } from "./modules/content";
import { analyzeShopify } from "./modules/shopify";
import { analyzeDesignQa } from "./modules/design-qa";
import { analyzeCrossBrowser } from "./modules/cross-browser";
import { askClaudeJson } from "./claude/client";
import { SEO_SYSTEM_PROMPT } from "./claude/prompts/seo";
import { CONTENT_SYSTEM_PROMPT } from "./claude/prompts/content";
import { SHOPIFY_SYSTEM_PROMPT } from "./claude/prompts/shopify";
import { SUMMARY_SYSTEM_PROMPT } from "./claude/prompts/summary";
import {
  updateModuleStatus,
  saveIssues,
  completeReport,
  failReport,
  getReportIssues,
} from "./supabase/queries";
import type {
  Issue,
  ReportInput,
  ExtractedFigmaData,
  WebCaptureData,
  Category,
} from "./modules/types";

/**
 * Main orchestrator — runs the full QA pipeline for a report.
 */
export async function runPipeline(reportId: string, input: ReportInput) {
  try {
    // Step 1: Extract data in parallel
    let figmaData: ExtractedFigmaData | null = null;
    let webDataChrome: WebCaptureData;

    // Use fetch-based extraction by default (fast, works everywhere)
    // Playwright/Browserless is used only when BROWSERLESS_TOKEN is set and reachable
    const useBrowserless = process.env.BROWSERLESS_TOKEN && process.env.USE_BROWSERLESS === "true";

    if (useBrowserless) {
      try {
        const [fd, wd] = await Promise.all([
          input.figma_url ? extractFigmaData(input.figma_url) : null,
          extractWebData(input.web_url, input.viewports, "chromium"),
        ]);
        figmaData = fd;
        webDataChrome = wd;
      } catch (captureError) {
        console.error("Playwright capture failed, falling back to fetch:", captureError);
        webDataChrome = await extractWebDataFallback(input.web_url);
      }
    } else {
      console.log("Using fetch-based extraction (set USE_BROWSERLESS=true to use Playwright)");
      const [fd, wd] = await Promise.all([
        input.figma_url ? extractFigmaData(input.figma_url) : null,
        extractWebDataFallback(input.web_url),
      ]);
      figmaData = fd;
      webDataChrome = wd;
    }

    // Step 2: Run analysis modules in parallel
    const modulePromises: Promise<void>[] = [];

    // SEO (algorithmic + Claude enrichment)
    modulePromises.push(
      runModule(reportId, "seo", async () => {
        const algoIssues = analyzeSeo(webDataChrome.htmlStructure, input.web_url);
        let claudeIssues: Issue[] = [];
        try {
          const raw = await askClaudeJson<Omit<Issue, "category">[]>(
            SEO_SYSTEM_PROMPT,
            [{
              type: "text",
              text: JSON.stringify({
                url: input.web_url,
                title: webDataChrome.htmlStructure.title,
                metaDescription: webDataChrome.htmlStructure.metaDescription,
                headings: webDataChrome.htmlStructure.headings,
                ogTags: webDataChrome.htmlStructure.ogTags,
                schemaMarkup: webDataChrome.htmlStructure.schemaMarkup,
              }),
            }]
          );
          claudeIssues = raw.map((i) => ({ ...i, category: "seo" as const }));
        } catch (err) {
          console.error("Claude SEO enrichment failed:", err);
        }
        return [...algoIssues, ...claudeIssues];
      })
    );

    // Performance (algorithmic from Lighthouse data)
    modulePromises.push(
      runModule(reportId, "performance", async () => {
        return analyzePerformance(
          webDataChrome.lighthouseReport,
          webDataChrome.htmlStructure.images
        );
      })
    );

    // Accessibility (algorithmic + Lighthouse)
    modulePromises.push(
      runModule(reportId, "accessibility", async () => {
        return analyzeAccessibility(
          webDataChrome.lighthouseReport,
          webDataChrome.htmlStructure,
          webDataChrome.computedStyles
        );
      })
    );

    // Content (algorithmic + link checking + Claude)
    modulePromises.push(
      runModule(reportId, "content", async () => {
        const algoIssues = analyzeContent(webDataChrome.htmlStructure);
        const linkIssues = await checkLinks(
          webDataChrome.htmlStructure.links,
          input.web_url
        );

        // Claude content analysis
        let claudeIssues: Issue[] = [];
        try {
          const buttonTexts = webDataChrome.computedStyles
            .filter((s) => s.tagName === "button" || s.tagName === "a")
            .map((s) => s.text)
            .filter(Boolean);

          const raw = await askClaudeJson<Omit<Issue, "category">[]>(
            CONTENT_SYSTEM_PROMPT,
            [{
              type: "text",
              text: JSON.stringify({
                headings: webDataChrome.htmlStructure.headings,
                buttonTexts,
                title: webDataChrome.htmlStructure.title,
              }),
            }]
          );
          claudeIssues = raw.map((i) => ({ ...i, category: "content" as const }));
        } catch (err) {
          console.error("Claude content analysis failed:", err);
        }

        return [...algoIssues, ...linkIssues, ...claudeIssues];
      })
    );

    // Shopify-specific (algorithmic + Claude)
    modulePromises.push(
      runModule(reportId, "shopify", async () => {
        const algoIssues = analyzeShopify(
          webDataChrome.htmlStructure,
          webDataChrome.computedStyles,
          input.web_url
        );

        let claudeIssues: Issue[] = [];
        try {
          const raw = await askClaudeJson<Omit<Issue, "category">[]>(
            SHOPIFY_SYSTEM_PROMPT,
            [{
              type: "text",
              text: JSON.stringify({
                url: input.web_url,
                linksCount: webDataChrome.htmlStructure.links.length,
                imagesCount: webDataChrome.htmlStructure.images.length,
                headings: webDataChrome.htmlStructure.headings,
                schemaMarkup: webDataChrome.htmlStructure.schemaMarkup,
              }),
            }]
          );
          claudeIssues = raw.map((i) => ({ ...i, category: "shopify" as const }));
        } catch (err) {
          console.error("Claude Shopify analysis failed:", err);
        }

        return [...algoIssues, ...claudeIssues];
      })
    );

    // Design QA (only with Figma data)
    if (figmaData) {
      modulePromises.push(
        runModule(reportId, "design-qa", async () => {
          const figmaScreenshot = figmaData.screenshots[0]?.buffer || null;
          const webScreenshot = webDataChrome.screenshots[0]?.buffer || null;

          return analyzeDesignQa(
            figmaScreenshot,
            webScreenshot,
            figmaData.tokens,
            webDataChrome.computedStyles
          );
        })
      );

      // Cross-browser
      modulePromises.push(
        runModule(reportId, "cross-browser", async () => {
          // Capture WebKit screenshots
          const webDataWebKit = await extractWebData(
            input.web_url,
            input.viewports,
            "webkit"
          );

          const issues: Issue[] = [];
          for (const vp of input.viewports) {
            const chromeShot = webDataChrome.screenshots.find(
              (s) => s.viewport === vp
            );
            const webkitShot = webDataWebKit.screenshots.find(
              (s) => s.viewport === vp
            );

            if (chromeShot && webkitShot) {
              const vpIssues = await analyzeCrossBrowser(
                chromeShot.buffer,
                webkitShot.buffer,
                vp
              );
              issues.push(...vpIssues);
            }
          }
          return issues;
        })
      );
    }

    await Promise.all(modulePromises);

    // Step 3: Generate summary
    await generateSummary(reportId);
  } catch (error) {
    console.error(`Pipeline failed for report ${reportId}:`, error);
    await failReport(reportId);
  }
}

/**
 * Fallback: extract HTML via simple fetch when Playwright/Browserless is unavailable.
 * No screenshots, no computed styles, no Lighthouse — but SEO, Content, and Shopify checks still work.
 */
async function extractWebDataFallback(url: string): Promise<WebCaptureData> {
  console.log("Using fetch-based fallback for", url);
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ShopQA/1.0" },
    signal: AbortSignal.timeout(15000),
  });
  const html = await res.text();

  // Parse HTML structure from raw HTML
  const htmlStructure = parseHtmlFromString(html, url);

  return {
    screenshots: [],
    computedStyles: [],
    htmlStructure,
  };
}

function parseHtmlFromString(html: string, baseUrl: string): import("./modules/types").HtmlStructure {
  // Simple regex-based extraction from raw HTML
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
  const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["']/is)
    || html.match(/<meta[^>]*content=["'](.*?)["'][^>]*name=["']description["']/is);

  // OG tags
  const ogTags: Record<string, string> = {};
  const ogMatches = html.matchAll(/<meta[^>]*property=["'](og:[^"']+)["'][^>]*content=["'](.*?)["']/gis);
  for (const m of ogMatches) ogTags[m[1]] = m[2];

  // Twitter tags
  const twitterTags: Record<string, string> = {};
  const twMatches = html.matchAll(/<meta[^>]*name=["'](twitter:[^"']+)["'][^>]*content=["'](.*?)["']/gis);
  for (const m of twMatches) twitterTags[m[1]] = m[2];

  // Headings
  const headings: { level: number; text: string }[] = [];
  const headingMatches = html.matchAll(/<h([1-6])[^>]*>(.*?)<\/h\1>/gis);
  for (const m of headingMatches) {
    headings.push({ level: parseInt(m[1]), text: stripTags(m[2]).trim().slice(0, 200) });
  }

  // Images
  const images: { src: string; alt?: string }[] = [];
  const imgMatches = html.matchAll(/<img[^>]*\bsrc=["'](.*?)["'][^>]*/gis);
  for (const m of imgMatches) {
    const altMatch = m[0].match(/\balt=["'](.*?)["']/i);
    const src = m[1].startsWith('http') ? m[1] : new URL(m[1], baseUrl).toString();
    images.push({ src, alt: altMatch?.[1] || undefined });
  }

  // Links
  const links: { href: string; text: string; isExternal: boolean }[] = [];
  const linkMatches = html.matchAll(/<a[^>]*\bhref=["'](.*?)["'][^>]*>(.*?)<\/a>/gis);
  for (const m of linkMatches) {
    try {
      const href = m[1].startsWith('http') ? m[1] : new URL(m[1], baseUrl).toString();
      const parsedBase = new URL(baseUrl);
      const parsedHref = new URL(href);
      links.push({
        href,
        text: stripTags(m[2]).trim().slice(0, 100),
        isExternal: parsedHref.hostname !== parsedBase.hostname,
      });
    } catch { /* skip invalid URLs */ }
  }

  // Schema markup
  const schemaMarkup: unknown[] = [];
  const schemaMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis);
  for (const m of schemaMatches) {
    try { schemaMarkup.push(JSON.parse(m[1])); } catch { /* skip */ }
  }

  // Canonical
  const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["'](.*?)["']/i);

  // noindex
  const robotsMatch = html.match(/<meta[^>]*name=["']robots["'][^>]*content=["'](.*?)["']/i);
  const hasNoIndex = robotsMatch ? robotsMatch[1].toLowerCase().includes('noindex') : false;

  return {
    title: titleMatch?.[1]?.trim(),
    metaDescription: metaDescMatch?.[1]?.trim(),
    ogTags,
    twitterTags,
    headings,
    images: images.slice(0, 100),
    links: links.slice(0, 200),
    schemaMarkup,
    canonical: canonicalMatch?.[1],
    hasNoIndex,
  };
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

async function extractFigmaData(
  figmaUrl: string
): Promise<ExtractedFigmaData | null> {
  try {
    const { fileKey, nodeId } = parseFigmaUrl(figmaUrl);
    const fileData = await figmaClient.getFile(fileKey);
    const rootNode = nodeId
      ? findNode(fileData.document, nodeId) ?? fileData.document
      : fileData.document;

    const tokens = extractTokens(rootNode);
    const structure = flattenStructure(rootNode);

    const nodeIds = nodeId ? [nodeId] : [fileData.document.id];
    const imageUrls = await figmaClient.getImages(fileKey, nodeIds);

    const screenshots: ExtractedFigmaData["screenshots"] = [];
    for (const [, url] of Object.entries(imageUrls)) {
      const buffer = await figmaClient.downloadImage(url);
      screenshots.push({ viewport: "desktop", buffer });
    }

    return { screenshots, tokens, structure };
  } catch (error) {
    console.error("Figma extraction failed:", error);
    return null;
  }
}

function findNode(
  node: import("./figma/types").FigmaDocumentNode,
  targetId: string
): import("./figma/types").FigmaDocumentNode | null {
  if (node.id === targetId) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findNode(child, targetId);
      if (found) return found;
    }
  }
  return null;
}

async function extractWebData(
  url: string,
  viewports: ("desktop" | "mobile")[],
  browser: "chromium" | "webkit"
): Promise<WebCaptureData> {
  const result = await captureWebPage(url, viewports, browser);
  return {
    screenshots: result.screenshots.map((s) => ({
      ...s,
      browser: browser === "chromium" ? "chrome" : "webkit",
    })),
    computedStyles: result.computedStyles,
    htmlStructure: result.htmlStructure,
  };
}

async function runModule(
  reportId: string,
  module: Category,
  analyzer: () => Promise<Issue[]>
) {
  try {
    await updateModuleStatus(reportId, module, "running");
    const issues = await analyzer();
    await saveIssues(reportId, issues);
    const score = calculateModuleScore(issues);
    await updateModuleStatus(reportId, module, "completed", { score });
  } catch (error) {
    console.error(`Module ${module} failed:`, error);
    await updateModuleStatus(reportId, module, "failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

function calculateModuleScore(issues: Issue[]): number {
  let score = 100;
  for (const issue of issues) {
    if (issue.severity === "critical") score -= 10;
    else if (issue.severity === "warning") score -= 3;
    else score -= 1;
  }
  return Math.max(0, score);
}

async function generateSummary(reportId: string) {
  const issues = await getReportIssues(reportId);
  const { getReportModules } = await import("./supabase/queries");
  const modules = await getReportModules(reportId);

  // Calculate score locally as fallback
  const localScore = calculateModuleScore(issues as Issue[]);
  const moduleScores: Record<string, number> = {};
  for (const m of modules) {
    if (m.score != null) moduleScores[m.module] = m.score;
  }

  // Sort critical issues to top
  const sortedIssues = [...issues].sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return (order[a.severity as keyof typeof order] ?? 3) - (order[b.severity as keyof typeof order] ?? 3);
  });
  const topIssues = sortedIssues.slice(0, 5).map((i) => ({
    category: i.category,
    title: i.title,
    description: i.description?.slice(0, 200) || "",
    severity: i.severity,
  }));

  try {
    const summary = await askClaudeJson<{
      overall_score: number;
      summary: string;
      top_issues: { category: string; title: string; description: string; severity: string }[];
      module_scores: Record<string, number>;
    }>(SUMMARY_SYSTEM_PROMPT, [{
      type: "text",
      text: JSON.stringify(
        issues.map((i) => ({
          category: i.category,
          severity: i.severity,
          title: i.title,
          description: i.description,
        }))
      ),
    }]);

    await completeReport(reportId, summary, summary.overall_score);
  } catch (error) {
    console.error("Claude summary failed, using local calculation:", error);
    // Fallback: generate summary locally
    const criticalCount = issues.filter((i) => i.severity === "critical").length;
    const warningCount = issues.filter((i) => i.severity === "warning").length;
    const infoCount = issues.filter((i) => i.severity === "info").length;

    const localSummary = {
      overall_score: localScore,
      summary: `Found ${issues.length} issues: ${criticalCount} critical, ${warningCount} warnings, ${infoCount} info. ${criticalCount > 0 ? "Critical issues need immediate attention." : "No critical issues found."}`,
      top_issues: topIssues,
      module_scores: moduleScores,
    };

    await completeReport(reportId, localSummary, localScore);
  }
}
