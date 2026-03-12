"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function NewReport() {
  const router = useRouter();
  const [webUrl, setWebUrl] = useState("");
  const [figmaUrl, setFigmaUrl] = useState("");
  const [viewports, setViewports] = useState<string[]>(["desktop"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleViewport = (vp: string) => {
    setViewports((prev) =>
      prev.includes(vp) ? prev.filter((v) => v !== vp) : [...prev, vp]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!webUrl) {
      setError("Web URL is required");
      return;
    }

    if (viewports.length === 0) {
      setError("Select at least one viewport");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          web_url: webUrl,
          figma_url: figmaUrl || undefined,
          viewports,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create report");
      }

      const { id } = await res.json();

      // Trigger pipeline processing (fire and forget — the report page will poll)
      fetch(`/api/reports/${id}/process`, { method: "POST" }).catch(() => {});

      router.push(`/report/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>New QA Report</CardTitle>
          <CardDescription>
            Enter the URLs to analyze. Figma URL is optional — without it,
            Design QA and Cross-browser checks will be skipped.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="web-url">Web URL *</Label>
              <Input
                id="web-url"
                type="url"
                placeholder="https://your-store.myshopify.com"
                value={webUrl}
                onChange={(e) => setWebUrl(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                The deployed Shopify store page to analyze
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="figma-url">Figma URL (optional)</Label>
              <Input
                id="figma-url"
                type="url"
                placeholder="https://figma.com/design/..."
                value={figmaUrl}
                onChange={(e) => setFigmaUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Link to the Figma design file for Design QA comparison
              </p>
            </div>

            <div className="space-y-3">
              <Label>Viewports</Label>
              <div className="flex gap-6">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="vp-desktop"
                    checked={viewports.includes("desktop")}
                    onCheckedChange={() => toggleViewport("desktop")}
                  />
                  <Label htmlFor="vp-desktop" className="font-normal">
                    Desktop (1440px)
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="vp-mobile"
                    checked={viewports.includes("mobile")}
                    onCheckedChange={() => toggleViewport("mobile")}
                  />
                  <Label htmlFor="vp-mobile" className="font-normal">
                    Mobile (390px)
                  </Label>
                </div>
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Creating Report..." : "Generate Report"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
