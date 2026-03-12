import { NextRequest, NextResponse } from "next/server";
import {
  getReport,
  getReportIssues,
  getReportModules,
} from "@/lib/supabase/queries";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [report, issues, modules] = await Promise.all([
      getReport(id),
      getReportIssues(id),
      getReportModules(id),
    ]);

    return NextResponse.json({ report, issues, modules });
  } catch (error) {
    console.error("Error fetching report:", error);
    return NextResponse.json(
      { error: "Report not found" },
      { status: 404 }
    );
  }
}
