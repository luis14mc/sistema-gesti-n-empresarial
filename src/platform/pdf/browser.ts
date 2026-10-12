import { access } from 'fs/promises';
import { constants, existsSync } from 'fs';
import puppeteer from 'puppeteer';

export async function resolveBrowserExecutablePath(): Promise<string> {
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath();
  if (!executablePath) throw new Error('PDF_BROWSER_NOT_AVAILABLE');
  return executablePath;
}

export async function checkBrowserAvailability(): Promise<void> {
  const executablePath = await resolveBrowserExecutablePath();
  await access(executablePath, constants.X_OK);
}

/** Railway/Docker run Chromium as non-root; the setuid sandbox needs privileges the container lacks. */
export function isContainerEnvironment(): boolean {
  if (process.env.RAILWAY_ENVIRONMENT) return true;
  try {
    return existsSync('/.dockerenv');
  } catch {
    return false;
  }
}

export function shouldDisableChromiumSandbox(): boolean {
  const explicit = process.env.PUPPETEER_DISABLE_SANDBOX;
  if (explicit === 'false') return false;
  if (explicit === 'true') return true;
  const uid = typeof process.getuid === 'function' ? process.getuid() : 0;
  if (uid !== 0 && isContainerEnvironment()) return true;
  return false;
}

export function browserLaunchArguments(): string[] {
  const args = ['--disable-dev-shm-usage'];
  if (shouldDisableChromiumSandbox()) {
    args.push('--no-sandbox', '--disable-setuid-sandbox');
  }
  return args;
}

export function summarizePdfBrowserError(error: unknown): string {
  const lines: string[] = [];
  const seen = new Set<string>();
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current; depth += 1) {
    if (!(current instanceof Error)) break;
    const chunk = current.message.split('\n').slice(0, 4).join(' ').trim();
    if (chunk && !seen.has(chunk)) {
      seen.add(chunk);
      lines.push(chunk);
    }
    current = 'cause' in current ? current.cause : undefined;
  }
  return lines.join(' | ').slice(0, 500) || 'unknown';
}

export function logPdfBrowserNotAvailable(context: string, error: unknown): void {
  console.error(`[${context}] PDF_BROWSER_NOT_AVAILABLE`, {
    detail: summarizePdfBrowserError(error),
  });
}

let cachedPdfProbe: Promise<void> | null = null;

async function probePdfBrowserLaunch(): Promise<void> {
  const executablePath = await resolveBrowserExecutablePath();
  await access(executablePath, constants.X_OK);
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args: browserLaunchArguments(),
    });
  } catch (error) {
    logPdfBrowserNotAvailable('PDF browser probe', error);
    throw error;
  } finally {
    await browser?.close().catch(() => undefined);
  }
}

/** Single launch-and-close probe per process (readiness / startup diagnostics). */
export function probePdfBrowserOnce(): Promise<void> {
  if (!cachedPdfProbe) {
    cachedPdfProbe = probePdfBrowserLaunch();
  }
  return cachedPdfProbe;
}
