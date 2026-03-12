import type { FigmaFileResponse, FigmaImageResponse } from "./types";

const FIGMA_API_BASE = "https://api.figma.com/v1";

function getToken(): string {
  const token = process.env.FIGMA_ACCESS_TOKEN;
  if (!token) throw new Error("FIGMA_ACCESS_TOKEN env var is required");
  return token;
}

async function figmaFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${FIGMA_API_BASE}${path}`, {
    headers: {
      "X-Figma-Token": getToken(),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Figma API error ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

/**
 * Get file data with node tree and properties.
 */
export async function getFile(fileKey: string): Promise<FigmaFileResponse> {
  return figmaFetch<FigmaFileResponse>(`/files/${fileKey}`);
}

/**
 * Get specific nodes from a file.
 */
export async function getFileNodes(
  fileKey: string,
  nodeIds: string[]
): Promise<FigmaFileResponse> {
  const ids = nodeIds.join(",");
  return figmaFetch<FigmaFileResponse>(
    `/files/${fileKey}/nodes?ids=${encodeURIComponent(ids)}`
  );
}

/**
 * Export nodes as images (PNG).
 * Returns a map of nodeId -> image URL.
 */
export async function getImages(
  fileKey: string,
  nodeIds: string[],
  options: { format?: "png" | "jpg" | "svg"; scale?: number } = {}
): Promise<Record<string, string>> {
  const ids = nodeIds.join(",");
  const format = options.format ?? "png";
  const scale = options.scale ?? 2;

  const data = await figmaFetch<FigmaImageResponse>(
    `/images/${fileKey}?ids=${encodeURIComponent(ids)}&format=${format}&scale=${scale}`
  );

  return data.images;
}

/**
 * Download an image from a Figma export URL.
 */
export async function downloadImage(imageUrl: string): Promise<Buffer> {
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error(`Failed to download Figma image: ${res.status}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
