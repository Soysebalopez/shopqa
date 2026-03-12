import type { ComputedStyleEntry, HtmlStructure } from "../modules/types";
import { VIEWPORTS, type BrowserType, type ViewportConfig } from "./types";

/**
 * Browserless.io connection endpoint.
 * In MVP, we connect Playwright to Browserless via WebSocket.
 */
function getBrowserlessEndpoint(): string {
  const token = process.env.BROWSERLESS_TOKEN;
  if (!token) throw new Error("BROWSERLESS_TOKEN env var is required");
  return `wss://chrome.browserless.io?token=${token}`;
}

/**
 * Capture screenshots of a web page at specified viewports.
 * Uses Playwright connecting to Browserless.io.
 *
 * Note: This requires `playwright-core` (not `playwright`) to connect to remote browser.
 */
export async function captureWebPage(
  url: string,
  viewports: ("desktop" | "mobile")[],
  browserType: BrowserType = "chromium"
): Promise<{
  screenshots: { viewport: "desktop" | "mobile"; buffer: Buffer }[];
  computedStyles: ComputedStyleEntry[];
  htmlStructure: HtmlStructure;
}> {
  // Dynamic import to avoid issues in serverless
  const { chromium, webkit } = await import("playwright-core");

  const browser =
    browserType === "chromium"
      ? await chromium.connect(getBrowserlessEndpoint())
      : await webkit.connect(getBrowserlessEndpoint());

  try {
    const screenshots: { viewport: "desktop" | "mobile"; buffer: Buffer }[] = [];
    let computedStyles: ComputedStyleEntry[] = [];
    let htmlStructure: HtmlStructure = {
      ogTags: {},
      twitterTags: {},
      headings: [],
      images: [],
      links: [],
      schemaMarkup: [],
      hasNoIndex: false,
    };

    for (const vp of viewports) {
      const viewport: ViewportConfig = VIEWPORTS[vp];
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 2,
      });
      const page = await context.newPage();

      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(2000); // Let lazy-loaded content render

      // Full page screenshot
      const screenshotBuffer = await page.screenshot({ fullPage: true });
      screenshots.push({
        viewport: vp,
        buffer: Buffer.from(screenshotBuffer),
      });

      // Extract styles and HTML only once (from the first viewport run on chromium)
      if (vp === viewports[0] && browserType === "chromium") {
        computedStyles = await extractComputedStyles(page);
        htmlStructure = await extractHtmlStructure(page);
      }

      await context.close();
    }

    return { screenshots, computedStyles, htmlStructure };
  } finally {
    await browser.close();
  }
}

async function extractComputedStyles(
  page: import("playwright-core").Page
): Promise<ComputedStyleEntry[]> {
  return page.evaluate(() => {
    const elements = document.querySelectorAll(
      "h1, h2, h3, h4, h5, h6, p, a, button, img, input, section, header, footer, nav, main, [class*='hero'], [class*='banner']"
    );
    const results: ComputedStyleEntry[] = [];
    const propsToExtract = [
      "color",
      "backgroundColor",
      "fontSize",
      "fontFamily",
      "fontWeight",
      "lineHeight",
      "letterSpacing",
      "padding",
      "margin",
      "borderRadius",
      "boxShadow",
      "gap",
    ];

    elements.forEach((el, i) => {
      if (i >= 100) return; // Limit to first 100 elements
      const computed = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const styles: Record<string, string> = {};

      for (const prop of propsToExtract) {
        styles[prop] = computed.getPropertyValue(
          prop.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase())
        );
      }

      // Build a rough selector
      const tag = el.tagName.toLowerCase();
      const classes = Array.from(el.classList).slice(0, 2).join(".");
      const selector = classes ? `${tag}.${classes}` : tag;

      results.push({
        selector,
        tagName: tag,
        styles,
        text: el.textContent?.trim().slice(0, 100) || undefined,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      });
    });

    return results;
  });
}

async function extractHtmlStructure(
  page: import("playwright-core").Page
): Promise<HtmlStructure> {
  return page.evaluate(() => {
    const getMeta = (name: string) =>
      document
        .querySelector(`meta[name="${name}"], meta[property="${name}"]`)
        ?.getAttribute("content") || undefined;

    // OG tags
    const ogTags: Record<string, string> = {};
    document
      .querySelectorAll('meta[property^="og:"]')
      .forEach((el) => {
        const prop = el.getAttribute("property");
        const content = el.getAttribute("content");
        if (prop && content) ogTags[prop] = content;
      });

    // Twitter tags
    const twitterTags: Record<string, string> = {};
    document
      .querySelectorAll('meta[name^="twitter:"]')
      .forEach((el) => {
        const name = el.getAttribute("name");
        const content = el.getAttribute("content");
        if (name && content) twitterTags[name] = content;
      });

    // Headings
    const headings: { level: number; text: string }[] = [];
    document
      .querySelectorAll("h1, h2, h3, h4, h5, h6")
      .forEach((el) => {
        headings.push({
          level: parseInt(el.tagName[1]),
          text: el.textContent?.trim().slice(0, 200) || "",
        });
      });

    // Images
    const images: { src: string; alt?: string }[] = [];
    document.querySelectorAll("img").forEach((el) => {
      images.push({
        src: el.src,
        alt: el.alt || undefined,
      });
    });

    // Links
    const links: { href: string; text: string; isExternal: boolean }[] = [];
    document.querySelectorAll("a[href]").forEach((el) => {
      const anchor = el as HTMLAnchorElement;
      links.push({
        href: anchor.href,
        text: anchor.textContent?.trim().slice(0, 100) || "",
        isExternal: anchor.hostname !== window.location.hostname,
      });
    });

    // Schema markup
    const schemaMarkup: unknown[] = [];
    document
      .querySelectorAll('script[type="application/ld+json"]')
      .forEach((el) => {
        try {
          schemaMarkup.push(JSON.parse(el.textContent || ""));
        } catch {
          // ignore malformed JSON-LD
        }
      });

    // Canonical
    const canonical =
      document
        .querySelector('link[rel="canonical"]')
        ?.getAttribute("href") || undefined;

    // noindex
    const robotsMeta = getMeta("robots") || "";
    const hasNoIndex = robotsMeta.toLowerCase().includes("noindex");

    return {
      title: document.title || undefined,
      metaDescription: getMeta("description"),
      ogTags,
      twitterTags,
      headings,
      images,
      links,
      schemaMarkup,
      canonical,
      hasNoIndex,
    };
  });
}
