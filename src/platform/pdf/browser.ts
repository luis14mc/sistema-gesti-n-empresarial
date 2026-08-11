import { access } from 'fs/promises';
import { constants } from 'fs';
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

export function browserLaunchArguments(): string[] {
  const args = ['--disable-dev-shm-usage'];
  if (process.env.PUPPETEER_DISABLE_SANDBOX === 'true') {
    args.push('--no-sandbox', '--disable-setuid-sandbox');
  }
  return args;
}
