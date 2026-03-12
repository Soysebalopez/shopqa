export interface CaptureOptions {
  url: string;
  viewports: ViewportConfig[];
  browsers: BrowserType[];
  extractStyles?: boolean;
  extractHtml?: boolean;
  runLighthouse?: boolean;
}

export interface ViewportConfig {
  name: "desktop" | "mobile";
  width: number;
  height: number;
}

export type BrowserType = "chromium" | "webkit";

export const VIEWPORTS: Record<string, ViewportConfig> = {
  desktop: { name: "desktop", width: 1440, height: 900 },
  mobile: { name: "mobile", width: 390, height: 844 },
};

export interface StyleExtractionScript {
  selector: string;
  tagName: string;
  styles: Record<string, string>;
  text?: string;
  rect: { x: number; y: number; width: number; height: number };
}
