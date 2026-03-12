import { NextRequest, NextResponse } from "next/server";
import { getReport } from "@/lib/supabase/queries";
import { runPipeline } from "@/lib/orchestrator";

export const maxDuration = 120; // Allow up to 2 minutes for Vercel Pro

/**
 * POST /api/reports/[id]/process
 * Trigger pipeline processing for a report.
 * This runs synchronously and returns when done.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const report = await getReport(id);

    if (report.status !== "processing") {
      return NextResponse.json(
        { error: "Report is not in processing state" },
        { status: 400 }
      );
    }

    await runPipeline(id, {
      web_url: report.web_url,
      figma_url: report.figma_url || undefined,
      viewports: (report.viewports || ["desktop"]) as ("desktop" | "mobile")[],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Pipeline processing error:", error);
    return NextResponse.json(
      { error: "Pipeline failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
