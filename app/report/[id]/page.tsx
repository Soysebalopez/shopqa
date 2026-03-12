"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

interface ReportData {
  id: string;
  web_url: string;
  figma_url: string | null;
  status: "processing" | "completed" | "failed";
  overall_score: number | null;
  summary: {
    summary?: string;
    top_issues?: { category: string; title: string; severity: string }[];
  } | null;
  created_at: string;
  viewports: string[];
}

interface IssueData {
  id: string;
  category: string;
  subcategory: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  expected_value: string | null;
  actual_value: string | null;
  element: string | null;
  suggestion: string | null;
}

interface ModuleData {
  module: string;
  status: "pending" | "running" | "completed" | "failed";
  score: number | null;
}

const MODULE_LABELS: Record<string, string> = {
  "design-qa": "Design QA",
  performance: "Performance",
  seo: "SEO",
  accessibility: "Accessibility",
  content: "Content",
  shopify: "Shopify",
  "cross-browser": "Cross-browser",
};

function SeverityBadge({ severity }: { severity: string }) {
  switch (severity) {
    case "critical":
      return <Badge variant="destructive">Critical</Badge>;
    case "warning":
      return <Badge className="bg-yellow-500 text-black">Warning</Badge>;
    case "info":
      return <Badge variant="secondary">Info</Badge>;
    default:
      return <Badge variant="secondary">{severity}</Badge>;
  }
}

function ModuleStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <span className="text-green-600">&#10003;</span>;
    case "running":
      return <span className="animate-spin inline-block">&#9881;</span>;
    case "failed":
      return <span className="text-red-500">&#10007;</span>;
    default:
      return <span className="text-muted-foreground">&#9711;</span>;
  }
}

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<ReportData | null>(null);
  const [issues, setIssues] = useState<IssueData[]>([]);
  const [modules, setModules] = useState<ModuleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    try {
      const res = await fetch(`/api/reports/${id}`);
      if (!res.ok) throw new Error("Report not found");
      const data = await res.json();
      setReport(data.report);
      setIssues(data.issues);
      setModules(data.modules);
      return data.report.status;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report");
      return "failed";
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    fetchReport().then((status) => {
      // Poll while processing
      if (status === "processing") {
        interval = setInterval(async () => {
          const newStatus = await fetchReport();
          if (newStatus !== "processing") {
            clearInterval(interval);
          }
        }, 3000);
      }
    });

    return () => clearInterval(interval);
  }, [fetchReport]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-destructive">{error || "Report not found"}</p>
        </CardContent>
      </Card>
    );
  }

  const isProcessing = report.status === "processing";
  const completedCount = modules.filter((m) => m.status === "completed").length;
  const progressPercent =
    modules.length > 0 ? (completedCount / modules.length) * 100 : 0;

  const criticalCount = issues.filter((i) => i.severity === "critical").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const infoCount = issues.filter((i) => i.severity === "info").length;

  const categories = [...new Set(issues.map((i) => i.category))];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">
          Report #{report.id.slice(0, 8)}
        </h1>
        <p className="text-muted-foreground mt-1 font-mono text-sm">
          {report.web_url}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {new Date(report.created_at).toLocaleString()} ·{" "}
          {report.viewports.join(", ")}
          {report.figma_url && " · Figma linked"}
        </p>
      </div>

      {/* Progress section */}
      {isProcessing && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Processing...</CardTitle>
            <CardDescription>
              {completedCount} of {modules.length} modules completed
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={progressPercent} />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {modules.map((m) => (
                <div
                  key={m.module}
                  className="flex items-center gap-2 text-sm"
                >
                  <ModuleStatusIcon status={m.status} />
                  <span>{MODULE_LABELS[m.module] || m.module}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {report.status === "completed" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-4xl font-bold">
                  {report.overall_score ?? "--"}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Overall Score
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-4xl font-bold text-red-500">
                  {criticalCount}
                </div>
                <p className="text-sm text-muted-foreground mt-1">Critical</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-4xl font-bold text-yellow-500">
                  {warningCount}
                </div>
                <p className="text-sm text-muted-foreground mt-1">Warnings</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-4xl font-bold text-blue-500">
                  {infoCount}
                </div>
                <p className="text-sm text-muted-foreground mt-1">Info</p>
              </CardContent>
            </Card>
          </div>

          {report.summary?.summary && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Executive Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{report.summary.summary}</p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Failed state */}
      {report.status === "failed" && (
        <Card className="border-destructive">
          <CardContent className="py-8 text-center">
            <p className="text-destructive font-medium">
              Report generation failed
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Check the console logs for details.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Issues by category */}
      {issues.length > 0 && (
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All ({issues.length})</TabsTrigger>
            {categories.map((cat) => (
              <TabsTrigger key={cat} value={cat}>
                {MODULE_LABELS[cat] || cat} (
                {issues.filter((i) => i.category === cat).length})
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="all" className="space-y-4 mt-4">
            {issues.map((issue) => (
              <IssueCard key={issue.id} issue={issue} />
            ))}
          </TabsContent>

          {categories.map((cat) => (
            <TabsContent key={cat} value={cat} className="space-y-4 mt-4">
              {issues
                .filter((i) => i.category === cat)
                .map((issue) => (
                  <IssueCard key={issue.id} issue={issue} />
                ))}
            </TabsContent>
          ))}
        </Tabs>
      )}

      {issues.length === 0 && report.status === "completed" && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              No issues found. The page looks great!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function IssueCard({ issue }: { issue: IssueData }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{issue.title}</CardTitle>
          <div className="flex gap-2">
            <Badge variant="outline">{issue.subcategory}</Badge>
            <SeverityBadge severity={issue.severity} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm">{issue.description}</p>
        {(issue.expected_value || issue.actual_value) && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            {issue.expected_value && (
              <div>
                <span className="text-muted-foreground">Expected: </span>
                <span className="font-mono">{issue.expected_value}</span>
              </div>
            )}
            {issue.actual_value && (
              <div>
                <span className="text-muted-foreground">Actual: </span>
                <span className="font-mono">{issue.actual_value}</span>
              </div>
            )}
          </div>
        )}
        {issue.suggestion && (
          <p className="text-sm text-muted-foreground">
            <strong>Fix:</strong> {issue.suggestion}
          </p>
        )}
        {issue.element && (
          <p className="text-xs font-mono text-muted-foreground">
            Element: {issue.element}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
