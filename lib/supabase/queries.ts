import { createServerClient } from "./client";
import type { Issue, Category } from "../modules/types";

const ALL_MODULES: Category[] = [
  "design-qa",
  "performance",
  "seo",
  "accessibility",
  "content",
  "shopify",
  "cross-browser",
];

export async function createReport(input: {
  web_url: string;
  figma_url?: string;
  viewports: string[];
  parent_report_id?: string;
}) {
  const supabase = createServerClient();

  // Determine which modules to run
  const modules = input.figma_url
    ? ALL_MODULES
    : ALL_MODULES.filter((m) => m !== "design-qa" && m !== "cross-browser");

  // Create report
  const { data: report, error: reportError } = await supabase
    .from("reports")
    .insert({
      web_url: input.web_url,
      figma_url: input.figma_url || null,
      viewports: input.viewports,
      status: "processing",
      parent_report_id: input.parent_report_id || null,
    })
    .select()
    .single();

  if (reportError || !report) {
    throw new Error(`Failed to create report: ${reportError?.message}`);
  }

  // Create module entries
  const moduleInserts = modules.map((module) => ({
    report_id: report.id,
    module,
    status: "pending" as const,
  }));

  const { error: modulesError } = await supabase
    .from("report_modules")
    .insert(moduleInserts);

  if (modulesError) {
    throw new Error(`Failed to create modules: ${modulesError.message}`);
  }

  return report;
}

export async function updateModuleStatus(
  reportId: string,
  module: string,
  status: "running" | "completed" | "failed",
  extra?: { score?: number; error?: string }
) {
  const supabase = createServerClient();

  const update: Record<string, unknown> = { status };
  if (status === "running") update.started_at = new Date().toISOString();
  if (status === "completed" || status === "failed")
    update.completed_at = new Date().toISOString();
  if (extra?.score !== undefined) update.score = extra.score;
  if (extra?.error) update.error = extra.error;

  await supabase
    .from("report_modules")
    .update(update)
    .eq("report_id", reportId)
    .eq("module", module);
}

export async function saveIssues(reportId: string, issues: Issue[]) {
  if (issues.length === 0) return;

  const supabase = createServerClient();

  const inserts = issues.map((issue) => ({
    report_id: reportId,
    category: issue.category,
    subcategory: issue.subcategory,
    severity: issue.severity,
    title: issue.title,
    description: issue.description,
    expected_value: issue.expected_value || null,
    actual_value: issue.actual_value || null,
    element: issue.element || null,
    suggestion: issue.suggestion || null,
    screenshot_key: issue.screenshot_key || null,
    metadata: issue.metadata || null,
  }));

  const { error } = await supabase.from("issues").insert(inserts);

  if (error) {
    throw new Error(`Failed to save issues: ${error.message}`);
  }
}

export async function completeReport(
  reportId: string,
  summary: Record<string, unknown>,
  overallScore: number
) {
  const supabase = createServerClient();

  await supabase
    .from("reports")
    .update({
      status: "completed",
      overall_score: overallScore,
      summary: summary as never,
    })
    .eq("id", reportId);
}

export async function failReport(reportId: string) {
  const supabase = createServerClient();

  await supabase
    .from("reports")
    .update({ status: "failed" })
    .eq("id", reportId);
}

export async function getReport(reportId: string) {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .eq("id", reportId)
    .single();

  if (error) throw new Error(`Report not found: ${error.message}`);
  return data;
}

export async function getReportIssues(reportId: string) {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("issues")
    .select("*")
    .eq("report_id", reportId)
    .order("severity");

  if (error) throw new Error(`Failed to fetch issues: ${error.message}`);
  return data ?? [];
}

export async function getReportModules(reportId: string) {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("report_modules")
    .select("*")
    .eq("report_id", reportId);

  if (error) throw new Error(`Failed to fetch modules: ${error.message}`);
  return data ?? [];
}

export async function getReports() {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(`Failed to fetch reports: ${error.message}`);
  return data ?? [];
}
