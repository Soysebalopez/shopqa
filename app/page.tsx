"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface Report {
  id: string;
  web_url: string;
  figma_url: string | null;
  status: "processing" | "completed" | "failed";
  overall_score: number | null;
  created_at: string;
  viewports: string[];
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <Badge variant="secondary">--</Badge>;
  if (score >= 80)
    return <Badge className="bg-green-600 text-white">{score}</Badge>;
  if (score >= 50)
    return <Badge className="bg-yellow-500 text-black">{score}</Badge>;
  return <Badge variant="destructive">{score}</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <Badge variant="secondary">Completed</Badge>;
    case "processing":
      return (
        <Badge className="bg-blue-500 text-white animate-pulse">
          Processing
        </Badge>
      );
    case "failed":
      return <Badge variant="destructive">Failed</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export default function Dashboard() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reports")
      .then((res) => res.json())
      .then((data) => setReports(data.reports || []))
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Your QA reports for Shopify stores
          </p>
        </div>
        <Link href="/new">
          <Button>New Report</Button>
        </Link>
      </div>

      {loading && (
        <div className="grid gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {!loading && (
        <div className="grid gap-4">
          {reports.map((report) => (
            <Link key={report.id} href={`/report/${report.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-mono">
                      {report.web_url}
                    </CardTitle>
                    <div className="flex gap-2 items-center">
                      <ScoreBadge score={report.overall_score} />
                      <StatusBadge status={report.status} />
                    </div>
                  </div>
                  <CardDescription>
                    {new Date(report.created_at).toLocaleString()} ·{" "}
                    {report.viewports.join(", ")}
                    {report.figma_url && " · Figma linked"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {report.status === "completed" && (
                    <p className="text-sm text-muted-foreground">
                      Click to view full report
                    </p>
                  )}
                  {report.status === "processing" && (
                    <p className="text-sm text-muted-foreground">
                      Report is being generated...
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}

          {reports.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground mb-4">
                  No reports yet. Create your first QA report.
                </p>
                <Link href="/new">
                  <Button>Create Report</Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
