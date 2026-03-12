export type Severity = "critical" | "warning" | "info";

export type Category =
  | "design-qa"
  | "performance"
  | "seo"
  | "accessibility"
  | "content"
  | "shopify"
  | "cross-browser";

export type ModuleStatus = "pending" | "running" | "completed" | "failed";

export interface Issue {
  category: Category;
  subcategory: string;
  severity: Severity;
  title: string;
  description: string;
  expected_value?: string;
  actual_value?: string;
  element?: string;
  suggestion?: string;
  screenshot_key?: string;
  metadata?: Record<string, unknown>;
}

export interface ModuleResult {
  module: Category;
  score: number;
  issues: Issue[];
  error?: string;
}

export interface ReportInput {
  figma_url?: string;
  web_url: string;
  viewports: ("desktop" | "mobile")[];
}

export interface ExtractedFigmaData {
  screenshots: {
    viewport: "desktop" | "mobile";
    buffer: Buffer;
  }[];
  tokens: FigmaTokens;
  structure: FigmaNode[];
}

export interface FigmaTokens {
  colors: { name: string; hex: string; usage: string }[];
  typography: {
    name: string;
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    lineHeight: number;
    letterSpacing: number;
  }[];
  spacing: { name: string; value: number }[];
}

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
}

export interface WebCaptureData {
  screenshots: {
    viewport: "desktop" | "mobile";
    browser: "chrome" | "webkit";
    buffer: Buffer;
  }[];
  computedStyles: ComputedStyleEntry[];
  htmlStructure: HtmlStructure;
  lighthouseReport?: LighthouseReport;
}

export interface ComputedStyleEntry {
  selector: string;
  tagName: string;
  styles: Record<string, string>;
  text?: string;
  rect: { x: number; y: number; width: number; height: number };
}

export interface HtmlStructure {
  title?: string;
  metaDescription?: string;
  ogTags: Record<string, string>;
  twitterTags: Record<string, string>;
  headings: { level: number; text: string }[];
  images: { src: string; alt?: string }[];
  links: { href: string; text: string; isExternal: boolean }[];
  schemaMarkup: unknown[];
  canonical?: string;
  hasNoIndex: boolean;
}

export interface LighthouseReport {
  scores: {
    performance: number;
    accessibility: number;
    seo: number;
    bestPractices: number;
  };
  metrics: {
    lcp: number;
    inp: number;
    cls: number;
    fcp: number;
    tti: number;
    tbt: number;
  };
  audits: Record<string, LighthouseAudit>;
}

export interface LighthouseAudit {
  id: string;
  title: string;
  score: number | null;
  displayValue?: string;
  description?: string;
  details?: unknown;
}
