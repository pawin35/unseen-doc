import { chromium, type Browser } from "playwright";

// globalThis cache survives Next dev HMR so we don't leak Chromium processes.
const globalForBrowser = globalThis as unknown as {
  __chromium?: Promise<Browser>;
};

async function getBrowser(): Promise<Browser> {
  if (!globalForBrowser.__chromium) {
    globalForBrowser.__chromium = chromium.launch();
    process.on("beforeExit", () => {
      globalForBrowser.__chromium?.then((b) => b.close()).catch(() => {});
    });
  }
  const browser = await globalForBrowser.__chromium;
  if (!browser.isConnected()) {
    globalForBrowser.__chromium = chromium.launch();
    return globalForBrowser.__chromium;
  }
  return browser;
}

/** Render a complete HTML document to a tagged A4 PDF (ADR 0002). */
export async function renderPdf(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    // Templates that paginate (multi-page flow) mark <html data-paginating>
    // while their layout script runs and clear it when done. Templates without
    // such a script never set it, so this resolves immediately (back-compat
    // with older pinned template versions — ADR 0005).
    await page.waitForFunction(
      () => !document.documentElement.hasAttribute("data-paginating"),
      undefined,
      { timeout: 5000 },
    );
    return await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      tagged: true,
    });
  } finally {
    await page.close();
  }
}
