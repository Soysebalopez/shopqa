import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { web_url, figma_url, viewports } = body;

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

    // TODO: Create report in Supabase and trigger pipeline
    // For now, return a mock ID
    const mockId = crypto.randomUUID();

    return NextResponse.json({ id: mockId });
  } catch (error) {
    console.error("Error creating report:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  // TODO: Fetch reports from Supabase
  return NextResponse.json({ reports: [] });
}
