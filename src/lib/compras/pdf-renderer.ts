import puppeteer from 'puppeteer';

export function isMissingBrowserError(error: unknown): boolean {
  return error instanceof Error && (
    error.message === 'PDF_BROWSER_NOT_AVAILABLE' ||
    error.message.includes('Could not find Chrome') ||
    error.message.includes('Could not find expected browser')
  );
}

export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  let browser;

  try {
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || await puppeteer.executablePath();
    console.info('[PUPPETEER]', { executablePath });
    if (!executablePath) throw new Error('PDF_BROWSER_NOT_AVAILABLE');

    console.info('[PURCHASE ORDER] Launching Puppeteer');
    browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    await page.waitForNetworkIdle();
    console.info('[PURCHASE ORDER] Generating PDF');
    const pdf = await page.pdf({
      format: 'letter',
      printBackground: true,
      margin: { top: '12mm', right: '12mm', bottom: '14mm', left: '12mm' },
    });
    return Buffer.from(pdf);
  } catch (error) {
    if (isMissingBrowserError(error)) throw error;
    throw new Error('PDF_BROWSER_NOT_AVAILABLE', { cause: error });
  } finally {
    await browser?.close();
  }
}
