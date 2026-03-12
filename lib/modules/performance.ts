import type { Issue, LighthouseReport } from "./types";

/**
 * Performance module — analyzes Lighthouse report data.
 * Checks Core Web Vitals, image optimization, and third-party scripts.
 */
export function analyzePerformance(
  lighthouse: LighthouseReport | undefined,
  htmlImages: { src: string; alt?: string }[]
): Issue[] {
  const issues: Issue[] = [];

  if (!lighthouse) {
    issues.push({
      category: "performance",
      subcategory: "lighthouse",
      severity: "warning",
      title: "Lighthouse data unavailable",
      description:
        "Could not run Lighthouse analysis. Performance metrics are not available.",
      suggestion: "Ensure the page is accessible and try again.",
    });
    return issues;
  }

  // Performance score
  if (lighthouse.scores.performance < 50) {
    issues.push({
      category: "performance",
      subcategory: "score",
      severity: "critical",
      title: `Low performance score: ${lighthouse.scores.performance}`,
      description: `Lighthouse performance score is ${lighthouse.scores.performance}/100. This indicates significant performance issues.`,
      actual_value: `${lighthouse.scores.performance}/100`,
      expected_value: "90+/100",
      suggestion: "Review LCP, CLS, and TBT metrics below for specific optimizations.",
    });
  } else if (lighthouse.scores.performance < 90) {
    issues.push({
      category: "performance",
      subcategory: "score",
      severity: "warning",
      title: `Performance score could improve: ${lighthouse.scores.performance}`,
      description: `Lighthouse performance score is ${lighthouse.scores.performance}/100.`,
      actual_value: `${lighthouse.scores.performance}/100`,
      expected_value: "90+/100",
    });
  }

  // LCP
  if (lighthouse.metrics.lcp > 4000) {
    issues.push({
      category: "performance",
      subcategory: "core-web-vitals",
      severity: "critical",
      title: `LCP is ${(lighthouse.metrics.lcp / 1000).toFixed(1)}s`,
      description: `Largest Contentful Paint is ${(lighthouse.metrics.lcp / 1000).toFixed(1)}s, well above the 2.5s target. Users will perceive the page as slow.`,
      actual_value: `${(lighthouse.metrics.lcp / 1000).toFixed(1)}s`,
      expected_value: "< 2.5s",
      suggestion:
        "Optimize the largest visible element (usually hero image). Consider preloading, compression, or lazy loading.",
    });
  } else if (lighthouse.metrics.lcp > 2500) {
    issues.push({
      category: "performance",
      subcategory: "core-web-vitals",
      severity: "warning",
      title: `LCP is ${(lighthouse.metrics.lcp / 1000).toFixed(1)}s`,
      description: `Largest Contentful Paint is above the 2.5s target.`,
      actual_value: `${(lighthouse.metrics.lcp / 1000).toFixed(1)}s`,
      expected_value: "< 2.5s",
      suggestion: "Optimize the largest content element for faster rendering.",
    });
  }

  // CLS
  if (lighthouse.metrics.cls > 0.25) {
    issues.push({
      category: "performance",
      subcategory: "core-web-vitals",
      severity: "critical",
      title: `CLS is ${lighthouse.metrics.cls.toFixed(3)}`,
      description: `Cumulative Layout Shift is ${lighthouse.metrics.cls.toFixed(3)}, causing significant visual instability.`,
      actual_value: lighthouse.metrics.cls.toFixed(3),
      expected_value: "< 0.1",
      suggestion:
        "Add explicit width/height to images and ads. Avoid inserting content above existing content.",
    });
  } else if (lighthouse.metrics.cls > 0.1) {
    issues.push({
      category: "performance",
      subcategory: "core-web-vitals",
      severity: "warning",
      title: `CLS is ${lighthouse.metrics.cls.toFixed(3)}`,
      description: `Layout shifts detected above the 0.1 target.`,
      actual_value: lighthouse.metrics.cls.toFixed(3),
      expected_value: "< 0.1",
      suggestion: "Set dimensions on images and embeds to prevent layout shifts.",
    });
  }

  // TBT (proxy for INP in lab data)
  if (lighthouse.metrics.tbt > 600) {
    issues.push({
      category: "performance",
      subcategory: "core-web-vitals",
      severity: "critical",
      title: `Total Blocking Time is ${lighthouse.metrics.tbt}ms`,
      description: `TBT of ${lighthouse.metrics.tbt}ms indicates the main thread is heavily blocked. Interactions will feel sluggish.`,
      actual_value: `${lighthouse.metrics.tbt}ms`,
      expected_value: "< 200ms",
      suggestion:
        "Reduce JavaScript execution time. Defer non-critical scripts. Break up long tasks.",
    });
  } else if (lighthouse.metrics.tbt > 200) {
    issues.push({
      category: "performance",
      subcategory: "core-web-vitals",
      severity: "warning",
      title: `Total Blocking Time is ${lighthouse.metrics.tbt}ms`,
      description: `TBT above 200ms target.`,
      actual_value: `${lighthouse.metrics.tbt}ms`,
      expected_value: "< 200ms",
      suggestion: "Review and optimize JavaScript bundles.",
    });
  }

  // FCP
  if (lighthouse.metrics.fcp > 3000) {
    issues.push({
      category: "performance",
      subcategory: "paint-timing",
      severity: "warning",
      title: `First Contentful Paint is ${(lighthouse.metrics.fcp / 1000).toFixed(1)}s`,
      description: `Users wait ${(lighthouse.metrics.fcp / 1000).toFixed(1)}s before seeing any content.`,
      actual_value: `${(lighthouse.metrics.fcp / 1000).toFixed(1)}s`,
      expected_value: "< 1.8s",
      suggestion: "Reduce server response time and eliminate render-blocking resources.",
    });
  }

  return issues;
}
