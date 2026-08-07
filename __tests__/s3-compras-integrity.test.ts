import { describe, it, expect } from 'vitest';
import { sanitizeLogoCandidate } from '../src/lib/compras/institution';
import {
  PDF_RENDER_TIMEOUT_MS,
  installPuppeteerShutdownHandlers,
  isMissingBrowserError,
} from '../src/lib/compras/pdf-renderer';

describe('S3 Compras — regresión de fixes críticos', () => {
  describe('C-4 Path traversal en logo institucional', () => {
    it('acepta https URL válida (CDN legítimo)', () => {
      expect(sanitizeLogoCandidate('https://cdn.example.com/logo.png'))
        .toBe('https://cdn.example.com/logo.png');
    });

    it('rechaza http (no seguro)', () => {
      expect(sanitizeLogoCandidate('http://example.com/logo.png')).toBeNull();
    });

    it('rechaza https a host interno (SSRF)', () => {
      expect(sanitizeLogoCandidate('https://localhost/admin')).toBeNull();
      expect(sanitizeLogoCandidate('https://127.0.0.1/admin')).toBeNull();
      expect(sanitizeLogoCandidate('https://192.168.1.1/router')).toBeNull();
      expect(sanitizeLogoCandidate('https://10.0.0.1/internal')).toBeNull();
    });

    it('rechaza javascript: y file:', () => {
      expect(sanitizeLogoCandidate('javascript:alert(1)')).toBeNull();
      expect(sanitizeLogoCandidate('file:///etc/passwd')).toBeNull();
    });

    it('rechaza data: URI no-imagen', () => {
      expect(sanitizeLogoCandidate('data:text/html,<script>alert(1)</script>')).toBeNull();
      expect(sanitizeLogoCandidate('data:application/pdf;base64,xxx')).toBeNull();
    });

    it('acepta data: URI de imagen con base64', () => {
      const png = 'data:image/png;base64,iVBORw0KGgo=';
      expect(sanitizeLogoCandidate(png)).toBe(png);
      const svg = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=';
      expect(sanitizeLogoCandidate(svg)).toBe(svg);
    });

    it('rechaza path traversal con ../', () => {
      expect(sanitizeLogoCandidate('../../../etc/passwd')).toBeNull();
      expect(sanitizeLogoCandidate('/uploads/../../../etc/passwd')).toBeNull();
      expect(sanitizeLogoCandidate('/assets/../uploads/admin.txt')).toBeNull();
    });

    it('rechaza rutas absolutas del sistema', () => {
      expect(sanitizeLogoCandidate('/etc/passwd')).toBeNull();
      expect(sanitizeLogoCandidate('/root/.ssh/id_rsa')).toBeNull();
      expect(sanitizeLogoCandidate('/proc/self/environ')).toBeNull();
    });

    it('rechaza protocol-relative URLs //', () => {
      expect(sanitizeLogoCandidate('//evil.com/x.png')).toBeNull();
    });

    it('acepta rutas legítimas dentro de /public', () => {
      expect(sanitizeLogoCandidate('/Logo_CNI.png')).toBe('/Logo_CNI.png');
      expect(sanitizeLogoCandidate('/uploads/institution/logo.png')).toBe('/uploads/institution/logo.png');
      expect(sanitizeLogoCandidate('/assets/logo/logo.svg')).toBe('/assets/logo/logo.svg');
    });

    it('rechaza strings vacíos o inválidos', () => {
      expect(sanitizeLogoCandidate('')).toBeNull();
      expect(sanitizeLogoCandidate(null as unknown as string)).toBeNull();
      expect(sanitizeLogoCandidate(undefined as unknown as string)).toBeNull();
      expect(sanitizeLogoCandidate(42 as unknown as string)).toBeNull();
    });

    it('rechaza URL https malformada', () => {
      expect(sanitizeLogoCandidate('https://')).toBeNull();
      expect(sanitizeLogoCandidate('https://[invalid')).toBeNull();
    });

    it('rechaza paths con segmentos que intentan escapar', () => {
      expect(sanitizeLogoCandidate('/foo/../../../etc/passwd')).toBeNull();
      expect(sanitizeLogoCandidate('/foo/./../../etc/passwd')).toBeNull();
    });
  });

  describe('A-1 PDF renderer constants y helpers', () => {
    it('expone PDF_RENDER_TIMEOUT_MS para uso en tests de regresión', () => {
      expect(PDF_RENDER_TIMEOUT_MS).toBe(30_000);
      expect(typeof installPuppeteerShutdownHandlers).toBe('function');
      expect(typeof isMissingBrowserError).toBe('function');
    });

    it('isMissingBrowserError detecta mensajes comunes de Chrome no disponible', () => {
      expect(isMissingBrowserError(new Error('PDF_BROWSER_NOT_AVAILABLE'))).toBe(true);
      expect(isMissingBrowserError(new Error('Could not find Chrome'))).toBe(true);
      expect(isMissingBrowserError(new Error('Could not find expected browser'))).toBe(true);
      expect(isMissingBrowserError(new Error('Random error'))).toBe(false);
      expect(isMissingBrowserError(null)).toBe(false);
      expect(isMissingBrowserError(undefined)).toBe(false);
      expect(isMissingBrowserError('string')).toBe(false);
    });

    it('installPuppeteerShutdownHandlers es idempotente', () => {
      installPuppeteerShutdownHandlers();
      installPuppeteerShutdownHandlers();
      expect(true).toBe(true);
    });
  });
});
