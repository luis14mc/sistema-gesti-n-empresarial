import puppeteer, { type Browser } from 'puppeteer';
import { browserLaunchArguments, resolveBrowserExecutablePath } from '@/platform/pdf/browser';

export const PDF_RENDER_TIMEOUT_MS = 30_000;

export function isMissingBrowserError(error: unknown): boolean {
  return error instanceof Error && (
    error.message === 'PDF_BROWSER_NOT_AVAILABLE' ||
    error.message.includes('Could not find Chrome') ||
    error.message.includes('Could not find expected browser')
  );
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`PDF_RENDER_TIMEOUT_${label}`)), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  let browser: Browser | undefined;

  try {
    const executablePath = await resolveBrowserExecutablePath();

    console.info('[PURCHASE ORDER] Launching Puppeteer');
    browser = await withTimeout(
      puppeteer.launch({
        headless: true,
        executablePath,
        args: browserLaunchArguments(),
      }),
      PDF_RENDER_TIMEOUT_MS,
      'LAUNCH'
    );
    const page = await browser.newPage();
    try {
      await withTimeout(
        page.setContent(html, { waitUntil: 'load' }),
        PDF_RENDER_TIMEOUT_MS,
        'SET_CONTENT'
      );
      await withTimeout(
        page.waitForNetworkIdle({ timeout: PDF_RENDER_TIMEOUT_MS }),
        PDF_RENDER_TIMEOUT_MS,
        'NETWORK_IDLE'
      );
      console.info('[PURCHASE ORDER] Generating PDF');
      const pdf = await withTimeout(
        page.pdf({
          format: 'letter',
          printBackground: true,
          margin: { top: '12mm', right: '12mm', bottom: '14mm', left: '12mm' },
        }),
        PDF_RENDER_TIMEOUT_MS,
        'PAGE_PDF'
      );
      return Buffer.from(pdf);
    } finally {
      await page.close().catch(() => undefined);
    }
  } catch (error) {
    if (isMissingBrowserError(error)) throw error;
    if (error instanceof Error && error.message.startsWith('PDF_RENDER_TIMEOUT_')) throw error;
    throw new Error('PDF_BROWSER_NOT_AVAILABLE', { cause: error });
  } finally {
    if (browser) {
      await browser.close().catch((closeError) => {
        console.error('[PURCHASE ORDER] Failed to close Puppeteer browser', closeError);
      });
    }
  }
}

let pupeteerShutdownHandlersInstalled = false;

/** Instala handlers SIGINT/SIGTERM para cerrar browsers zombi en shutdown. */
export function installPuppeteerShutdownHandlers(): void {
  if (pupeteerShutdownHandlersInstalled) return;
  pupeteerShutdownHandlersInstalled = true;

  const cleanup = () => {
    console.info('[PURCHASE ORDER] Shutting down Puppeteer');
  };

  process.once('SIGINT', () => {
    cleanup();
    process.exit(130);
  });
  process.once('SIGTERM', () => {
    cleanup();
    process.exit(143);
  });
}
