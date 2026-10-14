import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  createPrintPdfDeps,
  isPdfContentType,
  openPdfFallback,
  printPdf,
  type PrintPdfDeps,
} from '@/lib/compras/print-pdf';

vi.mock('sileo', () => ({
  sileo: { warning: vi.fn() },
}));

function createAutoLoadIframe(): HTMLIFrameElement {
  const el = document.createElement('iframe');
  let srcValue = '';
  Object.defineProperty(el, 'src', {
    configurable: true,
    get: () => srcValue,
    set: (value: string) => {
      srcValue = value;
      queueMicrotask(() => el.dispatchEvent(new Event('load')));
    },
  });
  return el;
}

describe('isPdfContentType', () => {
  it('accepts application/pdf with charset', () => {
    expect(isPdfContentType('application/pdf; charset=utf-8')).toBe(true);
  });
  it('rejects non-pdf', () => {
    expect(isPdfContentType('text/html')).toBe(false);
  });
});

describe('printPdf', () => {
  let deps: PrintPdfDeps;
  let iframe: HTMLIFrameElement;
  let printSpy: ReturnType<typeof vi.fn>;
  let openSpy: ReturnType<typeof vi.fn>;
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    iframe = createAutoLoadIframe();
    printSpy = vi.fn();
    openSpy = vi.fn(() => ({ focus: vi.fn() }));
    createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-pdf');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      get: () => ({ focus: vi.fn(), print: printSpy, addEventListener: vi.fn() }),
    });

    deps = {
      fetch: vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/pdf' },
        blob: () => Promise.resolve(new Blob(['%PDF'], { type: 'application/pdf' })),
      }),
      document: {
        createElement: vi.fn((tag: string) => (tag === 'iframe' ? iframe : document.createElement(tag))),
        body: document.body,
      } as unknown as Document,
      window: {
        open: openSpy,
        setTimeout: (fn: () => void) => {
          fn();
          return 0;
        },
      } as unknown as Window,
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    iframe.remove();
  });

  it('fetches pdf, loads iframe, and calls print', async () => {
    await printPdf('/api/test.pdf', deps);

    expect(deps.fetch).toHaveBeenCalledWith('/api/test.pdf', { credentials: 'include' });
    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(printSpy).toHaveBeenCalled();
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('falls back to window.open when print throws', async () => {
    printSpy.mockImplementation(() => {
      throw new Error('blocked');
    });

    await printPdf('/api/test.pdf', deps);

    expect(openSpy).toHaveBeenCalledWith('blob:mock-pdf', '_blank', 'noopener,noreferrer');
  });
});

describe('openPdfFallback', () => {
  it('shows sileo when popup is blocked', async () => {
    const { sileo } = await import('sileo');
    const deps = createPrintPdfDeps();
    const open = vi.fn(() => null);
    const mockDeps: PrintPdfDeps = {
      ...deps,
      window: { ...deps.window, open } as Window,
    };
    openPdfFallback('blob:test', mockDeps);
    expect(sileo.warning).toHaveBeenCalled();
  });
});
