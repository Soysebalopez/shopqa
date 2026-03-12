import { NextRequest, NextResponse } from "next/server";
import { createReport, getReports } from "@/lib/supabase/queries";
import { runPipeline } from "@/lib/orchestrator";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { web_url, figma_url, viewports = ["desktop"] } = body;

    if (!web_url) {
      return NextResponse.json(
        { error: "web_url is required" },
        { status: 400 }
      );
    }

    // Validate URL
    try {
      new URL(web_url);
    } catch {
      return NextResponse.json(
        { error: "Invalid web URL" },
        { status: 400 }
      );
    }

    if (figma_url) {
      try {
        const parsed = new URL(figma_url);
        if (!parsed.hostname.includes("figma.com")) {
          return NextResponse.json(
            { error: "Figma URL must be from figma.com" },
            { status: 400 }
          );
        }
      } catch {
        return NextResponse.json(
          { error: "Invalid Figma URL" },
          { status: 400 }
        );
      }
    }

    // Create report in Supabase
    const report = await createReport({
      web_url,
      figma_url: figma_url || undefined,
      viewports,
    });

    // Run pipeline in background (don't await — let it process async)
    runPipeline(report.id, {
      web_url,
      figma_url: figma_url || undefined,
      viewports,
    }).catch((err) => {
      console.error(`Pipeline error for report ${report.id}:`, err);
    });

    return NextResponse.json({ id: report.id });
  } catch (error) {
    console.error("Error creating report:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const reports = await getReports();
    return NextResponse.json({ reports });
  } catch (error) {
    console.error("Error fetching reports:", error);
    return NextResponse.json({ reports: [] });
  }
}
