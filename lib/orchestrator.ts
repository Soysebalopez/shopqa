import { parseFigmaUrl, extractTokens, flattenStructure } from "./figma/parser";
import * as figmaClient from "./figma/client";
import { captureWebPage } from "./playwright/capture";
import { analyzeSeo } from "./modules/seo";
import { askClaudeJson } from "./claude/client";
import { SEO_SYSTEM_PROMPT } from "./claude/prompts/seo";
import { SUMMARY_SYSTEM_PROMPT } from "./claude/prompts/summary";
import {
  createReport,
  updateModuleStatus,
  saveIssues,
  completeReport,
  failReport,
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
 * This is called from the API route after creating the report record.
 */
export async function runPipeline(reportId: string, input: ReportInput) {
  try {
    // Step 1: Extract data in parallel
    const [figmaData, webDataChrome] = await Promise.all([
      input.figma_url ? extractFigmaData(reportId, input.figma_url) : null,
      extractWebData(reportId, input.web_url, input.viewports, "chromium"),
    ]);

    // Step 2: Run analysis modules in parallel
    const modulePromises: Promise<void>[] = [];

    // SEO (algorithmic + Claude)
    modulePromises.push(
      runModule(reportId, "seo", async () => {
        const algoIssues = analyzeSeo(webDataChrome.htmlStructure, input.web_url);

        // Claude enrichment
        let claudeIssues: Issue[] = [];
        try {
          const raw = await askClaudeJson<Omit<Issue, "category">[]>(
            SEO_SYSTEM_PROMPT,
            [
              {
                type: "text",
                text: JSON.stringify({
                  url: input.web_url,
                  title: webDataChrome.htmlStructure.title,
                  metaDescription: webDataChrome.htmlStructure.metaDescription,
                  headings: webDataChrome.htmlStructure.headings,
                  ogTags: webDataChrome.htmlStructure.ogTags,
                  schemaMarkup: webDataChrome.htmlStructure.schemaMarkup,
                }),
              },
            ]
          );
          claudeIssues = raw.map((i) => ({ ...i, category: "seo" as const }));
        } catch (err) {
          console.error("Claude SEO analysis failed:", err);
        }

        return [...algoIssues, ...claudeIssues];
      })
    );

    // Performance (placeholder — needs Lighthouse integration)
    modulePromises.push(
      runModule(reportId, "performance", async () => {
        // TODO: Integrate Lighthouse via Browserless
        return [];
      })
    );

    // Accessibility (placeholder)
    modulePromises.push(
      runModule(reportId, "accessibility", async () => {
        // TODO: Integrate Lighthouse a11y + custom checks
        return [];
      })
    );

    // Content (placeholder)
    modulePromises.push(
      runModule(reportId, "content", async () => {
        // TODO: Link checking + placeholder detection
        return [];
      })
    );

    // Shopify-specific (placeholder)
    modulePromises.push(
      runModule(reportId, "shopify", async () => {
        // TODO: Shopify DOM checks
        return [];
      })
    );

    // Design QA (only if Figma data available)
    if (figmaData) {
      modulePromises.push(
        runModule(reportId, "design-qa", async () => {
          // TODO: Visual diff + token comparison with Claude Vision
          return [];
        })
      );

      // Cross-browser (only if Figma data available for comparison context)
      modulePromises.push(
        runModule(reportId, "cross-browser", async () => {
          // TODO: Capture WebKit + Claude Vision comparison
          return [];
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

async function extractFigmaData(
  reportId: string,
  figmaUrl: string
): Promise<ExtractedFigmaData | null> {
  try {
    const { fileKey, nodeId } = parseFigmaUrl(figmaUrl);

    // Get file data
    const fileData = await figmaClient.getFile(fileKey);
    const rootNode = nodeId
      ? findNode(fileData.document, nodeId) ?? fileData.document
      : fileData.document;

    // Extract tokens
    const tokens = extractTokens(rootNode);
    const structure = flattenStructure(rootNode);

    // Get screenshots
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
  reportId: string,
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
  try {
    // Fetch all issues for this report
    const { getReportIssues } = await import("./supabase/queries");
    const issues = await getReportIssues(reportId);

    const summary = await askClaudeJson<{
      overall_score: number;
      summary: string;
      top_issues: {
        category: string;
        title: string;
        description: string;
        severity: string;
      }[];
      module_scores: Record<string, number>;
    }>(SUMMARY_SYSTEM_PROMPT, [
      {
        type: "text",
        text: JSON.stringify(
          issues.map((i) => ({
            category: i.category,
            severity: i.severity,
            title: i.title,
            description: i.description,
          }))
        ),
      },
    ]);

    await completeReport(reportId, summary, summary.overall_score);
  } catch (error) {
    console.error("Summary generation failed:", error);
    // Still complete the report even if summary fails
    const score = calculateModuleScore([] as Issue[]);
    await completeReport(
      reportId,
      { overall_score: score, summary: "Summary generation failed.", top_issues: [], module_scores: {} },
      score
    );
  }
}
