import puppeteer from 'puppeteer';

export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: executablePath || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    const pdf = await page.pdf({
      format: 'letter',
      printBackground: true,
      margin: { top: '18mm', right: '14mm', bottom: '18mm', left: '14mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
