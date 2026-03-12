"use client";

import { useParams } from "next/navigation";
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

// TODO: Replace with real data from Supabase + Realtime
const MOCK_MODULES = [
  { module: "seo", status: "completed", score: 85 },
  { module: "performance", status: "completed", score: 65 },
  { module: "accessibility", status: "running", score: null },
  { module: "content", status: "pending", score: null },
  { module: "shopify", status: "pending", score: null },
  { module: "design-qa", status: "pending", score: null },
  { module: "cross-browser", status: "pending", score: null },
];

const MOCK_ISSUES = [
  {
    id: "1",
    category: "seo",
    subcategory: "meta-title",
    severity: "warning" as const,
    title: "Page title too short",
    description: 'Title is 22 characters: "My Store". Recommended: 30-60 characters.',
    suggestion: "Expand the title with relevant keywords.",
    element: "title",
  },
  {
    id: "2",
    category: "seo",
    subcategory: "headings",
    severity: "critical" as const,
    title: "Missing H1 heading",
    description: "The page has no H1 heading. Every page should have exactly one H1.",
    suggestion: "Add a single H1 tag that describes the page content.",
    element: null,
  },
  {
    id: "3",
    category: "performance",
    subcategory: "core-web-vitals",
    severity: "warning" as const,
    title: "LCP is 3.2s",
    description: "Largest Contentful Paint is 3.2 seconds, above the 2.5s target.",
    suggestion: "Optimize the largest content element (likely a hero image).",
    element: null,
  },
  {
    id: "4",
    category: "seo",
    subcategory: "schema",
    severity: "info" as const,
    title: "No structured data found",
    description: "No JSON-LD structured data found on the page.",
    suggestion: "Add Product or Organization schema markup.",
    element: null,
  },
];

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
  const isProcessing = MOCK_MODULES.some(
    (m) => m.status === "pending" || m.status === "running"
  );
  const completedCount = MOCK_MODULES.filter(
    (m) => m.status === "completed"
  ).length;
  const progressPercent = (completedCount / MOCK_MODULES.length) * 100;

  const categories = [...new Set(MOCK_ISSUES.map((i) => i.category))];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Report #{id?.slice(0, 8)}</h1>
        <p className="text-muted-foreground mt-1">
          https://example-store.myshopify.com
        </p>
      </div>

      {/* Progress section */}
      {isProcessing && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Processing...</CardTitle>
            <CardDescription>
              {completedCount} of {MOCK_MODULES.length} modules completed
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={progressPercent} />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {MOCK_MODULES.map((m) => (
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-4xl font-bold">78</div>
            <p className="text-sm text-muted-foreground mt-1">Overall Score</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-4xl font-bold text-red-500">
              {MOCK_ISSUES.filter((i) => i.severity === "critical").length}
            </div>
            <p className="text-sm text-muted-foreground mt-1">Critical</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-4xl font-bold text-yellow-500">
              {MOCK_ISSUES.filter((i) => i.severity === "warning").length}
            </div>
            <p className="text-sm text-muted-foreground mt-1">Warnings</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-4xl font-bold text-blue-500">
              {MOCK_ISSUES.filter((i) => i.severity === "info").length}
            </div>
            <p className="text-sm text-muted-foreground mt-1">Info</p>
          </CardContent>
        </Card>
      </div>

      {/* Issues by category */}
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">
            All ({MOCK_ISSUES.length})
          </TabsTrigger>
          {categories.map((cat) => (
            <TabsTrigger key={cat} value={cat}>
              {MODULE_LABELS[cat] || cat} (
              {MOCK_ISSUES.filter((i) => i.category === cat).length})
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all" className="space-y-4 mt-4">
          {MOCK_ISSUES.map((issue) => (
            <IssueCard key={issue.id} issue={issue} />
          ))}
        </TabsContent>

        {categories.map((cat) => (
          <TabsContent key={cat} value={cat} className="space-y-4 mt-4">
            {MOCK_ISSUES.filter((i) => i.category === cat).map((issue) => (
              <IssueCard key={issue.id} issue={issue} />
            ))}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function IssueCard({
  issue,
}: {
  issue: (typeof MOCK_ISSUES)[number];
}) {
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
